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
CACHE_DIR="$SCRIPT_DIR/cache"
GO_ENV=(GOOS=windows GOARCH=amd64 CGO_ENABLED=0)

# DLL closure of pg_dump.exe and psql.exe in the EDB zip; it must be revisited when the version changes.
# vcruntime140.dll is not part of Windows, so it ships app-local (the zip only carries it inside pgAdmin).
POSTGRES_VERSION="18.4-1"
POSTGRES_SHA256="7effe34c0bf89027b3f171447d351cbc460f4566c8d0f643daec67f140787858"
POSTGRES_ZIP="$CACHE_DIR/postgresql-$POSTGRES_VERSION-windows-x64-binaries.zip"
POSTGRES_FILES=(
  pgsql/bin/pg_dump.exe pgsql/bin/psql.exe pgsql/bin/libpq.dll
  pgsql/bin/libssl-3-x64.dll pgsql/bin/libcrypto-3-x64.dll pgsql/bin/libintl-9.dll pgsql/bin/libiconv-2.dll
  pgsql/bin/libwinpthread-1.dll pgsql/bin/liblz4.dll pgsql/bin/libzstd.dll
  "pgsql/pgAdmin 4/python/vcruntime140.dll"
)

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

require node npm go makensis rsync curl shasum unzip

rm -rf "$BUILD_DIR"
mkdir -p "$PAYLOAD"

log "Frontend (export estático)"
rsync -a --exclude node_modules --exclude .next --exclude out "$REPO_ROOT/frontend/" "$STAGING/frontend/"
(cd "$STAGING/frontend" && npm ci --no-audit --no-fund && APP_VERSION="$VERSION" npm run build)

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

log "Cliente PostgreSQL $POSTGRES_VERSION (pg_dump/psql)"
if [[ ! -f "$POSTGRES_ZIP" ]]; then
  mkdir -p "$CACHE_DIR"
  curl -fsSL --retry 3 -o "$POSTGRES_ZIP.part" "https://get.enterprisedb.com/postgresql/$(basename "$POSTGRES_ZIP")"
  mv "$POSTGRES_ZIP.part" "$POSTGRES_ZIP"
fi
if ! echo "$POSTGRES_SHA256  $POSTGRES_ZIP" | shasum -a 256 -c - >/dev/null; then
  echo "checksum inválido: $POSTGRES_ZIP" >&2
  rm -f "$POSTGRES_ZIP"
  exit 1
fi
unzip -q -j "$POSTGRES_ZIP" "${POSTGRES_FILES[@]}" -d "$PAYLOAD/postgres"

log "Instalador NSIS"
OUTFILE="$BUILD_DIR/DBClient-Setup-$VERSION.exe"
makensis -V2 -INPUTCHARSET UTF8 \
  -DVERSION="$VERSION" \
  -DVI_VERSION="$VERSION.0" \
  -DPAYLOAD="$PAYLOAD" \
  -DOUTFILE="$OUTFILE" \
  "$SCRIPT_DIR/installer.nsi"

log "Pronto: $OUTFILE"
