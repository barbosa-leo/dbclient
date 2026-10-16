# DBClient — Documento do Projeto

## 1. Visão Geral
Aplicação web para gerenciamento e exploração de bancos de dados PostgreSQL, distribuída como um único container Docker. Diretrizes de implementação em [AGENTS.md](../AGENTS.md).

> MySQL está fora do escopo inicial. A arquitetura (`DatabaseDriver`, `Dumper`) permite adicioná-lo depois sem alterar as regras de negócio.

## 2. Arquitetura
- **Backend:** Go (autenticação, usuários, conexões, execução de SQL, scripts e dumps), seguindo Clean Architecture e SOLID.
- **Frontend:** Next.js com exportação estática, embutida no binário Go via `go:embed`.
- **Persistência interna:** SQLite (usuários e conexões) em volume persistente.
- **Arquivos temporários:** dumps e scripts em diretório temporário do container.
- **Empacotamento:** um único container (Dockerfile multi-stage), sem dependência de serviços externos.

## 3. Requisitos Não Funcionais
- **Portabilidade via Web:** compatível com os principais navegadores.
- **Instância única:** um único container; sem escala horizontal (restrição do SQLite local).
- **Capacidade:** até 100 usuários simultâneos.
- **Persistência:** o SQLite reside em volume montado e sobrevive à recriação do container. Arquivos de dump **não** são persistentes.
- **Segurança:** autenticação própria; senhas de usuários com bcrypt; senhas de conexões encriptadas com a chave em `DBCLIENT_ENCRYPTION_KEY`.
- **Sessão:** expira em 12 horas (configurável).
- **Streaming:** dumps e scripts processados sem carregar o arquivo inteiro em memória.
- **Limite de arquivos:** 50 MB por dump ou script (configurável).
- **Resiliência:** conexões com timeout; operações longas canceláveis.
- **Logs:** apenas no terminal (stdout), incluindo o registro de execuções (usuário, conexão, ação, status, duração). Nada é persistido no banco.
- **Health check:** endpoint público `GET /healthz`.

## 4. Requisitos Funcionais
- **Autenticação:** login, logout e sessão gerenciados pelo backend.
- **Usuário inicial:** criado por migration (`admin`), com troca de senha obrigatória no primeiro login.
- **Papéis da plataforma:**
  - `admin`: gerencia usuários e conexões, além de todas as permissões de `operator`.
  - `operator`: usa as conexões cadastradas (explorar, consultar, executar scripts e dumps).
  - O que cada um pode fazer **dentro** de um banco é definido exclusivamente pelos privilégios do usuário do banco cadastrado na conexão. A plataforma não restringe comandos SQL.
- **Gerenciamento de Usuários:** CRUD de usuários (somente `admin`).
- **Gerenciamento de Conexões:** cadastro com Nome, Host, Porta, Database, Usuário, Senha (encriptada) e modo SSL. O formulário só permite salvar com todos os campos obrigatórios válidos; dados incompletos retornam erro de validação.
- **Explorador de Banco de Dados:** visualização de schemas e tabelas.
- **Editor de SQL:** digitação e execução de consultas, com limite de **5000 caracteres** por execução e resultados paginados.
- **Scripts SQL:** upload de arquivos `.sql` (até 50 MB) executados em uma única transação. Sem validação prévia: em caso de falha, a execução é revertida e o erro do banco é retornado.
- **Dumps (apenas `.sql`, formato SQL puro):**
  - **Exportação:** gera o arquivo em diretório temporário; o usuário baixa quando concluído. A exportação é abortada se o arquivo ultrapassar 50 MB.
  - **Importação:** upload de arquivo `.sql` (até 50 MB) e restauração na conexão escolhida.
  - Operações executadas como jobs assíncronos, com status, progresso e cancelamento.
  - Arquivos temporários expiram após um TTL e podem ser perdidos se o container reiniciar.