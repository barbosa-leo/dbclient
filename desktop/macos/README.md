# DBClient para macOS

Shell nativo (Swift + WKWebView) que empacota o servidor existente como processo filho. `backend/` e `frontend/` não são alterados: o build copia ambos para `build/staging` e compila lá.

```
DBClient.app/Contents/MacOS/
├── DBClient          # shell nativo: janela, menus, Keychain, ciclo de vida
└── dbclient-server   # mesmo binário do Docker (CGO_ENABLED=0), compilado para darwin
```

## Build

Requisitos: Command Line Tools do Xcode, Go e Node.

```sh
./desktop/macos/build.sh              # build/DBClient.app + build/DBClient-<versão>.dmg
SKIP_DMG=1 ./desktop/macos/build.sh   # apenas o .app
```

Para distribuir a outras pessoas (sem bloqueio do Gatekeeper):

```sh
SIGN_IDENTITY="Developer ID Application: Nome (TEAMID)" \
NOTARY_PROFILE=dbclient-notary \
./desktop/macos/build.sh
```

`NOTARY_PROFILE` é criado uma vez com `xcrun notarytool store-credentials`.

## Comportamento

| Item | Valor |
|---|---|
| Acesso | Modo local (`-tags desktop`, `DBCLIENT_AUTH_MODE=local`): sem login, usuários ou logout; o app entra como o `admin` inicial via `/api/auth/local` com um token novo a cada execução |
| Dados (SQLite) | `~/Library/Application Support/DBClient` |
| Dumps temporários | `~/Library/Caches/DBClient/dumps` |
| Logs do servidor | `~/Library/Logs/DBClient/server.log` (rotação em 10 MB) |
| Chave de criptografia | Keychain, serviço `com.dbclient.desktop`, gerada no primeiro uso |
| Endereço | `127.0.0.1` em porta fixa por instalação (reaproveitada entre execuções para preservar o `localStorage`) |
| `pg_dump`/`psql` | procurados no Homebrew (`libpq`), `/usr/local` e Postgres.app; instale com `brew install libpq` |

Se a chave sumir do Keychain mas o banco existir, o app não inicia em vez de gerar uma chave nova, porque as senhas das conexões salvas ficariam ilegíveis.

Com assinatura ad-hoc (padrão), cada rebuild muda a identidade do app e o macOS pede autorização para ler a chave no Keychain na primeira execução; escolha "Sempre Permitir". Com Developer ID isso não acontece entre versões.
