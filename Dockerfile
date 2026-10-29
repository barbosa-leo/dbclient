# syntax=docker/dockerfile:1

FROM node:24.22.2-alpine3.24 AS frontend
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM golang:1.23.4-alpine3.21 AS backend
WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
COPY --from=frontend /app/out ./web/dist
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/dbclient ./cmd/server

FROM alpine:3.21.0
RUN apk add --no-cache ca-certificates tzdata postgresql17-client \
    && addgroup -S -g 10001 dbclient && adduser -S -u 10001 -G dbclient dbclient \
    && mkdir -p /data /tmp/dbclient \
    && chown dbclient:dbclient /data /tmp/dbclient
COPY --from=backend /out/dbclient /usr/local/bin/dbclient

ENV DBCLIENT_ADDR=:8080 \
    DBCLIENT_DATA_DIR=/data \
    DBCLIENT_DUMP_DIR=/tmp/dbclient \
    DBCLIENT_DUMP_TTL=24h \
    DBCLIENT_SESSION_TTL=12h

USER dbclient
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
ENTRYPOINT ["/usr/local/bin/dbclient"]
