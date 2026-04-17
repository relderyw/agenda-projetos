import { supabase } from '../lib/supabase'
import { 
  defaultActivities, defaultThemes, defaultUsers, defaultHenkatens,
  defaultKnowledgeCategories, defaultKnowledgeActivities, defaultKnowledgeProgress, defaultHolidays 
} from '../data'
import type { 
  Activity, Theme, User, HenkatenEvent, LogEntry,
  KnowledgeCategory, KnowledgeActivity, KnowledgeProgress, Holiday,
  AbsenteeismRecord, Employee, OvertimeRecord
} from '../types'

const isCloudEnabled = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)

// --- HELPERS ---
const mapUser = (row: any): User => ({
  ...row,
  area: row.area || undefined // Ensure it is optional, not null
});

const mapKnowledgeActivity = (row: any): KnowledgeActivity => ({
  id: row.id,
  categoryId: row.category_id || row.categoryId,
  name: row.name,
  order: row.order
});

const mapKnowledgeProgress = (row: any): KnowledgeProgress => ({
  userId: row.user_id || row.userId,
  activityId: row.activity_id || row.activityId,
  status: row.status as any
});

export const dbService = {
  // --- TEMAS ---
  async getThemes(): Promise<Theme[]> {
    if (!isCloudEnabled) return []
    const { data, error } = await supabase.from('themes').select('*').order('name', { ascending: true })
    if (error) { console.error('GetThemes Error:', error); return [] }
    return data || []
  },
  async saveTheme(theme: Omit<Theme, 'id'> | Theme, user?: User) {
    if (!isCloudEnabled) return { data: null, error: null }
    const { data, error } = await supabase.from('themes').upsert(theme).select()
    if (error) console.error("Save Theme Error", error)
    if (!error && user) {
      await this.saveLog({
        userId: user.id,
        userName: user.name,
        action: 'Ajustou Cadastro de Tema',
        target: (theme as any).name || 'Tema',
      })
    }
    return { data, error }
  },
  async deleteTheme(id: string) {
    if (!isCloudEnabled) return { data: null, error: null }
    return await supabase.from('themes').delete().eq('id', id)
  },

  // --- USUÁRIOS ---
  async getUsers(): Promise<User[]> {
    if (!isCloudEnabled) return []
    const { data, error } = await supabase.from('users').select('*').order('name', { ascending: true })
    if (error) { console.error('GetUsers Error:', error); return [] }
    return (data || []).map(mapUser)
  },
  async saveUser(user: Omit<User, 'id'> | User, adminUser?: User) {
    if (!isCloudEnabled) return { data: null, error: null }
    const { data, error } = await supabase.from('users').upsert(user).select()
    if (error) console.error("Save User Error", error)
    if (!error && adminUser) {
      await this.saveLog({
        userId: adminUser.id,
        userName: adminUser.name,
        action: 'Gerenciou Usuário',
        target: (user as any).name || 'Usuário',
      })
    }
    return { data, error }
  },
  async deleteUser(id: string) {
    if (!isCloudEnabled) return { data: null, error: null }
    return await supabase.from('users').delete().eq('id', id)
  },

  // --- ATIVIDADES ---
  async getActivities(): Promise<Activity[]> {
    if (!isCloudEnabled) return []
    const { data, error } = await supabase.from('activities').select('*').order('planejamento', { ascending: true })
    if (error) { console.error('GetActivities Error:', error); return [] }
    
    // Mapear de snake_case para camelCase
    return (data || []).map(row => {
      const act = { ...row } as any;
      if (act.data_prevista_finalizacao !== undefined) act.dataPrevistaFinalizacao = act.data_prevista_finalizacao;
      if (act.percentual_andamento !== undefined) act.percentualAndamento = act.percentual_andamento;
      if (act.data_finalizada !== undefined) act.dataFinalizada = act.data_finalizada;
      if (act.esforco_realizado !== undefined) act.esforcoRealizado = act.esforco_realizado;
      if (act.dias_esperados_conclusao !== undefined) act.diasEsperadosConclusao = act.dias_esperados_conclusao;
      if (act.data_comentario !== undefined) act.dataComentario = act.data_comentario;
      if (act.week === null) act.week = "Indefinida";

      delete act.data_prevista_finalizacao;
      delete act.percentual_andamento;
      delete act.data_finalizada;
      delete act.esforco_realizado;
      delete act.dias_esperados_conclusao;
      delete act.data_comentario;
      return act;
    });
  },
  async saveActivity(act: Omit<Activity, 'id'> | Activity) {
    if (!isCloudEnabled) return { data: null, error: null }
    let dbPayload = { ...act } as any;

    const cleanEmptyStrings = (obj: any) => {
      const newObj = { ...obj };
      Object.keys(newObj).forEach(key => {
        if (newObj[key] === "") newObj[key] = null;
      });
      return newObj;
    };
    
    dbPayload.data_prevista_finalizacao = (act as any).dataPrevistaFinalizacao;
    dbPayload.percentual_andamento = (act as any).percentualAndamento ?? 0;
    dbPayload.data_finalizada = (act as any).dataFinalizada;
    dbPayload.esforco_realizado = (act as any).esforcoRealizado ?? 0;
    dbPayload.dias_esperados_conclusao = (act as any).diasEsperadosConclusao ?? 1;
    dbPayload.data_comentario = (act as any).dataComentario;
    dbPayload.planejamento = (act as any).planejamento;
    
    dbPayload = cleanEmptyStrings(dbPayload);

    delete dbPayload.dataPrevistaFinalizacao;
    delete dbPayload.percentualAndamento;
    delete dbPayload.dataFinalizada;
    delete dbPayload.esforcoRealizado;
    delete dbPayload.diasEsperadosConclusao;
    delete dbPayload.dataComentario;

    const { data, error } = await supabase.from('activities').upsert(dbPayload).select();
    if (error) console.error("Save Activity Error", error);
    return { data, error };
  },
  async deleteActivity(id: string) {
    if (!isCloudEnabled) return { data: null, error: null }
    return await supabase.from('activities').delete().eq('id', id)
  },

  // --- HENKATENS ---
  async getHenkatens(): Promise<HenkatenEvent[]> {
    if (!isCloudEnabled) return []
    const { data, error } = await supabase.from('henkatens').select('*').order('date', { ascending: true })
    if (error) { console.error('GetHenkatens Error:', error); return [] }
    
    return (data || []).map(row => {
      const evt = { ...row } as any;
      if (evt.end_date !== undefined) evt.endDate = evt.end_date;
      if (evt.postponed_date !== undefined) evt.postponedDate = evt.postponed_date;
      delete evt.end_date;
      delete evt.postponed_date;
      return evt;
    });
  },
  async saveHenkaten(evt: Omit<HenkatenEvent, 'id'> | HenkatenEvent) {
    if (!isCloudEnabled) return { data: null, error: null }
    const dbPayload = { ...evt } as any;
    const cleanDate = (val: any) => (val === "" || val === undefined) ? null : val;
    if (dbPayload.endDate !== undefined) dbPayload.end_date = cleanDate(dbPayload.endDate);
    if (dbPayload.postponedDate !== undefined) dbPayload.postponed_date = cleanDate(dbPayload.postponedDate);
    dbPayload.date = cleanDate(dbPayload.date);
    delete dbPayload.endDate;
    delete dbPayload.postponedDate;

    const { data, error } = await supabase.from('henkatens').upsert(dbPayload).select();
    if (error) console.error("Save Henkaten Error", error);
    return { data, error };
  },
  async deleteHenkaten(id: string) {
    if (!isCloudEnabled) return { data: null, error: null }
    return await supabase.from('henkatens').delete().eq('id', id)
  },

  // --- LOGS ---
  async getTodayLogs(): Promise<LogEntry[]> {
    if (!isCloudEnabled) return []
    const date = new Date();
    date.setDate(date.getDate() - 1);
    const dateStr = date.toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('app_logs')
      .select('*')
      .gte('timestamp', `${dateStr}T00:00:00Z`)
      .order('timestamp', { ascending: false })
      .limit(100)
    if (error) return []
    return (data || []).map(row => ({
      id: row.id,
      userId: row.user_id || row.userId,
      userName: row.user_name || row.userName,
      action: row.action,
      target: row.target,
      timestamp: row.timestamp || new Date().toISOString()
    }));
  },
  async saveLog(log: Omit<LogEntry, 'id' | 'timestamp'>) {
    if (!isCloudEnabled) return { error: null }
    const dbPayload = {
      user_id: log.userId,
      user_name: log.userName,
      action: log.action,
      target: log.target,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString()
    }
    const { error } = await supabase.from('app_logs').insert(dbPayload)
    await (supabase as any).channel('lsl_presence_tracker').send({
      type: 'broadcast',
      event: 'new_log',
      payload: dbPayload
    })
    return { error: null }
  },

  // --- CONHECIMENTO ---
  async getKnowledgeBase(): Promise<{ categories: KnowledgeCategory[], activities: KnowledgeActivity[], progress: KnowledgeProgress[] }> {
    if (!isCloudEnabled) return { categories: [], activities: [], progress: [] }
    const { data: categories } = await supabase.from('knowledge_categories').select('*').order('order', { ascending: true })
    const { data: activities } = await supabase.from('knowledge_activities').select('*').order('order', { ascending: true })
    const { data: progress } = await supabase.from('knowledge_progress').select('*')
    return { 
      categories: categories || [], 
      activities: (activities || []).map(mapKnowledgeActivity), 
      progress: (progress || []).map(mapKnowledgeProgress) 
    }
  },

  async saveKnowledgeProgress(progress: KnowledgeProgress) {
    if (!isCloudEnabled) return { error: null }
    const { error } = await supabase.from('knowledge_progress').upsert({
      user_id: progress.userId,
      activity_id: progress.activityId,
      status: progress.status
    })
    return { error }
  },

  async saveKnowledgeActivity(act: KnowledgeActivity) {
    if (!isCloudEnabled) return { error: null }
    const { error } = await supabase.from('knowledge_activities').upsert({
      id: act.id,
      category_id: act.categoryId,
      name: act.name,
      order: act.order
    })
    return { error }
  },

  async saveKnowledgeCategory(cat: KnowledgeCategory) {
    if (!isCloudEnabled) return { error: null }
    const { error } = await supabase.from('knowledge_categories').upsert(cat)
    return { error }
  },

  // --- FERIADOS ---
  async getHolidays(): Promise<Holiday[]> {
    if (!isCloudEnabled) return []
    const { data, error } = await supabase.from('holidays').select('*').order('date', { ascending: true })
    if (error) return []
    return data || []
  },

  async saveHoliday(holiday: Holiday) {
    if (!isCloudEnabled) return { error: null }
    const { error } = await supabase.from('holidays').upsert(holiday)
    return { error }
  },

  async deleteHoliday(date: string) {
    if (!isCloudEnabled) return { error: null }
    const { error } = await supabase.from('holidays').delete().eq('date', date)
    return { error }
  },

  // --- ABSENTEÍSMO ---
  async getAbsenteeism(): Promise<AbsenteeismRecord[]> {
    if (!isCloudEnabled) return []
    const { data, error } = await supabase.from('absenteeism').select('*')
    if (error) { console.error('GetAbsenteeism Error:', error); return [] }
    return (data || []).map(row => ({
      id: row.id,
      employeeId: row.employee_id || row.employeeId || row.user_id || row.userId, // fallback legacy
      date: row.date,
      status: row.status,
      updatedBy: row.updated_by || row.updatedBy,
      updatedAt: row.updated_at || row.updatedAt
    }))
  },

  async saveAbsenteeism(record: Omit<AbsenteeismRecord, 'id'> | AbsenteeismRecord) {
    if (!isCloudEnabled) return { data: null, error: null }
    const dbPayload = {
      ...(record as any).id && { id: (record as any).id },
      employee_id: record.employeeId,
      date: record.date,
      status: record.status,
      updated_by: record.updatedBy,
      updated_at: new Date().toISOString()
    }
    const { data, error } = await supabase.from('absenteeism').upsert(dbPayload).select()
    if (error) console.error("Save Absenteeism Error", error)
    return { data, error }
  },

  async deleteAbsenteeism(employeeId: string, date: string) {
    if (!isCloudEnabled) return { data: null, error: null }
    return await supabase.from('absenteeism').delete().eq('employee_id', employeeId).eq('date', date)
  },

  // --- EMPLOYEES (Funcionários do Ponto) ---
  async getEmployees(): Promise<Employee[]> {
    if (!isCloudEnabled) return []
    const { data, error } = await supabase.from('employees').select('*').order('name')
    if (error) { console.error('GetEmployees Error:', error); return [] }
    return (data || []).map(row => ({
      id: row.id,
      name: row.name,
      status: row.status,
      area: row.area,
      updatedAt: row.updated_at
    }))
  },

  async saveEmployee(emp: Employee) {
    if (!isCloudEnabled) return { error: null }
    const payload = {
      id: emp.id,
      name: emp.name,
      status: emp.status,
      area: emp.area,
      updated_at: new Date().toISOString()
    }
    const { error } = await supabase.from('employees').upsert(payload)
    if (error) console.error('SaveEmployee Error', error)
    return { error }
  },

  async deleteEmployee(id: string) {
    if (!isCloudEnabled) return { error: null }
    const { error } = await supabase.from('employees').delete().eq('id', id)
    if (error) console.error('DeleteEmployee Error', error)
    return { error }
  },

  // --- OVERTIME (Horas Extras) ---
  async getOvertimes(): Promise<OvertimeRecord[]> {
    if (!isCloudEnabled) return []
    const { data, error } = await supabase.from('overtime').select('*').order('date', { ascending: false })
    if (error) { console.error('GetOvertimes Error:', error); return [] }
    return (data || []).map(row => ({
      id: row.id,
      employeeId: row.employee_id || row.employeeId,
      date: row.date,
      startTime: row.start_time || row.startTime,
      endTime: row.end_time || row.endTime,
      costCenter: row.cost_center || row.costCenter,
      reason: row.reason,
      updatedBy: row.updated_by || row.updatedBy,
      updatedAt: row.updated_at || row.updatedAt
    }))
  },

  async saveOvertime(record: Omit<OvertimeRecord, 'id'> | OvertimeRecord) {
    if (!isCloudEnabled) return { error: null }
    const payload = {
      ...(record as any).id && { id: (record as any).id }, // Only pass id if updating
      employee_id: record.employeeId,
      date: record.date,
      start_time: record.startTime,
      end_time: record.endTime,
      cost_center: record.costCenter,
      reason: record.reason,
      updated_by: record.updatedBy,
      updated_at: new Date().toISOString()
    }
    const { error } = await supabase.from('overtime').upsert(payload)
    if (error) console.error('SaveOvertime Error', error)
    return { error }
  },

  async deleteOvertime(id: string) {
    if (!isCloudEnabled) return { error: null }
    const { error } = await supabase.from('overtime').delete().eq('id', id)
    if (error) console.error('DeleteOvertime Error', error)
    return { error }
  }
};
