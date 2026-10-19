# DBClient

DBClient é um cliente web moderno, leve e seguro para gerenciamento e exploração de bancos de dados PostgreSQL. Ele é distribuído como um binário único e autossuficiente em Go que incorpora toda a aplicação frontend (Next.js estático) e um banco SQLite interno para armazenamento de configurações, operando em um único container Docker.

---

## Sumário

- [Visão Geral e Arquitetura](#visão-geral-e-arquitetura)
- [Estrutura de Diretórios](#estrutura-de-diretórios)
- [Como o Frontend é Montado e Utilizado](#como-o-frontend-é-montado-e-utilizado)
- [Alertas Críticos de Segurança e Secrets](#alertas-críticos-de-segurança-e-secrets)
- [Alertas de Volumes e Persistência](#alertas-de-volumes-e-persistência)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Como Rodar com Docker Compose](#como-rodar-com-docker-compose)
- [Como Construir e Publicar a Imagem](#como-construir-e-publicar-a-imagem)
- [Como Rodar Localmente (Desenvolvimento)](#como-rodar-localmente-desenvolvimento)
- [Credenciais Iniciais e Primeiro Acesso](#credenciais-iniciais-e-primeiro-acesso)
- [Recursos Principais](#recursos-principais)

---

## Visão Geral e Arquitetura

O DBClient foi projetado com os seguintes pilares arquiteturais:

- **Binário Único sem Runtime Node.js:** O frontend em Next.js é exportado como arquivos HTML/CSS/JS estáticos puros (`output: 'export'`) e embutido diretamente no binário Go através de `go:embed`. Não há necessidade de servidor Node.js em produção.
- **Backend em Go (Clean Architecture + SOLID):**
  - `domain`: Entidades puras, regras de negócio elementares e interfaces (ports). Não depende de bibliotecas externas de infraestrutura.
  - `usecase`: Casos de uso específicos (autenticação, conexões, queries, dumps, scripts).
  - `adapter`: Implementações de infraestrutura (SQLite sem CGO via `modernc.org/sqlite`, driver PostgreSQL nativo, subprocessos `pg_dump`/`psql`, criptografia AES-256-GCM, sistema de arquivos).
  - `transport/http`: Roteador HTTP padrão com middleware de sessão, autorização por papel e servidor SPA com fallback estático.
- **Persistência Interna em SQLite:** Usuários, papéis, ambientes e conexões são armazenados em um banco SQLite com modo WAL ativado, salvo no diretório `/data`.
- **Logs Estruturados:** Logs operacionais e de auditoria direcionados exclusivamente ao terminal (`stdout`) via `log/slog`. Nenhuma credencial trafega em logs.

---

## Estrutura de Diretórios

```text
.
├── backend/
│   ├── cmd/
│   │   └── server/
│   │       └── main.go                  # Ponto de entrada, injeção de dependências e graceful shutdown
│   ├── internal/
│   │   ├── adapter/
│   │   │   ├── crypto/                  # Hash de senhas (bcrypt) e cifra de credenciais (AES-256-GCM)
│   │   │   ├── dbdriver/                # Driver PostgreSQL para inspeção de esquemas e execução SQL
│   │   │   ├── dumper/                  # Integração via streaming com pg_dump e psql
│   │   │   ├── filestore/               # Gerenciador de arquivos temporários de dumps/scripts
│   │   │   └── sqlite/                  # Migrations e repositórios internos (users, connections, etc.)
│   │   ├── config/                      # Leitura e validação de variáveis de ambiente
│   │   ├── domain/                      # Entidades de domínio e interfaces (ports)
│   │   ├── transport/
│   │   │   └── http/
│   │   │       ├── handler/             # Handlers HTTP REST
│   │   │       ├── middleware/          # Sessão (cookie), autorização (papéis) e logging
│   │   │       └── router.go            # Mux de rotas API e handler SPA fallback
│   │   └── usecase/                     # Regras de negócio da aplicação
│   ├── web/
│   │   ├── dist/                        # Diretório onde os arquivos gerados do frontend são copiados
│   │   └── ui.go                        # //go:embed all:dist para embutir o frontend estático
│   ├── go.mod
│   └── go.sum
├── frontend/
│   ├── public/                          # Assets estáticos
│   ├── src/
│   │   ├── app/                         # Rotas (App Router Next.js estático)
│   │   │   ├── (app)/                   # Rotas autenticadas (explorer, query, scripts, dumps, etc.)
│   │   │   ├── login/                   # Rota de login público
│   │   │   ├── layout.tsx               # Root layout com meta tags e viewport
│   │   │   └── globals.css              # Tailwind CSS v4 e temas
│   │   ├── components/                  # Componentes reutilizáveis (UI, layout, forms, tables)
│   │   └── services/                    # Cliente de API e chamadas fetch
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   └── next.config.ts                   # Configurado com output: 'export'
├── docs/
│   └── project.md                       # Especificação detalhada de produto e requisitos
├── Dockerfile                           # Build multi-stage (Node -> Go -> Alpine com postgresql-client)
├── docker-compose.yml                   # Exemplo de orquestração pronta para uso
├── .env.example                         # Exemplo de configuração de variáveis
└── README.md
```

---

## Como o Frontend é Montado e Utilizado

1. **Build Estática (Next.js):**
   - O frontend utiliza o App Router do Next.js com a configuração `output: 'export'` no `next.config.ts`.
   - Durante a compilação (`npm run build`), o Next.js gera uma pasta `out/` contendo arquivos HTML, CSS, JavaScript e assets totalmente estáticos.
2. **Embutido no Binário Go (`go:embed`):**
   - No `Dockerfile`, os arquivos compilados da pasta `out/` são copiados para `backend/web/dist/`.
   - O arquivo `backend/web/ui.go` possui a diretiva `//go:embed all:dist`, incluindo todos os assets dentro do binário compilado.
3. **Serviço SPA e Fallback:**
   - O backend Go serve os arquivos estáticos diretamente na raiz `/`.
   - Caso uma URL interna da aplicação seja acessada diretamente (ex.: `/explorer`, `/query`), o router do Go verifica a ausência do arquivo físico e serve o arquivo HTML correspondente ou o `index.html` raiz, permitindo que a navegação do lado do cliente funcione perfeitamente sem erros 404.
4. **Responsividade Completa:**
   - A interface possui design responsivo adaptado para Desktop, Tablet e Mobile:
     - Telas `< 1024px`: Navegação via gaveta lateral off-canvas (drawer) e seletor de conexão na barra superior.
     - Telas `< 768px`: Listagens de conexões, usuários e dumps convertidas automaticamente em cards visuais.
     - Tabelas de dados e estrutura com rolagem horizontal contida e alvos de toque otimizados para touch.

---

## Alertas Críticos de Segurança e Secrets

> [!CAUTION]
> **A variável `DBCLIENT_ENCRYPTION_KEY` é estritamente obrigatória e nunca deve ser perdida ou alterada após o primeiro uso.**
> 
> - As senhas das conexões cadastradas no banco de dados são encriptadas em repouso utilizando **AES-256-GCM**.
> - Se o container iniciar sem esta variável, a aplicação abortará a inicialização imediatamente com erro.
> - Se a chave for alterada após conexões terem sido cadastradas, o DBClient **não conseguirá decifrar as senhas existentes**, impossibilitando conectar aos bancos configurados.
> - Faça backup seguro dessa chave junto aos backups do volume de dados.

### Como gerar a chave de criptografia

Execute o comando abaixo no terminal para gerar uma chave aleatória válida de 32 bytes codificada em Base64:

```bash
openssl rand -base64 32
```

Copie a saída gerada e defina-a na variável `DBCLIENT_ENCRYPTION_KEY` do seu arquivo `.env`.

---

## Alertas de Volumes e Persistência

> [!WARNING]
> **Persistência de Dados (`/data`):**
> O SQLite reside no caminho `/data/dbclient.db`. É fundamental montar um volume persistente (ex.: `dbclient-data:/data`) no container. Sem este volume, todos os usuários criados, ambientes e conexões cadastradas serão perdidos caso o container seja recriado.

> [!NOTE]
> **Arquivos Temporários de Dumps e Scripts (`/tmp/dbclient`):**
> Os arquivos gerados durante exportações de dumps ou uploads de scripts são salvos no diretório temporário `/tmp/dbclient`.
> - Esses arquivos são **intencionalmente efêmeros** e não devem ser montados em volume permanente.
> - Eles são excluídos automaticamente após o tempo configurado em `DBCLIENT_DUMP_TTL` (padrão: `24h`) ou ao reiniciar o container.
> - Para manter dumps permanentemente, o usuário deve baixá-los pelo navegador após a conclusão da exportação.

---

## Variáveis de Ambiente

| Variável | Obrigatória | Padrão | Descrição |
|---|---|---|---|
| `DBCLIENT_ENCRYPTION_KEY` | **Sim** | — | Chave AES-256 (32 bytes em Base64) para cifrar credenciais em repouso |
| `DBCLIENT_ADDR` | Não | `:8080` | Endereço e porta em que o servidor HTTP responderá |
| `DBCLIENT_DATA_DIR` | Não | `/data` | Diretório onde o banco de dados interno SQLite é armazenado |
| `DBCLIENT_DUMP_DIR` | Não | `/tmp/dbclient` | Diretório temporário para processamento de dumps e scripts |
| `DBCLIENT_DUMP_TTL` | Não | `24h` | Tempo de vida (TTL) até a exclusão automática de arquivos temporários |
| `DBCLIENT_SESSION_TTL` | Não | `12h` | Duração do cookie de sessão autenticada |
| `DBCLIENT_MAX_FILE_SIZE` | Não | `52428800` | Tamanho máximo em bytes para scripts e dumps (52428800 = 50 MB) |

---

## Como Rodar com Docker Compose

Esta é a forma recomendada de executar o DBClient em produção ou em ambiente de desenvolvimento.

### 1. Criar o arquivo `.env`

Crie um arquivo `.env` na mesma pasta do seu `docker-compose.yml`:

```env
# Gerada com: openssl rand -base64 32
DBCLIENT_ENCRYPTION_KEY=SuaChaveBase64De32BytesAquiExatamente=

# Opcionais (valores padrão já pré-configurados)
DBCLIENT_DUMP_TTL=24h
DBCLIENT_SESSION_TTL=12h
DBCLIENT_MAX_FILE_SIZE=52428800
```

### 2. Exemplo de `docker-compose.yml`

O compose abaixo utiliza a imagem oficial publicada no Docker Hub (`barbosasleonardo/dbclient:latest`):

```yaml
services:
  dbclient:
    image: barbosasleonardo/dbclient:latest
    container_name: dbclient
    restart: unless-stopped
    ports:
      - "8080:8080"
    extra_hosts:
      # Permite que o container acerte bancos PostgreSQL rodando na máquina host (host.docker.internal)
      - "host.docker.internal:host-gateway"
    environment:
      DBCLIENT_ENCRYPTION_KEY: ${DBCLIENT_ENCRYPTION_KEY:?Defina DBCLIENT_ENCRYPTION_KEY no arquivo .env}
      DBCLIENT_DUMP_TTL: ${DBCLIENT_DUMP_TTL:-24h}
      DBCLIENT_SESSION_TTL: ${DBCLIENT_SESSION_TTL:-12h}
      DBCLIENT_MAX_FILE_SIZE: ${DBCLIENT_MAX_FILE_SIZE:-52428800}
    volumes:
      - dbclient-data:/data

volumes:
  dbclient-data:
```

### 3. Executando o Container

Inicie a aplicação em segundo plano:

```bash
docker compose up -d
```

Verifique se o container está saudável:

```bash
docker compose ps
docker compose logs -f
```

Acesse no seu navegador: `http://localhost:8080`.

> [!TIP]
> **Conectando a um PostgreSQL na sua máquina local:**
> Graças à linha `extra_hosts` configurada com `host.docker.internal:host-gateway`, ao cadastrar uma conexão no DBClient para um PostgreSQL que roda diretamente na sua máquina de desenvolvimento, informe no campo Host:
> ```text
> host.docker.internal
> ```

---

## Como Construir e Publicar a Imagem

O repositório inclui um `Dockerfile` multi-stage otimizado que produz uma imagem final mínima baseada em Alpine Linux com os clientes nativos do PostgreSQL (`postgresql17-client`) instalados.

### Compilar localmente

```bash
docker build -t barbosasleonardo/dbclient:latest .
```

### Publicar no Docker Hub

```bash
docker push barbosasleonardo/dbclient:latest
```

---

## Como Rodar Localmente (Desenvolvimento)

Para desenvolver ou depurar partes da aplicação sem container Docker:

### Pré-requisitos
- **Go:** versão 1.23 ou superior.
- **Node.js:** versão 20 ou superior (Node 22 LTS recomendado) e npm.
- **Ferramentas PostgreSQL:** `psql` e `pg_dump` instalados e acessíveis no `PATH` da máquina para execução de scripts e dumps.

### Passo 1: Rodar o Backend
```bash
cd backend
export DBCLIENT_ENCRYPTION_KEY=$(openssl rand -base64 32)
export DBCLIENT_DATA_DIR=./data
export DBCLIENT_DUMP_DIR=/tmp/dbclient
mkdir -p data /tmp/dbclient

go run ./cmd/server
```
O servidor iniciará em `http://localhost:8080`.

### Passo 2: Rodar o Frontend (com Hot Reload)
Em outro terminal:
```bash
cd frontend
npm install
npm run dev
```
O frontend Next.js iniciará em `http://localhost:3000` consumindo os endpoints do backend.

---

## Credenciais Iniciais e Primeiro Acesso

Ao iniciar a aplicação pela primeira vez em um volume novo, as migrations internas do SQLite criam o usuário administrador padrão:

- **Usuário:** `admin`
- **Senha temporária:** `admin`

> [!IMPORTANT]
> **Troca Obrigatória de Senha:**
> No primeiro login, o sistema detecta a credencial temporária e exige imediatamente a definição de uma nova senha forte antes de liberar o acesso às demais áreas da plataforma.

### Papéis de Acesso

| Papel | Permissões |
|---|---|
| `admin` | Gerencia usuários da plataforma, cria e altera conexões/ambientes, executa queries, scripts e exportação/importação de dumps. |
| `operator` | Utiliza as conexões configuradas: explora schemas e tabelas, executa queries no editor SQL, roda scripts `.sql` e executa rotinas de dump. |
| `viewer` | Visualiza ambientes e conexões e executa consultas somente-leitura nas conexões liberadas. |

---

## Recursos Principais

- **Explorador Visual:** Navegação em árvore por Schemas, Tabelas, Views, Procedures, Functions e Triggers, com visualização de estrutura, chaves estrangeiras e índices.
- **Editor SQL:** Consultas rápidas com histórico, formatação, atalhos de teclado (Ctrl/⌘ + Enter), destaque de sintaxe e paginação automática por tamanho de tela.
- **Execução de Scripts:** Upload e execução de arquivos `.sql` em transação única (`ON_ERROR_STOP=1`). Se qualquer comando falhar, as modificações são canceladas automaticamente.
- **Dumps em Streaming:** Exportação e restauração de dumps sem sobrecarregar a memória RAM do servidor, com acompanhamento de progresso em tempo real e cancelamento assíncrono.
- **Healthcheck:** Endpoint público `GET /healthz` para orquestradores de containers e load balancers verificarem a disponibilidade da aplicação e integridade do banco SQLite.
