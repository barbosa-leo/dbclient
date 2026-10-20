# AGENTS.md — Diretrizes para Agentes de Código

Este documento define as regras estritas de operação, estilo, arquitetura e limites de escrita de código para agentes automatizados que operam neste repositório. O descumprimento de qualquer regra resultará em refatoração imediata. Requisitos de produto estão em [docs/project.md](docs/project.md).

---

## 1. Regras Estritas de Comentários e Documentação

* **Proibição de Comentários Óbvios / Ruído:** Nunca adicione comentários redundantes ou de cabeçalho em funções, métodos ou estruturas explicando o que o nome da função já deixa evidente (ex.: proibido inserir `// CreateUser cria um novo usuário no banco de dados` antes de `func (s *UserService) CreateUser(...)`).
* **Zero JSDoc/Godoc Trivial:** Não preencha tags de parâmetros ou retornos triviais que apenas repetem as assinaturas dos tipos estáticos da linguagem.
* **Código Autoexplicativo:** A intenção do código deve ser comunicada através de nomes expressivos, separação limpa de responsabilidades e early returns, não por comentários em prosa.
* **Única Exceção Aceita:** Comentários curtos são tolerados exclusivamente para justificar contornos de bugs upstream, decisões de negócio incomuns ou algoritmos não triviais (explicando **o porquê**, nunca **o que** o código faz).

---

## 2. Padrões de Código e Arquitetura

### Backend (Go) — Clean Architecture + SOLID
* **Regra de Dependência:** dependências apontam sempre para dentro: `transport → usecase → domain`. `domain` não importa nenhum outro pacote interno nem bibliotecas de infraestrutura.
* **Camadas:**
  * `domain`: entidades, erros de domínio e **interfaces (ports)** (ex.: `UserRepository`, `PasswordHasher`, `Cipher`, `DatabaseDriver`, `Dumper`, `ScriptRunner`, `FileStore`).
  * `usecase`: regras de negócio; dependem apenas de interfaces do `domain`.
  * `adapter`: implementações concretas (SQLite, PostgreSQL, bcrypt, AES-256-GCM, pg_dump/psql, sistema de arquivos). MySQL fora do escopo inicial.
  * `transport/http`: handlers apenas parseiam requests, chamam use cases e devolvem respostas padronizadas.
* **SOLID na prática:**
  * **S:** um use case por responsabilidade (ex.: `ExecuteQuery`, `ExportDump`, `RestoreDump`), sem "god services".
  * **O:** novos SGBDs (ex.: MySQL) entram como novo adapter de `DatabaseDriver`/`Dumper`, sem alterar use cases (sem `switch` por tipo de banco fora da factory).
  * **L:** todo adapter deve ser substituível sem quebrar o contrato da interface.
  * **I:** interfaces pequenas, definidas no lado do consumidor.
  * **D:** injeção de dependências via construtores; a composição (wiring) ocorre exclusivamente em `cmd/server/main.go`.
* **Padrão Go Idiomático:** tratamento explícito de erros logo após chamadas com falha potencial (`if err != nil { return ... }`). Não utilize `panic` para fluxo de controle. Propague `context.Context` em toda operação de I/O.
* **Persistência interna:** SQLite via driver puro Go (`modernc.org/sqlite`, sem CGO), modo WAL, migrations versionadas.
* **Logs:** apenas no terminal (stdout), estruturados com `log/slog`. Sem integração com serviços externos e sem persistência de logs no banco.
* **Health check:** `GET /healthz` público (fora do middleware de sessão), responde 200 quando a aplicação e o SQLite estão operacionais.

### Autenticação e Autorização
* Módulo próprio: sessão gerenciada pelo backend (cookie `HttpOnly`/`SameSite=Strict`, sem `Secure` por enquanto), expiração em `DBCLIENT_SESSION_TTL` (padrão 12h), senhas com bcrypt.
* Usuário `admin` inicial criado por migration, com troca de senha obrigatória no primeiro login.
* Papéis fixos da plataforma: `admin` (gerencia usuários e conexões) e `operator` (usa conexões: explorar, consultar, executar scripts e dumps). O que é permitido dentro do banco depende apenas dos privilégios do usuário da conexão; a plataforma não filtra SQL.
* Formulário de conexão: validação obrigatória no backend e no frontend; dados incompletos não são salvos.
* Autorização aplicada em middleware, nunca dentro dos handlers.

### Credenciais
* Senhas das conexões encriptadas em repouso com AES-256-GCM usando a chave da variável `DBCLIENT_ENCRYPTION_KEY` (32 bytes em base64). A aplicação não inicia sem ela.
* Credenciais nunca transitam em logs, respostas da API ou argumentos de linha de comando (usar `PGPASSWORD` no ambiente do processo filho).

### Dumps e Scripts SQL
* **Formato único:** apenas arquivos `.sql` em SQL puro (`pg_dump --format=plain`). Limite de tamanho (padrão 50 MB) para uploads e exportações, configurável na página de configurações (admin) e persistido na tabela `settings` do SQLite (populada por migration).
* **Editor de SQL:** máximo de 5000 caracteres por execução.
* **Streaming obrigatório:** dumps, uploads e scripts nunca são carregados inteiros em memória; usar `io.Reader`/`io.Writer` ponta a ponta.
* **Exportação:** executada via `pg_dump` como processo filho, gravando em `DBCLIENT_DUMP_DIR`; o usuário baixa o arquivo depois. Arquivos são temporários e podem ser perdidos ao reiniciar o container.
* **Importação/Scripts:** upload em streaming para `DBCLIENT_DUMP_DIR`, depois executado via `psql` com `--single-transaction` e `ON_ERROR_STOP=1` (dumps e scripts). Sem parser de statements nem validação prévia: em falha, a transação é revertida e o erro do banco é retornado.
* **Jobs assíncronos:** operações longas rodam como job com status (`pending`, `running`, `done`, `failed`), progresso e cancelamento via `context`.
* **Limpeza:** arquivos expirados (TTL configurável) são removidos periodicamente.
* **Auditoria:** toda execução de query, script ou dump é registrada em log estruturado no stdout (usuário, conexão, ação, status, duração).

### Frontend (Next.js)
* **Arquitetura de Componentes:** componentes focados e de responsabilidade única.
* **Clean Code & Tipagem:** TypeScript rigoroso; evitar `any`.
* **Build Estática:** exportação estática pura (`output: 'export'`), embutida no binário Go via `go:embed`; sem servidor Node.js em tempo de execução. Rotas não encontradas são resolvidas pelo SPA fallback do backend.

---

## 3. Variáveis de Ambiente

| Variável | Obrigatória | Padrão | Descrição |
|---|---|---|---|
| `DBCLIENT_ENCRYPTION_KEY` | sim | — | Chave AES-256 (base64) para credenciais das conexões |
| `DBCLIENT_ADDR` | não | `:8080` | Endereço HTTP |
| `DBCLIENT_DATA_DIR` | não | `/data` | Diretório do arquivo SQLite (volume persistente) |
| `DBCLIENT_DUMP_DIR` | não | `/tmp/dbclient` | Diretório temporário de dumps e scripts |
| `DBCLIENT_DUMP_TTL` | não | `24h` | Tempo até remoção de arquivos temporários |
| `DBCLIENT_SESSION_TTL` | não | `12h` | Duração da sessão |

---

## 4. Estrutura de Pastas Esperada

```text
.
├── backend/
│   ├── cmd/
│   │   └── server/
│   │       └── main.go           # Composição de dependências e inicialização
│   ├── internal/
│   │   ├── domain/               # Entidades, erros e interfaces (ports)
│   │   ├── usecase/              # auth, user, connection, explorer, query, script, dump
│   │   ├── adapter/
│   │   │   ├── sqlite/           # Repositórios internos + migrations
│   │   │   ├── dbdriver/         # postgres (implementa DatabaseDriver)
│   │   │   ├── dumper/           # pg_dump/psql
│   │   │   ├── filestore/        # Arquivos temporários em DBCLIENT_DUMP_DIR
│   │   │   └── crypto/           # Hash de senhas e cifra de credenciais
│   │   ├── transport/
│   │   │   └── http/
│   │   │       ├── handler/      # auth, users, connections, explorer, query, script, dump, health
│   │   │       ├── middleware/   # Sessão, autorização por papel, logging
│   │   │       └── router.go     # Rotas da API e SPA fallback
│   │   └── config/               # Variáveis de ambiente
│   ├── web/
│   │   ├── dist/                 # Build do frontend (copiada no Docker build); apenas .gitkeep versionado
│   │   └── ui.go                 # //go:embed all:dist
│   ├── go.mod
│   └── go.sum
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── app/                  # Rotas (App Router)
│   │   ├── components/
│   │   ├── services/             # Cliente da API do backend
│   │   └── styles/
│   ├── package.json
│   ├── package-lock.json
│   └── next.config.js            # output: 'export'
├── docs/
│   └── project.md
├── AGENTS.md
├── .dockerignore
├── .gitignore
├── docker-compose.yml
└── Dockerfile                    # Multi-stage: Node build -> Go compile -> runner
```