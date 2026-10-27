#!/usr/bin/env bash
#
# Cross-builds the Windows installer (DBClient-Setup-<version>.exe) from macOS or Linux,
# without touching backend/ or frontend/: both are copied to a staging directory before building.
#
# Environment:
#   VERSION   app version (default: frontend/package.json version)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
STAGING="$BUILD_DIR/staging"
PAYLOAD="$STAGING/payload"
GO_ENV=(GOOS=windows GOARCH=amd64 CGO_ENABLED=0)

VERSION="${VERSION:-$(node -p "require('$REPO_ROOT/frontend/package.json').version")}"
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "VERSION deve ter o formato x.y.z, recebido: $VERSION" >&2
  exit 1
fi

log() { printf '\n==> %s\n' "$*"; }

require() {
  for tool in "$@"; do
    command -v "$tool" >/dev/null || { echo "ferramenta ausente: $tool" >&2; exit 1; }
  done
}

require node npm go makensis rsync

rm -rf "$BUILD_DIR"
mkdir -p "$PAYLOAD"

log "Frontend (export estático)"
rsync -a --exclude node_modules --exclude .next --exclude out "$REPO_ROOT/frontend/" "$STAGING/frontend/"
(cd "$STAGING/frontend" && npm ci --no-audit --no-fund && npm run build)

log "Servidor Go (windows/amd64, CGO_ENABLED=0, -tags desktop)"
rsync -a --exclude 'web/dist/*' "$REPO_ROOT/backend/" "$STAGING/backend/"
mkdir -p "$STAGING/backend/web/dist"
cp -R "$STAGING/frontend/out/." "$STAGING/backend/web/dist/"
(cd "$STAGING/backend" && env "${GO_ENV[@]}" \
  go build -tags desktop -trimpath -ldflags="-s -w" -o "$PAYLOAD/dbclient-server.exe" ./cmd/server)

log "Shell nativo (WebView2)"
(cd "$SCRIPT_DIR" && env "${GO_ENV[@]}" \
  go build -trimpath -ldflags="-H windowsgui -s -w" -o "$PAYLOAD/DBClient.exe" .)

cp "$SCRIPT_DIR/assets/DBClient.ico" "$PAYLOAD/DBClient.ico"

log "Instalador NSIS"
OUTFILE="$BUILD_DIR/DBClient-Setup-$VERSION.exe"
makensis -V2 -INPUTCHARSET UTF8 \
  -DVERSION="$VERSION" \
  -DVI_VERSION="$VERSION.0" \
  -DPAYLOAD="$PAYLOAD" \
  -DOUTFILE="$OUTFILE" \
  "$SCRIPT_DIR/installer.nsi"

log "Pronto: $OUTFILE"
