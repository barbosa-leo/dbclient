# DBClient — Documento do Projeto

## 1. Visão Geral
Aplicação web para gerenciamento e exploração de bancos de dados PostgreSQL, distribuída como um único container Docker. Diretrizes de implementação em [AGENTS.md](../AGENTS.md).

> MySQL está fora do escopo inicial. A arquitetura (`DatabaseDriver`, `Dumper`) permite adicioná-lo depois sem alterar as regras de negócio.

## 2. Arquitetura
- **Backend:** Go (autenticação, usuários, ambientes, conexões, execução de SQL, scripts e dumps), seguindo Clean Architecture e SOLID.
- **Frontend:** Next.js com exportação estática, embutida no binário Go via `go:embed`.
- **Persistência interna:** SQLite (usuários, ambientes, conexões, configurações e histórico de execução) em volume persistente.
- **Arquivos temporários:** dumps e scripts em diretório temporário do container.
- **Empacotamento:** um único container (Dockerfile multi-stage), sem dependência de serviços externos.

## 3. Requisitos Não Funcionais
- **Portabilidade via Web:** compatível com os principais navegadores.
- **Instância única:** um único container; sem escala horizontal (restrição do SQLite local).
- **Capacidade:** até 100 usuários simultâneos.
- **Persistência:** o SQLite reside em volume montado e sobrevive à recriação do container. Arquivos de dump **não** são persistentes.
- **Segurança:**
  - Autenticação própria com senhas em bcrypt.
  - Senhas de conexões encriptadas com AES-256-GCM usando a chave em `DBCLIENT_ENCRYPTION_KEY`.
  - Senha inicial do administrador configurável via `DBCLIENT_INITIAL_ADMIN_PASSWORD` (padrão `admin`).
  - No Docker Compose, a porta da aplicação faz bind em `127.0.0.1:${DBCLIENT_PORT_APP:-8080}:8080`.
  - Rate limiting na API com baldes separados (60 req/min para consultas, 120 req/min geral, 10 req/min login) e suporte a validação de proxies confiáveis via `DBCLIENT_TRUSTED_PROXIES`.
- **Sessão:** expira em 12 horas (configurável via `DBCLIENT_SESSION_TTL`).
- **Streaming:** dumps e scripts processados sem carregar o arquivo inteiro em memória.
- **Limite de arquivos:** configurável na página de configurações do sistema (padrão 50 MB), persistido no SQLite.
- **Resiliência:** conexões com timeout; consultas encerram o cursor do PostgreSQL imediatamente ao atingir o limite; operações longas canceláveis.
- **Limpeza Periódica:** rotina em background que expira arquivos temporários, sessões e jobs encerrados em memória com base em `DBCLIENT_DUMP_TTL`.
- **Logs:** apenas no terminal (stdout), incluindo o registro estruturado de execuções.
- **Health check:** endpoint público `GET /healthz`.

## 4. Requisitos Funcionais
- **Autenticação:** login (por e-mail ou username `admin`), logout e sessão gerenciados pelo backend.
- **Usuário inicial:** criado por migration (`admin@dbclient.local`), com troca de senha obrigatória no primeiro login.
- **Papéis da plataforma:**
  - `admin`: gerencia usuários, ambientes, configurações e conexões; tem permissão de testar novas conexões livres; gerencia todos os jobs e execuções.
  - `operator`: explora schemas e tabelas das conexões liberadas, executa queries no editor SQL, roda scripts `.sql` e executa rotinas de dump (acessa apenas seus próprios jobs).
  - `viewer`: visualiza ambientes e conexões liberadas, navega no explorador e executa consultas somente-leitura.
- **Gerenciamento de Ambientes e Usuários:** CRUD de ambientes e usuários com associação granular de ambientes liberados por usuário.
- **Gerenciamento de Conexões:** cadastro com Nome, Ambiente, Host, Porta, Database, Usuário, Senha (encriptada) e modo SSL. O formulário só permite salvar com todos os campos obrigatórios válidos. Teste de novas conexões livre restrito a administradores.
- **Explorador de Banco de Dados:** navegação em árvore por schemas, tabelas, views, procedures, functions e triggers. Identificação inequívoca de funções sobrecarregadas (com assinatura de argumentos) e triggers (com tabela associada).
- **Editor de SQL:** digitação e execução de consultas com autocomplete contextual, histórico de execuções e paginação inteligente.
- **Scripts SQL:** upload de arquivos `.sql` executados em uma única transação (`ON_ERROR_STOP=1`).
- **Dumps (apenas `.sql`, formato SQL puro):**
  - **Exportação:** executada via `pg_dump` como job assíncrono isolado pelo usuário solicitante.
  - **Importação:** upload e restauração via `psql` como job assíncrono associado ao usuário solicitante.
