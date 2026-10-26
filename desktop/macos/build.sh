#!/usr/bin/env bash
#
# Builds DBClient.app and DBClient-<version>.dmg without touching backend/ or frontend/:
# both are copied to a staging directory before building.
#
# Environment:
#   VERSION         app version (default: frontend/package.json version)
#   BUNDLE_ID       bundle identifier (default: com.dbclient.desktop)
#   SIGN_IDENTITY   codesign identity; "-" = ad-hoc (default). Use "Developer ID Application: ..." to distribute.
#   NOTARY_PROFILE  notarytool keychain profile; when set, the DMG is notarized and stapled.
#   SKIP_DMG=1      build only the .app

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
STAGING="$BUILD_DIR/staging"
APP="$BUILD_DIR/DBClient.app"
# Below 12.3 swiftc links libswiftCompatibility56, which recent Command Line Tools ship without an x86_64 slice.
MIN_MACOS="13.0"

VERSION="${VERSION:-$(node -p "require('$REPO_ROOT/frontend/package.json').version")}"
BUILD_NUMBER="$(git -C "$REPO_ROOT" rev-list --count HEAD 2>/dev/null || echo 1)"
BUNDLE_ID="${BUNDLE_ID:-com.dbclient.desktop}"
SIGN_IDENTITY="${SIGN_IDENTITY:--}"

log() { printf '\n==> %s\n' "$*"; }

require() {
  for tool in "$@"; do
    command -v "$tool" >/dev/null || { echo "ferramenta ausente: $tool" >&2; exit 1; }
  done
}

require node npm go swiftc lipo codesign iconutil sips hdiutil rsync

rm -rf "$BUILD_DIR"
mkdir -p "$STAGING"

log "Frontend (export estático)"
rsync -a --exclude node_modules --exclude .next --exclude out "$REPO_ROOT/frontend/" "$STAGING/frontend/"
(cd "$STAGING/frontend" && npm ci --no-audit --no-fund && npm run build)

log "Servidor Go (universal, CGO_ENABLED=0)"
rsync -a --exclude 'web/dist/*' "$REPO_ROOT/backend/" "$STAGING/backend/"
mkdir -p "$STAGING/backend/web/dist"
cp -R "$STAGING/frontend/out/." "$STAGING/backend/web/dist/"
for arch in arm64 amd64; do
  (cd "$STAGING/backend" && CGO_ENABLED=0 GOOS=darwin GOARCH="$arch" \
    go build -trimpath -ldflags="-s -w" -o "$STAGING/dbclient-server-$arch" ./cmd/server)
done
lipo -create -output "$STAGING/dbclient-server" "$STAGING/dbclient-server-arm64" "$STAGING/dbclient-server-amd64"

log "Shell nativo Swift (universal)"
for arch in arm64 x86_64; do
  swiftc -O -swift-version 5 \
    -target "$arch-apple-macos$MIN_MACOS" \
    -framework AppKit -framework WebKit -framework Security \
    -o "$STAGING/DBClient-$arch" \
    "$SCRIPT_DIR"/Sources/*.swift
done
lipo -create -output "$STAGING/DBClient" "$STAGING/DBClient-arm64" "$STAGING/DBClient-x86_64"

log "Ícone"
ICONSET="$STAGING/AppIcon.iconset"
mkdir -p "$ICONSET"
for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$REPO_ROOT/frontend/public/logo.png" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  sips -z "$double" "$double" "$REPO_ROOT/frontend/public/logo.png" --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$STAGING/AppIcon.icns"

log "Montando DBClient.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$STAGING/DBClient" "$APP/Contents/MacOS/DBClient"
cp "$STAGING/dbclient-server" "$APP/Contents/MacOS/dbclient-server"
cp "$STAGING/AppIcon.icns" "$APP/Contents/Resources/AppIcon.icns"
sed -e "s/__BUNDLE_ID__/$BUNDLE_ID/" -e "s/__VERSION__/$VERSION/" -e "s/__BUILD__/$BUILD_NUMBER/" -e "s/__MIN_MACOS__/$MIN_MACOS/" \
  "$SCRIPT_DIR/Resources/Info.plist" > "$APP/Contents/Info.plist"
plutil -lint "$APP/Contents/Info.plist" >/dev/null

log "Assinando ($SIGN_IDENTITY)"
SIGN_FLAGS=(--force --sign "$SIGN_IDENTITY")
if [[ "$SIGN_IDENTITY" != "-" ]]; then
  SIGN_FLAGS+=(--options runtime --timestamp)
fi
codesign "${SIGN_FLAGS[@]}" "$APP/Contents/MacOS/dbclient-server"
codesign "${SIGN_FLAGS[@]}" --identifier "$BUNDLE_ID" "$APP"
codesign --verify --strict --verbose=2 "$APP"

if [[ "${SKIP_DMG:-0}" == "1" ]]; then
  log "Pronto: $APP"
  exit 0
fi

log "Gerando DMG"
DMG="$BUILD_DIR/DBClient-$VERSION.dmg"
DMG_ROOT="$STAGING/dmg"
mkdir -p "$DMG_ROOT"
cp -R "$APP" "$DMG_ROOT/"
ln -s /Applications "$DMG_ROOT/Applications"
hdiutil create -volname "DBClient" -srcfolder "$DMG_ROOT" -ov -format UDZO "$DMG" >/dev/null

if [[ "$SIGN_IDENTITY" != "-" ]]; then
  codesign --force --sign "$SIGN_IDENTITY" --timestamp "$DMG"
fi

if [[ -n "${NOTARY_PROFILE:-}" ]]; then
  log "Notarizando"
  xcrun notarytool submit "$DMG" --keychain-profile "$NOTARY_PROFILE" --wait
  xcrun stapler staple "$DMG"
fi

log "Pronto: $DMG"
