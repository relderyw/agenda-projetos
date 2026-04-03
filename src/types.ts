// ─── Cadastros ────────────────────────────────────────────
export interface Theme {
  id: string;
  name: string;
  color: string;
}

export interface KnowledgeCategory {
  id: string;
  name: string;
  order: string | number;
  area?: 'T&P' | 'Projetos';
}

export interface KnowledgeActivity {
  id: string;
  categoryId: string;
  name: string;
  order: string | number;
}

export type KnowledgeStatus = 'checked' | 'x' | 'empty';

export interface KnowledgeProgress {
  userId: string;
  activityId: string;
  status: KnowledgeStatus;
}

export type HolidayType = 'Feriado' | 'S/ Expediente';

export interface Holiday {
  date: string; // YYYY-MM-DD
  description?: string;
  type: HolidayType;
}

export interface AppPermissions {
  view: boolean;
  edit: boolean;
  delete: boolean;
}

export interface UserPermissions {
  atividades: AppPermissions;
  henkatens: AppPermissions;
  cadastros: AppPermissions;
  usuarios: AppPermissions;
}

export type Role = 'Administrador' | 'Gestão' | 'Analista';

export interface User {
  id: string;
  name: string;
  role: string | Role;
  username?: string;
  email: string;
  color: string;
  area?: 'T&P' | 'Projetos'; // Novo campo para agrupamento
  password?: string;
  permissions?: UserPermissions;
}

// ─── Atividades ───────────────────────────────────────────
export type Priority = 'Alta' | 'Média' | 'Baixa';
export type Status = 'FINALIZADA' | 'PENDENTE' | 'EM ANDAMENTO' | 'POSTERGADA';

export interface Activity {
  id: string;
  planejamento: string;       // data planejada (YYYY-MM-DD)
  descricao: string;
  tema: string;               // ref Theme.id
  responsavel: string;        // ref User.id
  prioridade: Priority;
  dataPrevistaFinalizacao: string;
  percentualAndamento: number;
  dataFinalizada?: string;
  diasEsperadosConclusao: number;
  esforcoRealizado: number;
  status: Status;
  week: string;               // ex: "W2 - Mar"
  comentario?: string;
  dataComentario?: string;
}

// ─── App State ────────────────────────────────────────────
export type Tab = 'atividades' | 'dashboard' | 'cadastros' | 'kanban' | 'henkatens' | 'logs' | 'conhecimento';

// ─── Henkatens ──────────────────────────────────────────
export type HenkatenType =
  | 'PP1'
  | 'PP2'
  | 'MP'
  | 'TRY OUT';

export type HenkatenStatus = 'Planejado' | 'Confirmado' | 'Postergado' | 'Cancelado' | 'Sem Informação';

export interface HenkatenEvent {
  id: string;
  date: string;           // YYYY-MM-DD
  endDate?: string;       // YYYY-MM-DD (optional multi-day)
  type: HenkatenType;
  title: string;
  description?: string;
  responsible?: string;
  color?: string;         // override color
  status?: HenkatenStatus; // Status do evento
  postponedDate?: string;  // Nova data se postergado
}

// ─── Logs ──────────────────────────────────────────────
export interface LogEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;      // Ex: "Criou Atividade", "Editou Henkaten"
  target?: string;     // Ex: Descrição ou Título do item
  timestamp: string;   // ISO String
}
