# DBClient

**Cliente web leve, seguro e autossuficiente para gerenciamento de bancos de dados PostgreSQL.**

Distribuído como um binário único em Go que embute a interface web estática (Next.js) e um banco SQLite interno para configurações — pronto para rodar em um único container Docker com consumo mínimo de recursos.

---

## Principais Recursos

- **Binário Único Zero-Dependency:** Frontend compilado estaticamente (`go:embed`) e servido diretamente pelo Go, sem necessidade de runtime Node.js em produção.
- **Explorador Visual Completo:** Navegação em árvore por Schemas, Tabelas, Views, Functions, Procedures e Triggers, incluindo inspeção de índices e chaves estrangeiras.
- **Editor SQL Avançado:** Destaque de sintaxe, formatação automática, histórico de consultas, paginação adaptativa e execução do statement sob o cursor ou do trecho selecionado com `Ctrl + Enter`.
- **Execução Transacional de Scripts:** Upload e execução de arquivos `.sql` com rollback automático em caso de falha (`ON_ERROR_STOP=1`).
- **Dumps em Streaming:** Exportação (`pg_dump`) e restauração (`psql`) diretas via stream sem sobrecarregar a memória RAM, com progresso em tempo real e cancelamento assíncrono.
- **Segurança Integrada:** Credenciais de bancos cifradas em repouso com **AES-256-GCM**, controle de acesso baseado em papéis (`admin`, `operator`, `viewer`) e rate limiting por IP.

---

## App Desktop (macOS e Windows)

Para uso individual, o DBClient também está disponível como aplicativo nativo: o mesmo servidor roda localmente (apenas em `127.0.0.1`) e a interface abre em uma janela própria, **sem login, gerenciamento de usuários ou logout**. Você atua como administrador: ambientes, conexões, consultas, scripts, dumps e configurações funcionam como na versão web.

| Sistema | Download | Requisitos |
|---|---|---|
| macOS | [**DBClient-macOS.dmg**](https://github.com/barbosa-leo/dbclient/releases/latest/download/DBClient-macOS.dmg) | macOS 13 ou superior (Apple Silicon e Intel) |
| Windows | [**DBClient-Windows-Setup.exe**](https://github.com/barbosa-leo/dbclient/releases/latest/download/DBClient-Windows-Setup.exe) | Windows 10/11 64 bits com [WebView2 Runtime](https://go.microsoft.com/fwlink/p/?LinkId=2124703) (já incluso no Windows 11) |

Versões anteriores e notas de cada versão ficam na página de [Releases](https://github.com/barbosa-leo/dbclient/releases).

> [!IMPORTANT]
> Os instaladores ainda não são assinados digitalmente, então o sistema exibe um aviso na primeira execução:
> - **macOS:** ao abrir o app pela primeira vez, ele será bloqueado. Vá em **Ajustes do Sistema › Privacidade e Segurança** e clique em **Abrir Mesmo Assim**. Na primeira execução, o macOS também pede a senha do Mac para guardar a chave de criptografia no Keychain: escolha **Sempre Permitir**.
> - **Windows:** na tela "O Windows protegeu o computador", clique em **Mais informações › Executar assim mesmo**. O instalador não pede permissão de administrador.

Os apps já incluem o `pg_dump` e o `psql` do PostgreSQL 18, usados em scripts e dumps de servidores até a versão 18; não é preciso instalar nada.

**Atualizações:** quando sai uma versão nova, ela aparece em destaque na página **Novidades** do app, com o botão **Atualizar**. No Windows, o app baixa a versão nova, se reinstala e reabre sozinho. No macOS, o app baixa e abre o DMG: feche o DBClient (⌘Q) e arraste o app para a pasta Aplicativos, substituindo a versão anterior. Seus dados e conexões são mantidos.

Para gerar os instaladores localmente, veja [desktop/macos](desktop/macos/README.md) e [desktop/windows](desktop/windows/README.md).

**Privacidade:** o DBClient não coleta dados; tudo fica na sua instalação, e a única conexão externa automática é a consulta de versões no GitHub. Veja a [Política de Privacidade](PRIVACY.md).

---

## Quick Start (Docker Compose)

A maneira mais rápida de subir o DBClient em produção ou localmente usando a imagem oficial do Docker Hub.

### 1. Gere a chave de criptografia e crie o `.env`

```bash
cat <<EOF> .env
DBCLIENT_ENCRYPTION_KEY=$(openssl rand -base64 32)
DBCLIENT_PORT_APP=8080
EOF
```

> [!CAUTION]
> **Guarde a `DBCLIENT_ENCRYPTION_KEY` em local seguro.** Ela cifra as senhas dos bancos cadastrados (AES-256-GCM). Se for perdida ou alterada após o primeiro uso, não será possível decifrar as conexões já salvas.

### 2. Crie o `docker-compose.yml` e inicie

```yaml
services:
  dbclient:
    image: barbosasleonardo/dbclient:latest
    container_name: dbclient
    restart: unless-stopped
    ports:
      - "127.0.0.1:${DBCLIENT_PORT_APP:-8080}:8080"
    extra_hosts:
      - "host.docker.internal:host-gateway" # Permite conectar ao Postgres na máquina host
    environment:
      DBCLIENT_ENCRYPTION_KEY: ${DBCLIENT_ENCRYPTION_KEY:?Defina DBCLIENT_ENCRYPTION_KEY no .env}
      DBCLIENT_INITIAL_ADMIN_PASSWORD: ${DBCLIENT_INITIAL_ADMIN_PASSWORD:-admin}
    volumes:
      - dbclient-data:/data

volumes:
  dbclient-data:
```

Suba o serviço:

```bash
docker compose up -d
```

---

## Primeiro Acesso e Permissões

Acesse **`http://localhost:8080`** com as credenciais iniciais:

- **E-mail:** `admin@dbclient.local`
- **Senha:** `admin` *(ou o valor definido em `DBCLIENT_INITIAL_ADMIN_PASSWORD`)*

No primeiro login, o sistema exigirá a definição de uma nova senha forte antes de liberar o acesso.

| Papel | Permissões |
| :--- | :--- |
| **`admin`** | Controle total: gerencia usuários, conexões/ambientes, queries, scripts e dumps. |
| **`operator`** | Usa conexões existentes: explora schemas, executa queries, scripts `.sql` e dumps. |
| **`viewer`** | Acesso somente-leitura aos esquemas e consultas nos bancos permitidos. |

> [!TIP]
> **Conectando ao PostgreSQL da sua própria máquina:** Ao cadastrar uma conexão que roda fora do Docker (direto no host), utilize `host.docker.internal` no campo **Host**.

---

## Configuração e Persistência

### Volumes e Armazenamento
- **`/data` (Persistente):** Armazena o banco SQLite interno (`dbclient.db` em modo WAL) com usuários e conexões. **Deve sempre estar mapeado em um volume Docker.**
- **`/tmp/dbclient` (Efêmero):** Diretório temporário para processamento de dumps e scripts. Os arquivos são limpos automaticamente após o período de `DBCLIENT_DUMP_TTL`.

### Variáveis de Ambiente

| Variável | Obrigatória | Padrão | Descrição |
| :--- | :---: | :---: | :--- |
| `DBCLIENT_ENCRYPTION_KEY` | **Sim** | — | Chave AES-256 (32 bytes em Base64) para cifrar senhas em repouso |
| `DBCLIENT_INITIAL_ADMIN_PASSWORD` | Não | `admin` | Senha inicial do administrador criada no primeiro boot |
| `DBCLIENT_PORT_APP` | Não | `8080` | Porta exposta no host via Docker Compose |
| `DBCLIENT_ADDR` | Não | `:8080` | Endereço e porta interna do servidor HTTP Go |
| `DBCLIENT_DATA_DIR` | Não | `/data` | Diretório de persistência do banco SQLite |
| `DBCLIENT_DUMP_DIR` | Não | `/tmp/dbclient` | Diretório temporário de dumps e uploads de scripts |
| `DBCLIENT_DUMP_TTL` | Não | `24h` | Tempo de retenção dos arquivos temporários de dump |
| `DBCLIENT_SESSION_TTL` | Não | `12h` | Duração da sessão autenticada (cookie) |
| `DBCLIENT_RATE_LIMIT_ENABLED` | Não | `true` | Ativa proteção de rate limit por IP |
| `DBCLIENT_RATE_LIMIT_AUTH` | Não | `10` | Limite de tentativas de login por minuto por IP |
| `DBCLIENT_RATE_LIMIT_QUERY` | Não | `60` | Limite de execuções de queries por minuto por IP |
| `DBCLIENT_RATE_LIMIT_API` | Não | `120` | Limite geral de chamadas à API por minuto por IP |
| `DBCLIENT_TRUSTED_PROXIES` | Não | — | IPs/CIDRs de proxies confiáveis (ou `*`) para ler `X-Forwarded-For` |

---

## Arquitetura e Desenvolvimento

O projeto segue **Clean Architecture** no backend em Go (`domain`, `usecase`, `adapter`, `transport/http`) usando `modernc.org/sqlite` (sem CGO) e `log/slog` para logs estruturados. O frontend utiliza **Next.js (App Router + Tailwind CSS v4)** exportado de forma estática (`output: 'export'`) e embutido via `go:embed`. O endpoint público `GET /healthz` está disponível para monitoramento de containers.

<details>
<summary><strong>Ver estrutura de diretórios</strong></summary>

```text
.
├── backend/
│   ├── cmd/server/main.go           # Entrypoint, DI e graceful shutdown
│   ├── internal/
│   │   ├── adapter/                 # SQLite, driver PG, pg_dump/psql, AES-256-GCM, filestore
│   │   ├── config/                  # Leitura e validação de envs
│   │   ├── domain/                  # Entidades e interfaces (ports)
│   │   ├── transport/http/          # Handlers REST, middlewares e SPA fallback router
│   │   └── usecase/                 # Regras de negócio
│   └── web/                         # //go:embed all:dist (recebe o build do Next.js)
├── frontend/
│   └── src/                         # App Router Next.js, componentes e cliente HTTP
├── Dockerfile                       # Multi-stage build (Node -> Go -> Alpine + postgresql17-client)
└── docker-compose.yml
```
</details>

### Rodando a partir do Código-Fonte (Docker Build Local)

```bash
git clone [https://github.com/barbosasleonardo/dbclient.git](https://github.com/barbosasleonardo/dbclient.git)
cd dbclient
cp .env.example .env
# Defina DBCLIENT_ENCRYPTION_KEY no .env e execute:
docker compose up -d --build
```

### Ambiente de Desenvolvimento Local (Sem Docker)

**Pré-requisitos:** Go 1.23+, Node.js 22 LTS+, `psql` e `pg_dump` instalados no `PATH`.

```bash
# Terminal 1 — Backend (http://localhost:8080)
cd backend
export DBCLIENT_ENCRYPTION_KEY=$(openssl rand -base64 32)
export DBCLIENT_DATA_DIR=./data
export DBCLIENT_DUMP_DIR=/tmp/dbclient
mkdir -p data /tmp/dbclient
go run ./cmd/server

# Terminal 2 — Frontend com Hot Reload (http://localhost:3000)
cd frontend
npm install && npm run dev
```
---

## Licença

Distribuído sob a [licença MIT](LICENSE).
