import type { 
  Theme, User, Activity, HenkatenEvent, 
  KnowledgeCategory, KnowledgeActivity, KnowledgeProgress, Holiday 
} from './types';

// O arquivo data.ts agora contém apenas as estruturas vazias iniciais.
// O sistema buscará os dados reais diretamente do banco de dados (Supabase).

export const defaultThemes: Theme[] = [];
export const defaultUsers: User[] = [];
export const defaultActivities: Activity[] = [];
export const defaultHenkatens: HenkatenEvent[] = [];
export const defaultKnowledgeCategories: KnowledgeCategory[] = [];
export const defaultKnowledgeActivities: KnowledgeActivity[] = [];
export const defaultKnowledgeProgress: KnowledgeProgress[] = [];
export const defaultHolidays: Holiday[] = [];
