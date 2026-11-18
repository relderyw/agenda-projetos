// ─── Multi-Tenancy ────────────────────────────────────────
export interface Organization {
  id: string;
  name: string;
  slug: string;
}

export interface OrgSector {
  id: string;
  organization_id: string;
  name: string;
  color: string;
}

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
  area?: string; // Setor/área da organização (dinâmico)
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

// ─── Feedback de Analista (Matriz de Competência) ──────────
export type FeedbackImpact = 'Positivo' | 'Negativo' | 'Sem Impacto';

export interface AnalystFeedback {
  id: string;
  analystId: string;
  authorId: string;
  authorName: string;
  date: string;       // YYYY-MM-DD - data do relato
  comment: string;
  impact: FeedbackImpact;
  createdAt: string;
  organization_id?: string;
}

export type HolidayType = 'Feriado' | 'S/ Expediente';

export interface Holiday {
  id?: string;
  date: string; // YYYY-MM-DD
  description?: string;
  type: HolidayType;
  organization_id?: string;
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
  conhecimentoTP: AppPermissions;
  conhecimentoProj: AppPermissions;
  absenteismo?: AppPermissions;
  quadroPessoal?: AppPermissions;
  budget?: AppPermissions;
}

export type Role = 'Super Admin' | 'Administrador' | 'Gestão' | 'Analista';

export interface User {
  id: string;
  name: string;
  role: string | Role;
  username?: string;
  email: string;
  color: string;
  area?: string; // Setor da organização (dinâmico por org)
  organization_id?: string;
  password?: string;
  permissions?: UserPermissions;
}

// ─── Atividades ───────────────────────────────────────────
export type Priority = 'Alta' | 'Média' | 'Baixa';
export type Status = 'FINALIZADA' | 'PENDENTE' | 'EM ANDAMENTO' | 'POSTERGADA' | 'CANCELADA';

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

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
  checklist?: ChecklistItem[];
}

// ─── App State ────────────────────────────────────────────
export type Tab = 'atividades' | 'dashboard' | 'cadastros' | 'kanban' | 'henkatens' | 'logs' | 'conhecimento' | 'absenteismo' | 'quadroPessoal' | 'budget' | 'superadmin';

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

// ─── Absenteísmo & Horas Extras (Ponto) ────────────────────
export interface Employee {
  id: string;
  name: string;
  status: 'Ativo' | 'Inativo';
  registration?: string; // Matrícula
  role?: string;         // Cargo
  area?: string;         // Setor da organização (dinâmico por org)
  organization_id?: string;
  updatedAt?: string;
}

export type AbsenteeismStatus = 
  | 'P' | 'F' | 'A' | 'AR' | 'PR' | 'ER' | 'EC' 
  | 'LM' | 'SA' | 'TR' | 'FE' | 'FO' | 'DE' | 'LP' | 'AF';

export interface AbsenteeismRecord {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  status: AbsenteeismStatus;
  hasAllowance?: boolean; // Se possui abono concedido
  allowanceReason?: string; // Motivo do abono
  updatedBy?: string;
  updatedAt?: string;
}

export interface OvertimeRecord {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  costCenter: string;
  cause: string;
  motive?: string;
  formNumber?: string;
  updatedBy?: string;
  updatedAt?: string;
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

// ─── Quadro de Pessoal ─────────────────────────────────
export interface StaffingBoard {
  id: string;
  name: string;
  order: number;
}

export interface StaffingColumn {
  id: string;
  boardId: string;
  name: string;
  orcado: number;
  real: number;
  order: number;
}

export interface StaffingRow {
  id: string;
  boardId: string;
  cargo: string;
  setor: string;
  order: number;
}

export interface StaffingCell {
  id: string;
  rowId: string;
  columnId: string;
  value: string;
  status: 'ativo' | 'transferido' | 'afastado';
}

// ─── Budget / Orçamento ────────────────────────────────
export type BudgetType = 'curso' | 'viagem' | 'equipamento';

export type BudgetStatus = 'Orçado' | 'Solicitado' | 'Em Aprovação' | 'Concluído' | 'Cancelado' | 'Não Solicitado';

export type BudgetModalidade = 'Presencial' | 'Remoto';

export interface BudgetItem {
  id: string;
  organization_id?: string;
  tipo: BudgetType;
  
  // Dados comuns
  descricao: string;             // Nome do Curso, Evento da Viagem ou Descrição do Bem
  dataPlanejada: string;         // YYYY-MM-DD
  dataSolicitada?: string;       // YYYY-MM-DD
  status: BudgetStatus;
  modalidade: BudgetModalidade;
  valorUnitario: number;
  valorTotal: number;
  quantidade: number;
  justificativa?: string;
  
  // Específico para Curso e Viagem
  colaboradores?: string[];      // IDs ou nomes dos colaboradores
  cargos?: string;               // Cargo(s) do(s) colaborador(es)
  
  // Específico para Viagem
  evento?: string;               // Nome do Evento / Conferência / Visita
  dataEvento?: string;           // Data do evento
  dataViagemIda?: string;        // Data de ida
  dataViagemVolta?: string;      // Data de volta
  cidade?: string;               // Destino
  
  // Específico para Equipamento
  motivo?: string;
  categoria?: string;            // 'Computadores e Periféricos' | 'Equipamentos' | 'Celulares' | etc.
  anoFrota?: string;
  objetivo?: string;             // 'Eficiência' | 'Expansão' | 'Substituição' | etc.

  createdAt?: string;
  updatedAt?: string;
}
