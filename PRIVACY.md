# Política de Privacidade

Última atualização: 29 de outubro de 2026

O DBClient é um software de código aberto que você instala e opera por conta própria, seja como container (versão web) ou como aplicativo para macOS e Windows. Esta política descreve quais dados o software guarda, onde eles ficam e quais conexões externas ele faz.

## Resumo

- O autor do DBClient **não coleta, não recebe e não tem acesso** a nenhum dado seu.
- Não há telemetria, analytics, rastreamento ou relatórios de erro enviados para fora.
- Tudo o que o DBClient guarda fica na própria instalação, sob controle de quem a opera.
- A única conexão externa automática é a consulta de versões no GitHub.

## Dados guardados na instalação

O DBClient guarda em um banco SQLite local:

- **Usuários da plataforma:** nome, e-mail, papel e hash da senha (bcrypt). No app desktop, existe apenas o administrador local.
- **Sessões:** identificadores de sessão e suas datas de expiração.
- **Ambientes e conexões:** nome, host, porta, database, usuário e senha dos bancos cadastrados. As senhas são cifradas com AES-256-GCM, usando uma chave que nunca sai da instalação.
- **Histórico de execuções:** texto completo das consultas executadas no editor SQL e metadados de scripts e dumps (usuário, conexão, status e duração). Pode ser desativado, e os registros são removidos após o prazo de retenção (padrão de 7 dias), ambos ajustáveis na página de configurações.
- **Configurações e novidades:** limites de arquivos, retenção do histórico e quais versões cada usuário já viu.

Além disso:

- **Arquivos temporários:** dumps exportados e scripts enviados ficam no diretório temporário da instalação e são removidos automaticamente após o prazo configurado (padrão de 24 horas). Dumps contêm os dados do banco exportado.
- **Logs:** cada execução de consulta, script ou dump gera um registro de auditoria (usuário, conexão, ação, status e duração), sem senhas. Na versão web, os logs vão apenas para a saída do container. No app desktop, são gravados em uma pasta de logs local.
- **Navegador:** o tema escolhido, o ambiente e a conexão selecionados e uma cópia temporária da lista de versões ficam no `localStorage` do navegador ou do app.

### Onde ficam no app desktop

- **macOS:** o banco fica em `~/Library/Application Support/DBClient`, os logs em `~/Library/Logs/DBClient` e os arquivos temporários em `~/Library/Caches/DBClient`; as pastas de dados e de logs podem ser abertas pelo menu Ajuda. A chave de criptografia fica no Keychain do macOS.
- **Windows:** tudo fica em `%LOCALAPPDATA%\DBClient`. A chave de criptografia é protegida pelo DPAPI do Windows, de modo que só a sua conta, nesse computador, consegue usá-la.

Para apagar todos os dados do app desktop, remova essas pastas e, no macOS, o item "DBClient" do Keychain.

## Conexões externas

O DBClient se conecta apenas a:

- **Bancos de dados cadastrados por você**, com as credenciais que você informou.
- **GitHub (`api.github.com`)**, ao carregar a interface, para listar as versões publicadas e indicar se há atualização. A resposta fica em cache no navegador por algum tempo. Nessa consulta, o GitHub recebe as informações comuns de qualquer requisição web, como o endereço IP e o tipo de navegador; nenhum dado da instalação é enviado.
- **GitHub (`github.com`)**, no app desktop, apenas quando você clica em **Atualizar**, para baixar o instalador da nova versão.

O tratamento dessas requisições pelo GitHub segue a [Declaração de Privacidade do GitHub](https://docs.github.com/pt/site-policy/privacy-policies/github-general-privacy-statement).

## Quem é responsável pelos dados

Como o DBClient roda na sua infraestrutura ou no seu computador, quem instala e opera a instância é o responsável pelos dados nela guardados, inclusive perante a LGPD. Em instalações compartilhadas, o administrador define quem tem acesso, por quanto tempo o histórico é mantido e como os backups são feitos.

## Alterações

Mudanças nesta política são publicadas neste arquivo, no repositório do projeto, e registradas no histórico de versões.

## Contato

Dúvidas sobre esta política podem ser enviadas como [issue no repositório](https://github.com/barbosa-leo/dbclient/issues).
