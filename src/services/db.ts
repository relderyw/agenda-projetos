import {
  collection, doc, getDocs, setDoc, deleteDoc, addDoc,
  query, where, orderBy, limit, getDoc, writeBatch,
  onSnapshot, serverTimestamp, Timestamp
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type {
  Activity, Theme, User, HenkatenEvent, LogEntry,
  KnowledgeCategory, KnowledgeActivity, KnowledgeProgress, Holiday,
  AbsenteeismRecord, Employee, OvertimeRecord,
  StaffingBoard, StaffingColumn, StaffingRow, StaffingCell,
  Organization, OrgSector
} from '../types'

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function colRef(name: string) {
  return collection(db, name)
}

function docRef(colName: string, id: string) {
  return doc(db, colName, id)
}

async function getAll<T>(
  colName: string,
  filters: Array<{ field: string; value: any }> = [],
  orderField?: string,
  orderDir: 'asc' | 'desc' = 'asc'
): Promise<T[]> {
  try {
    let q: any = colRef(colName)
    const constraints: any[] = []
    for (const f of filters) {
      constraints.push(where(f.field, '==', f.value))
    }
    if (constraints.length > 0) q = query(q, ...constraints)
    const snap = await getDocs(q)
    let list = snap.docs.map(d => ({ id: d.id, ...(d.data() as Record<string, any>) })) as T[]

    if (orderField) {
      list.sort((a: any, b: any) => {
        const valA = a[orderField] ?? ''
        const valB = b[orderField] ?? ''
        if (typeof valA === 'number' && typeof valB === 'number') {
          return orderDir === 'asc' ? valA - valB : valB - valA
        }
        const strA = String(valA).toLowerCase()
        const strB = String(valB).toLowerCase()
        if (strA < strB) return orderDir === 'asc' ? -1 : 1
        if (strA > strB) return orderDir === 'asc' ? 1 : -1
        return 0
      })
    }

    return list
  } catch (e: any) {
    console.error(`[Firebase] getAll(${colName}) error:`, e.message)
    return []
  }
}

async function upsert(colName: string, id: string, data: Record<string, any>) {
  try {
    // Remove undefined values
    const clean: Record<string, any> = {}
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) clean[k] = v
    }
    await setDoc(docRef(colName, id), clean, { merge: true })
    return { error: null }
  } catch (e: any) {
    console.error(`[Firebase] upsert(${colName}, ${id}) error:`, e.message)
    return { error: e }
  }
}

async function remove(colName: string, id: string) {
  try {
    await deleteDoc(docRef(colName, id))
    return { error: null }
  } catch (e: any) {
    console.error(`[Firebase] remove(${colName}, ${id}) error:`, e.message)
    return { error: e }
  }
}

// ─── REALTIME LISTENERS (substitui Supabase Realtime) ─────────────────────────
type LogListener = (log: LogEntry) => void
const logListeners: LogListener[] = []
let _unsubscribeLogs: (() => void) | null = null

function startLogListener(orgId?: string) {
  if (_unsubscribeLogs) return
  const constraints: any[] = [limit(10)]
  if (orgId) constraints.push(where('organization_id', '==', orgId))
  const q = query(colRef('app_logs'), ...constraints)
  _unsubscribeLogs = onSnapshot(q, snap => {
    snap.docChanges().forEach(change => {
      if (change.type === 'added') {
        const row = change.doc.data()
        const log: LogEntry = {
          id: change.doc.id,
          userId: row.user_id || row.userId,
          userName: row.user_name || row.userName,
          action: row.action,
          target: row.target,
          timestamp: row.timestamp || new Date().toISOString()
        }
        logListeners.forEach(fn => fn(log))
      }
    })
  })
}

// ─── DBSERVICE ────────────────────────────────────────────────────────────────

export const dbService = {

  // Permite que componentes escutem logs em tempo real (mesmo comportamento do Supabase Realtime)
  onNewLog(listener: LogListener, orgId?: string) {
    logListeners.push(listener)
    startLogListener(orgId)
    return () => {
      const idx = logListeners.indexOf(listener)
      if (idx !== -1) logListeners.splice(idx, 1)
    }
  },

  // ─── TEMAS ────────────────────────────────────────────────────────────────

  async getThemes(orgId?: string): Promise<Theme[]> {
    const filters = orgId ? [{ field: 'organization_id', value: orgId }] : []
    return getAll<Theme>('themes', filters, 'name')
  },

  async saveTheme(theme: Omit<Theme, 'id'> | Theme, user?: User, orgId?: string) {
    const id = (theme as Theme).id || crypto.randomUUID()
    const payload = { ...theme, id, ...(orgId ? { organization_id: orgId } : {}) }
    const result = await upsert('themes', id, payload)
    if (!result.error && user) {
      await this.saveLog({ userId: user.id, userName: user.name, action: 'Ajustou Cadastro de Tema', target: (theme as any).name }, orgId)
    }
    return { data: payload, error: result.error }
  },

  async deleteTheme(id: string) {
    return remove('themes', id)
  },

  // ─── USUÁRIOS ─────────────────────────────────────────────────────────────

  async getUsers(orgId?: string): Promise<User[]> {
    const filters = orgId ? [{ field: 'organization_id', value: orgId }] : []
    const users = await getAll<User>('users', filters, 'name')
    return users.map(u => ({ ...u, area: (u as any).area || undefined }))
  },

  async saveUser(user: Omit<User, 'id'> | User, adminUser?: User, orgId?: string) {
    const id = (user as User).id || crypto.randomUUID()
    const payload = { ...user, id, ...(orgId ? { organization_id: orgId } : {}) }
    const result = await upsert('users', id, payload)
    if (!result.error && adminUser) {
      await this.saveLog({ userId: adminUser.id, userName: adminUser.name, action: 'Gerenciou Usuário', target: (user as any).name }, orgId)
    }
    return { data: payload, error: result.error }
  },

  async deleteUser(id: string) {
    return remove('users', id)
  },

  // ─── ATIVIDADES ───────────────────────────────────────────────────────────

  async getActivities(orgId?: string): Promise<Activity[]> {
    const filters = orgId ? [{ field: 'organization_id', value: orgId }] : []
    const rows = await getAll<any>('activities', filters, 'planejamento')
    return rows.map(row => {
      // Suporte a dados migrados do Supabase (snake_case) e novos dados (camelCase)
      const act = { ...row }
      if (act.data_prevista_finalizacao !== undefined && act.dataPrevistaFinalizacao === undefined)
        act.dataPrevistaFinalizacao = act.data_prevista_finalizacao
      if (act.percentual_andamento !== undefined && act.percentualAndamento === undefined)
        act.percentualAndamento = act.percentual_andamento
      if (act.data_finalizada !== undefined && act.dataFinalizada === undefined)
        act.dataFinalizada = act.data_finalizada
      if (act.esforco_realizado !== undefined && act.esforcoRealizado === undefined)
        act.esforcoRealizado = act.esforco_realizado
      if (act.dias_esperados_conclusao !== undefined && act.diasEsperadosConclusao === undefined)
        act.diasEsperadosConclusao = act.dias_esperados_conclusao
      if (act.data_comentario !== undefined && act.dataComentario === undefined)
        act.dataComentario = act.data_comentario
      if (act.week === null || act.week === undefined) act.week = 'Indefinida'

      if (typeof act.planejamento === 'string' && act.planejamento.includes('T'))
        act.planejamento = act.planejamento.slice(0, 10)
      if (typeof act.dataPrevistaFinalizacao === 'string' && act.dataPrevistaFinalizacao.includes('T'))
        act.dataPrevistaFinalizacao = act.dataPrevistaFinalizacao.slice(0, 10)
      if (typeof act.dataFinalizada === 'string' && act.dataFinalizada.includes('T'))
        act.dataFinalizada = act.dataFinalizada.slice(0, 10)

      delete act.data_prevista_finalizacao
      delete act.percentual_andamento
      delete act.data_finalizada
      delete act.esforco_realizado
      delete act.dias_esperados_conclusao
      delete act.data_comentario
      return act as Activity
    })
  },

  async saveActivity(act: Omit<Activity, 'id'> | Activity, orgId?: string) {
    const id = (act as Activity).id || crypto.randomUUID()
    const payload: Record<string, any> = {
      ...act,
      id,
      dataPrevistaFinalizacao: (act as any).dataPrevistaFinalizacao || null,
      percentualAndamento: (act as any).percentualAndamento ?? 0,
      dataFinalizada: (act as any).dataFinalizada || null,
      esforcoRealizado: (act as any).esforcoRealizado ?? 0,
      diasEsperadosConclusao: (act as any).diasEsperadosConclusao ?? 1,
      dataComentario: (act as any).dataComentario || null,
      ...(orgId ? { organization_id: orgId } : {})
    }
    // Limpa strings vazias
    for (const key of Object.keys(payload)) {
      if (payload[key] === '') payload[key] = null
    }
    const result = await upsert('activities', id, payload)
    return { data: payload, error: result.error }
  },

  async saveActivitiesBatch(activitiesToSave: Activity[], orgId?: string) {
    if (activitiesToSave.length === 0) return { error: null }
    try {
      const BATCH_SIZE = 400
      for (let i = 0; i < activitiesToSave.length; i += BATCH_SIZE) {
        const batch = writeBatch(db)
        const chunk = activitiesToSave.slice(i, i + BATCH_SIZE)
        for (const act of chunk) {
          const id = act.id || crypto.randomUUID()
          const payload: Record<string, any> = {
            ...act,
            id,
            dataPrevistaFinalizacao: (act as any).dataPrevistaFinalizacao || null,
            percentualAndamento: (act as any).percentualAndamento ?? 0,
            dataFinalizada: (act as any).dataFinalizada || null,
            esforcoRealizado: (act as any).esforcoRealizado ?? 0,
            diasEsperadosConclusao: (act as any).diasEsperadosConclusao ?? 1,
            dataComentario: (act as any).dataComentario || null,
            ...(orgId ? { organization_id: orgId } : {})
          }
          for (const key of Object.keys(payload)) {
            if (payload[key] === '') payload[key] = null
          }
          const clean: Record<string, any> = {}
          for (const [k, v] of Object.entries(payload)) {
            if (v !== undefined) clean[k] = v
          }
          batch.set(docRef('activities', id), clean, { merge: true })
        }
        await batch.commit()
      }
      return { error: null }
    } catch (e: any) {
      console.error('[Firebase] saveActivitiesBatch error:', e.message)
      return { error: e }
    }
  },

  async deleteActivity(id: string) {
    return remove('activities', id)
  },

  // ─── HENKATENS ────────────────────────────────────────────────────────────

  async getHenkatens(orgId?: string): Promise<HenkatenEvent[]> {
    const filters = orgId ? [{ field: 'organization_id', value: orgId }] : []
    const rows = await getAll<any>('henkatens', filters, 'date')
    return rows.map(row => {
      const evt = { ...row }
      // Suporte a dados migrados do Supabase (snake_case)
      if (evt.end_date !== undefined && evt.endDate === undefined) evt.endDate = evt.end_date
      if (evt.postponed_date !== undefined && evt.postponedDate === undefined) evt.postponedDate = evt.postponed_date
      delete evt.end_date
      delete evt.postponed_date
      return evt as HenkatenEvent
    })
  },

  async saveHenkaten(evt: Omit<HenkatenEvent, 'id'> | HenkatenEvent, orgId?: string) {
    const id = (evt as HenkatenEvent).id || crypto.randomUUID()
    const cleanDate = (v: any) => (v === '' || v === undefined) ? null : v
    const payload: Record<string, any> = {
      ...evt,
      id,
      date: cleanDate((evt as any).date),
      endDate: cleanDate((evt as any).endDate),
      postponedDate: cleanDate((evt as any).postponedDate),
      ...(orgId ? { organization_id: orgId } : {})
    }
    const result = await upsert('henkatens', id, payload)
    return { data: payload, error: result.error }
  },

  async deleteHenkaten(id: string) {
    return remove('henkatens', id)
  },

  // ─── LOGS ─────────────────────────────────────────────────────────────────

  async getTodayLogs(orgId?: string): Promise<LogEntry[]> {
    try {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const dateStr = yesterday.toISOString()

      const filters = orgId ? [{ field: 'organization_id', value: orgId }] : []
      const rows = await getAll<any>('app_logs', filters)
      
      return rows
        .filter(r => (r.timestamp || '') >= dateStr)
        .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
        .slice(0, 100)
        .map(row => ({
          id: row.id,
          userId: row.user_id || row.userId,
          userName: row.user_name || row.userName,
          action: row.action,
          target: row.target,
          timestamp: row.timestamp || new Date().toISOString()
        } as LogEntry))
    } catch (e: any) {
      console.error('[Firebase] getTodayLogs error:', e.message)
      return []
    }
  },

  async saveLog(log: Omit<LogEntry, 'id' | 'timestamp'>, orgId?: string) {
    try {
      const id = crypto.randomUUID()
      const timestamp = new Date().toISOString()
      const payload = {
        id,
        user_id: log.userId,
        user_name: log.userName,
        action: log.action,
        target: log.target || null,
        timestamp,
        ...(orgId ? { organization_id: orgId } : {})
      }
      await setDoc(docRef('app_logs', id), payload)
      return { error: null }
    } catch (e: any) {
      console.error('[Firebase] saveLog error:', e.message)
      return { error: e }
    }
  },

  // ─── CONHECIMENTO ─────────────────────────────────────────────────────────

  async getKnowledgeBase(orgId?: string): Promise<{ categories: KnowledgeCategory[], activities: KnowledgeActivity[], progress: KnowledgeProgress[] }> {
    try {
      const filters = orgId ? [{ field: 'organization_id', value: orgId }] : []
      const [categories, activities, progress] = await Promise.all([
        getAll<KnowledgeCategory>('knowledge_categories', filters, 'order'),
        getAll<any>('knowledge_activities', filters, 'order'),
        getAll<any>('knowledge_progress', filters),
      ])
      return {
        categories,
        activities: activities.map(a => ({
          id: a.id,
          categoryId: a.category_id || a.categoryId,
          name: a.name,
          order: a.order
        })),
        progress: progress.map(p => ({
          userId: p.user_id || p.userId,
          activityId: p.activity_id || p.activityId,
          status: p.status
        }))
      }
    } catch (e) {
      return { categories: [], activities: [], progress: [] }
    }
  },

  async saveKnowledgeProgress(progress: KnowledgeProgress, orgId?: string) {
    const id = `${progress.userId}_${progress.activityId}`
    return upsert('knowledge_progress', id, {
      user_id: progress.userId,
      activity_id: progress.activityId,
      status: progress.status,
      ...(orgId ? { organization_id: orgId } : {})
    })
  },

  async saveKnowledgeActivity(act: KnowledgeActivity, orgId?: string) {
    return upsert('knowledge_activities', act.id, {
      id: act.id,
      category_id: act.categoryId,
      name: act.name,
      order: act.order,
      ...(orgId ? { organization_id: orgId } : {})
    })
  },

  async saveKnowledgeCategory(cat: KnowledgeCategory, orgId?: string) {
    return upsert('knowledge_categories', String(cat.id), {
      ...cat,
      ...(orgId ? { organization_id: orgId } : {})
    })
  },

  // ─── FERIADOS ─────────────────────────────────────────────────────────────

  async getHolidays(orgId?: string): Promise<Holiday[]> {
    const filters = orgId ? [{ field: 'organization_id', value: orgId }] : []
    return getAll<Holiday>('holidays', filters, 'date')
  },

  async saveHoliday(holiday: Holiday, orgId?: string) {
    const id = orgId ? `${holiday.date}_${orgId}` : holiday.date
    return upsert('holidays', id, {
      ...holiday,
      ...(orgId ? { organization_id: orgId } : {})
    })
  },

  async deleteHoliday(date: string, orgId?: string) {
    const id = orgId ? `${date}_${orgId}` : date
    return remove('holidays', id)
  },

  // ─── ABSENTEÍSMO ──────────────────────────────────────────────────────────

  async getAbsenteeism(orgId?: string): Promise<AbsenteeismRecord[]> {
    const filters = orgId ? [{ field: 'organization_id', value: orgId }] : []
    const rows = await getAll<any>('absenteeism', filters, 'date', 'desc')
    return rows.map(row => ({
      id: row.id,
      employeeId: row.employee_id || row.employeeId,
      date: row.date,
      status: row.status,
      updatedBy: row.updated_by || row.updatedBy,
      updatedAt: row.updated_at || row.updatedAt
    }))
  },

  async saveAbsenteeism(record: Omit<AbsenteeismRecord, 'id'> | AbsenteeismRecord, orgId?: string) {
    const id = (record as AbsenteeismRecord).id || crypto.randomUUID()
    const payload = {
      id,
      employee_id: record.employeeId,
      date: record.date,
      status: record.status,
      updated_by: record.updatedBy,
      updated_at: new Date().toISOString(),
      ...(orgId ? { organization_id: orgId } : {})
    }
    const result = await upsert('absenteeism', id, payload)
    return { data: payload, error: result.error }
  },

  async deleteAbsenteeism(employeeId: string, date: string) {
    try {
      const q = query(colRef('absenteeism'), where('employee_id', '==', employeeId), where('date', '==', date))
      const snap = await getDocs(q)
      const batch = writeBatch(db)
      snap.docs.forEach(d => batch.delete(d.ref))
      await batch.commit()
      return { data: null, error: null }
    } catch (e: any) {
      return { data: null, error: e }
    }
  },

  // ─── EMPLOYEES ────────────────────────────────────────────────────────────

  async getEmployees(orgId?: string): Promise<Employee[]> {
    const filters = orgId ? [{ field: 'organization_id', value: orgId }] : []
    const rows = await getAll<any>('employees', filters, 'name')
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      status: row.status,
      registration: row.registration,
      role: row.role,
      area: row.area,
      updatedAt: row.updated_at || row.updatedAt
    }))
  },

  async saveEmployee(emp: Employee, orgId?: string) {
    const payload = {
      id: emp.id,
      name: emp.name,
      status: emp.status,
      registration: emp.registration,
      role: emp.role,
      area: emp.area,
      updated_at: new Date().toISOString(),
      ...(orgId ? { organization_id: orgId } : {})
    }
    return upsert('employees', emp.id, payload)
  },

  async deleteEmployee(id: string) {
    return remove('employees', id)
  },

  // ─── OVERTIME (Horas Extras) ──────────────────────────────────────────────

  async getOvertimes(orgId?: string): Promise<OvertimeRecord[]> {
    const filters = orgId ? [{ field: 'organization_id', value: orgId }] : []
    const rows = await getAll<any>('overtime', filters, 'date', 'desc')
    return rows.map(row => ({
      id: row.id,
      employeeId: row.employee_id || row.employeeId,
      date: row.date,
      startTime: row.start_time || row.startTime,
      endTime: row.end_time || row.endTime,
      costCenter: row.cost_center || row.costCenter,
      cause: row.reason || row.cause,
      motive: row.motive,
      formNumber: row.form_number || row.formNumber,
      updatedBy: row.updated_by || row.updatedBy,
      updatedAt: row.updated_at || row.updatedAt
    }))
  },

  async saveOvertime(record: Omit<OvertimeRecord, 'id'> | OvertimeRecord, orgId?: string) {
    const id = (record as OvertimeRecord).id || crypto.randomUUID()
    const payload = {
      id,
      employee_id: record.employeeId,
      date: record.date,
      start_time: record.startTime,
      end_time: record.endTime,
      cost_center: record.costCenter,
      reason: record.cause,
      motive: record.motive || null,
      form_number: record.formNumber || null,
      updated_by: record.updatedBy || null,
      updated_at: new Date().toISOString(),
      ...(orgId ? { organization_id: orgId } : {})
    }
    return upsert('overtime', id, payload)
  },

  async deleteOvertime(id: string) {
    return remove('overtime', id)
  },

  // ─── QUADRO DE PESSOAL ────────────────────────────────────────────────────

  async getStaffingData(orgId?: string): Promise<{ boards: StaffingBoard[], columns: StaffingColumn[], rows: StaffingRow[], cells: StaffingCell[] }> {
    const emptyResult = { boards: [], columns: [], rows: [], cells: [] }
    try {
      const boardFilters = orgId ? [{ field: 'organization_id', value: orgId }] : []
      const boards = await getAll<StaffingBoard>('staffing_boards', boardFilters, 'order')

      if (boards.length === 0) return emptyResult

      const boardIds = boards.map(b => b.id)

      // Busca columns e rows por boardId (Firestore não tem IN queries > 10 itens, mas para esse caso está ok)
      const [allCols, allRows] = await Promise.all([
        getAll<any>('staffing_columns', [], 'order'),
        getAll<any>('staffing_rows', [], 'order'),
      ])

      const columns: StaffingColumn[] = allCols
        .filter((c: any) => boardIds.includes(c.board_id || c.boardId))
        .map((c: any) => ({
          id: c.id,
          boardId: c.board_id || c.boardId,
          name: c.name,
          orcado: c.orcado ?? 0,
          real: c.real ?? 0,
          order: c.order
        }))

      const rows: StaffingRow[] = allRows
        .filter((r: any) => boardIds.includes(r.board_id || r.boardId))
        .map((r: any) => ({
          id: r.id,
          boardId: r.board_id || r.boardId,
          cargo: r.cargo,
          setor: r.setor,
          order: r.order
        }))

      const rowIds = new Set(rows.map(r => r.id))
      const allCells = await getAll<any>('staffing_cells')
      const cells: StaffingCell[] = allCells
        .filter((c: any) => rowIds.has(c.row_id || c.rowId))
        .map((c: any) => ({
          id: c.id,
          rowId: c.row_id || c.rowId,
          columnId: c.column_id || c.columnId,
          value: c.value || '',
          status: c.status || 'ativo'
        }))

      return { boards, columns, rows, cells }
    } catch (e: any) {
      console.error('[Firebase] getStaffingData error:', e.message)
      return emptyResult
    }
  },

  async saveStaffingBoard(board: StaffingBoard, orgId?: string) {
    return upsert('staffing_boards', board.id, {
      ...board,
      ...(orgId ? { organization_id: orgId } : {})
    })
  },

  async deleteStaffingBoard(id: string) {
    return remove('staffing_boards', id)
  },

  async saveStaffingColumn(column: StaffingColumn) {
    return upsert('staffing_columns', column.id, {
      id: column.id,
      board_id: column.boardId,
      name: column.name,
      orcado: column.orcado,
      real: column.real,
      order: column.order
    })
  },

  async deleteStaffingColumn(id: string) {
    return remove('staffing_columns', id)
  },

  async saveStaffingRow(row: StaffingRow) {
    return upsert('staffing_rows', row.id, {
      id: row.id,
      board_id: row.boardId,
      cargo: row.cargo,
      setor: row.setor,
      order: row.order
    })
  },

  async deleteStaffingRow(id: string) {
    return remove('staffing_rows', id)
  },

  async saveStaffingCell(cell: StaffingCell) {
    return upsert('staffing_cells', cell.id, {
      id: cell.id,
      row_id: cell.rowId,
      column_id: cell.columnId,
      value: cell.value,
      status: cell.status
    })
  },

  // ─── ORGANIZATIONS ────────────────────────────────────────────────────────

  async getOrganizations(): Promise<Organization[]> {
    return getAll<Organization>('organizations', [], 'name')
  },

  async saveOrganization(org: Omit<Organization, 'id'> | Organization) {
    const id = (org as Organization).id || crypto.randomUUID()
    const payload = { ...org, id }
    const result = await upsert('organizations', id, payload)
    return { data: payload, error: result.error }
  },

  async deleteOrganization(id: string) {
    return remove('organizations', id)
  },

  // ─── ORG SECTORS ──────────────────────────────────────────────────────────

  async getOrgSectors(orgId: string): Promise<OrgSector[]> {
    return getAll<OrgSector>('org_sectors', [{ field: 'organization_id', value: orgId }], 'name')
  },

  async saveOrgSector(sector: Omit<OrgSector, 'id'> | OrgSector) {
    const id = (sector as OrgSector).id || crypto.randomUUID()
    const payload = { ...sector, id }
    const result = await upsert('org_sectors', id, payload)
    return { data: payload, error: result.error }
  },

  async deleteOrgSector(id: string) {
    return remove('org_sectors', id)
  },
}
