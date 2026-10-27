# DBClient para Windows

Shell nativo em Go (WebView2, sem CGO) que executa o servidor existente como processo filho. `backend/` e `frontend/` não são alterados: o build copia ambos para `build/staging` e compila lá. Todo o build roda no macOS ou Linux (cross-compile).

```
%LOCALAPPDATA%\Programs\DBClient\
├── DBClient.exe          # shell: janela WebView2, ciclo de vida, chave DPAPI
├── dbclient-server.exe   # servidor (-tags desktop, CGO_ENABLED=0)
├── DBClient.ico
└── Uninstall.exe
```

## Build

Requisitos: Go, Node e `makensis` (`brew install makensis`).

O ícone fica versionado em `assets/DBClient.ico` (16 a 256 px, gerado a partir de `frontend/public/logo.png`); se o logo mudar, ele precisa ser regenerado.

```sh
./desktop/windows/build.sh   # build/DBClient-Setup-<versão>.exe
```

## Instalação

- Instalador por usuário, sem pedir permissão de administrador; cria atalhos no Menu Iniciar e na Área de Trabalho e registra a desinstalação em "Aplicativos instalados".
- Requer Windows 10/11 64 bits com o **Microsoft Edge WebView2 Runtime** (já presente no Windows 11 e no Windows 10 atualizado). Se faltar, o instalador e o app oferecem a página de download.
- Sem assinatura de código, o SmartScreen exibe "O Windows protegeu o computador" na primeira execução: "Mais informações" › "Executar assim mesmo".

## Comportamento

| Item | Valor |
|---|---|
| Acesso | Modo local (`-tags desktop`): sem login, usuários ou logout; token novo a cada execução |
| Dados (SQLite) | `%LOCALAPPDATA%\DBClient\data` |
| Dumps temporários | `%LOCALAPPDATA%\DBClient\dumps` |
| Logs do servidor | `%LOCALAPPDATA%\DBClient\logs\server.log` (rotação em 10 MB) |
| Chave de criptografia | `%LOCALAPPDATA%\DBClient\encryption.key`, protegida com DPAPI (só o mesmo usuário do Windows consegue ler) |
| Endereço | `127.0.0.1` em porta fixa por instalação (preserva o `localStorage`) |
| `pg_dump`/`psql` | `PATH` ou a versão mais recente em `C:\Program Files\PostgreSQL\<versão>\bin` |
| Encerramento | O servidor roda num Job Object: fechar a janela, ou o shell travar, encerra o servidor e qualquer `pg_dump`/`psql` em andamento (a transação do `psql` é revertida) |
| Instância única | Abrir o app de novo só traz a janela existente para frente |

Se `encryption.key` sumir mas o banco existir, o app não inicia em vez de gerar uma chave nova, porque as senhas das conexões salvas ficariam ilegíveis.

A desinstalação mantém os dados, a menos que o usuário confirme a remoção.
