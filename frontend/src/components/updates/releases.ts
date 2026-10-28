export type ChangeCategory = 'new' | 'improved' | 'fixed';

export interface Release {
  version: string;
  date: string;
  changes: Partial<Record<ChangeCategory, string[]>>;
}

export const changeCategories: { key: ChangeCategory; label: string }[] = [
  { key: 'new', label: 'Novo' },
  { key: 'improved', label: 'Melhorias' },
  { key: 'fixed', label: 'Correções' },
];

// Newest first; each release lists only what a user would notice, not internal refactors.
export const releases: Release[] = [
  {
    version: '0.1.0',
    date: '2026-10-28',
    changes: {
      new: [
        'Apps nativos para macOS e Windows, sem tela de login e com os dados guardados no próprio computador.',
        'pg_dump e psql embutidos nos apps desktop: scripts e dumps funcionam sem instalar o PostgreSQL.',
        'Editor SQL com destaque de sintaxe, autocomplete contextual e execução em transação com rollback em caso de erro.',
        'Explorador de schemas com edição de estrutura de tabelas, chaves estrangeiras, índices e definições de objetos.',
        'Navegação direta entre tabelas pelas chaves estrangeiras.',
        'Tabela de resultados com ordenação, filtros, edição de células, colunas redimensionáveis e cópia em vários formatos.',
        'Execução de scripts SQL e exportação/importação de dumps em segundo plano, com progresso e cancelamento.',
        'Histórico de execuções com retenção configurável.',
        'Ambientes de conexão com visibilidade por usuário e teste de conexão antes de salvar.',
        'Papéis de administrador, operador e somente leitura, com login por e-mail.',
        'Página de configurações para limites de arquivos e histórico.',
        'Página de novidades.',
      ],
      improved: [
        'Interface responsiva, com navegação em gaveta e ações de toque no celular.',
        'Temas claro e escuro.',
      ],
    },
  },
];
