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
- **Limpeza Periódica:** rotina em background a cada 5 minutos que expira arquivos temporários, sessões, jobs encerrados em memória e histórico de execuções com base nas políticas de retenção configuradas.
- **Logs:** apenas no terminal (stdout), incluindo o registro estruturado de execuções.
- **Health check:** endpoint público `GET /healthz`.

## 4. Requisitos Funcionais
- **Autenticação:** login por e-mail, logout e sessão gerenciados pelo backend.
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
- **Novidades:** página com as mudanças de cada versão, agrupadas por versão e por categoria (novo, melhorias, correções). O conteúdo fica em `frontend/src/components/updates/releases.json`, embutido no build, e é completado pelos GitHub Releases do repositório, de modo que uma instalação antiga também vê as versões mais novas. As versões já vistas por cada usuário ficam na tabela `update_views` do SQLite. Ao abrir a página, só a versão instalada e as anteriores são marcadas como vistas; versões mais novas que a instalada continuam em destaque, e o menu mantém o indicador, até o usuário atualizar.
- **Publicação de versão:** a tag `vX.Y.Z` precisa coincidir com a versão de `frontend/package.json` e ter uma entrada em `releases.json`; o workflow de release usa essa entrada como texto do GitHub Release e publica, junto com os instaladores, o `SHA256SUMS` exigido pela atualização dentro do app desktop.

## 5. App Desktop (modo local)
Distribuição nativa para uso individual (macOS e Windows), em [desktop/](../desktop/). Um shell nativo executa o mesmo servidor como processo filho e exibe a interface em uma janela própria.
- **Modo local:** o servidor do app desktop é compilado com a build tag `desktop` e iniciado com `DBCLIENT_AUTH_MODE=local`. A build web/Docker não contém esse modo e recusa iniciar se ele for solicitado.
- **Acesso:** sem tela de login, sem gerenciamento de usuários e sem logout. O usuário atua como o `admin` inicial; ambientes, conexões, configurações, consultas, scripts e dumps seguem as mesmas regras do papel `admin`.
- **Autenticação transparente:** a cada execução, o shell gera um token aleatório (`DBCLIENT_LOCAL_TOKEN`) e abre `GET /api/auth/local?token=…`, que cria uma sessão comum (cookie `HttpOnly`/`SameSite=Strict`). Middleware, autorização e auditoria permanecem os mesmos da web.
- **Isolamento:** o modo local só aceita endereço de loopback (`127.0.0.1`); rotas de login, troca de senha e usuários não são registradas.
- **Credenciais do admin:** no primeiro acesso local, a troca de senha obrigatória é dispensada e a senha padrão é substituída por uma aleatória, para que o banco copiado para uma instalação web não carregue a senha `admin`.
- **Atualização:** quando há versão mais nova, a página de novidades oferece um botão que chama o shell nativo (sem passar pelo backend). No Windows, o shell baixa o instalador do GitHub Release, confere o SHA-256 publicado em `SHA256SUMS` e reinstala o app em modo silencioso, reabrindo-o; no macOS, baixa e confere o DMG e o abre para o usuário substituir o app. Na versão web, a página apenas recomenda o deploy da nova imagem.
- **Ferramentas do PostgreSQL:** os apps embutem o `pg_dump` e o `psql` (PostgreSQL 18), de modo que scripts e dumps funcionam sem instalar nada na máquina. O shell coloca essa pasta no início do `PATH` do servidor; uma instalação local fica como alternativa. Servidores mais novos que a versão embutida exigem atualizar o pacote.
