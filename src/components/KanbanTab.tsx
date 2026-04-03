import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import {
  ChevronLeft, ChevronRight, Calendar, User2,
  CheckCircle2, Clock, AlertCircle, Minus, Play, Pause, FastForward
} from 'lucide-react'
import type { Activity, Theme, User, Holiday } from '../types'
import { dbService } from '../services/db'

interface Props {
  currentUser: User | null;
  activities: Activity[];
  themes: Theme[];
  users: User[];
  holidays: Holiday[];
  onRefresh: () => void;
  showToast?: (type: 'success' | 'error' | 'info', title: string, msg: string) => void;
}

// ── helpers ──────────────────────────────────────────────────────────────────
function parseLocal(str: string): Date {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day // Monday-based
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

const WEEK_DAYS = [
  { label: 'Segunda', short: 'SEG' },
  { label: 'Terça',   short: 'TER' },
  { label: 'Quarta',  short: 'QUA' },
  { label: 'Quinta',  short: 'QUI' },
  { label: 'Sexta',   short: 'SEX' },
  { label: 'Sábado',  short: 'SÁB' },
]

const PT_MONTHS = [
  'Jan','Fev','Mar','Abr','Mai','Jun',
  'Jul','Ago','Set','Out','Nov','Dez'
]

function formatDayLabel(d: Date): string {
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
}

function weekRangeLabel(start: Date): string {
  const end = addDays(start, 5)
  return `${String(start.getDate()).padStart(2,'0')} ${PT_MONTHS[start.getMonth()]} – ${String(end.getDate()).padStart(2,'0')} ${PT_MONTHS[end.getMonth()]} ${end.getFullYear()}`
}

// ── Status chip ──────────────────────────────────────────────────────────────
function statusClassFront(displayStatusType: string): string {
  if (displayStatusType === 'done') return 'kb-status-done'
  if (displayStatusType === 'prog') return 'kb-status-prog'
  if (displayStatusType === 'late') return 'kb-status-late'
  return 'kb-status-pend'
}

function StatusIconFront({ type }: { type: string }) {
  if (type === 'done') return <CheckCircle2 size={11} />
  if (type === 'prog') return <Clock size={11} />
  if (type === 'late') return <AlertCircle size={11} />
  return <Minus size={11} />
}

function prioClass(p: Activity['prioridade']): string {
  if (p === 'Alta')  return 'kb-prio-alta'
  if (p === 'Média') return 'kb-prio-media'
  return 'kb-prio-baixa'
}

function ActivityCard({
  act, theme, isToday, cardDate
}: { act: Activity; theme?: Theme; isToday: boolean; cardDate: string }) {
  
  // Lógica Multi-dia: Distribuir o % pelos dias
  const start = parseLocal(act.planejamento);
  const endStr = act.dataPrevistaFinalizacao && act.dataPrevistaFinalizacao.length === 10 
    ? act.dataPrevistaFinalizacao 
    : act.planejamento;
  const end = parseLocal(endStr);
  
  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const pctTotal = act.percentualAndamento;
  const completedDays = totalDays * (pctTotal / 100);
  
  const current = parseLocal(cardDate);
  const dayOffset = Math.round((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const dayIndex = dayOffset + 1;
  
  let pct = 0;
  if (dayIndex <= Math.floor(completedDays)) {
    pct = 100;
  } else if (dayIndex === Math.ceil(completedDays)) {
    pct = Math.round((completedDays - Math.floor(completedDays)) * 100);
    if (pct === 0 && completedDays > 0) pct = 0;
  }
  
  if (act.status === 'FINALIZADA') pct = 100;

  const isDone = pct === 100;
  const todayStr = new Date().toISOString().slice(0, 10)
  const isLate = !isDone && act.dataPrevistaFinalizacao && act.dataPrevistaFinalizacao < todayStr
  const isStarted = pct > 0 && pct < 100

  let cardClass = 'kb-card'
  if (isDone) cardClass += ' kb-card-done'
  else if (isLate) cardClass += ' kb-card-late'
  if (isToday) cardClass += ' kb-card-today'

  let displayStatusLabel = 'Não Iniciada'
  let displayStatusType = 'pend'
  
  if (isDone) {
    displayStatusLabel = 'Finalizada'
    displayStatusType = 'done'
  } else if (isLate) {
    displayStatusLabel = 'Atrasada'
    displayStatusType = 'late'
  } else if (isStarted || (pctTotal > 0 && pctTotal < 100)) {
    displayStatusLabel = 'Em andamento'
    displayStatusType = 'prog'
  }

  return (
    <div className={cardClass}>
      <div className="kb-card-prog-strip">
        <div
          className="kb-card-prog-fill"
          style={{ width: `${pct}%`, background: theme?.color ?? '#3b82f6' }}
        />
      </div>

      {theme && (
        <span
          className="kb-theme-chip"
          style={{ color: theme.color, borderColor: `${theme.color}40`, background: `${theme.color}14` }}
        >
          {theme.name}
        </span>
      )}

      <p className="kb-card-desc">{act.descricao}</p>

      <div className="kb-card-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className={`kb-status-badge ${statusClassFront(displayStatusType)}`}>
            <StatusIconFront type={displayStatusType} />
            {displayStatusLabel}
          </span>
          {act.comentario && (
            <div className="kb-comment-indicator" title="Possui justificativa/comentário">
              <AlertCircle size={12} color="#f59e0b" />
            </div>
          )}
        </div>
        {!isDone && (
          <span className={`kb-prio-dot ${prioClass(act.prioridade)}`} title={act.prioridade} />
        )}
        <span className="kb-card-pct">{pct}%</span>
      </div>

      {act.comentario && (
        <div className="kb-card-popover" style={{ display: 'block' }}>
          <div className="pop-header">
            <AlertCircle size={14} style={{ color: '#f59e0b' }} />
            <span className="pop-title">Justificativa / Comentário</span>
          </div>
          <div className="pop-content">{act.comentario}</div>
          {act.dataComentario && <span className="pop-date">Atualizado: {act.dataComentario}</span>}
        </div>
      )}
    </div>
  )
}

export default function KanbanTab({ activities, themes, users, holidays, currentUser, onRefresh, showToast }: Props) {
  const canManageHolidays = currentUser?.role === 'Administrador' || currentUser?.role === 'Gestão';

  const holidayMap = useMemo(() => {
    const map: Record<string, Holiday> = {};
    holidays.forEach(h => { map[h.date] = h; });
    return map;
  }, [holidays]);

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const [weekOffset, setWeekOffset] = useState(0)

  const weekStart = useMemo(() => {
    const base = getWeekStart(today)
    return addDays(base, weekOffset * 7)
  }, [today, weekOffset])

  const days = useMemo(() =>
    WEEK_DAYS.map((wd, i) => ({
      ...wd,
      date: addDays(weekStart, i),
      isToday: formatDate(addDays(weekStart, i)) === formatDate(today),
    })), [weekStart, today]
  )

  const themeMap = useMemo(() => Object.fromEntries(themes.map(t => [t.id, t])), [themes])
  
  const onlyAnalysts = useMemo(() => users.filter(u => u.role === 'Analista'), [users]);

  const weekActs = useMemo(() => {
    const startStr = formatDate(weekStart)
    const endStr   = formatDate(addDays(weekStart, 5))
    return activities.filter(a => {
      if (!onlyAnalysts.some(u => u.id === a.responsavel)) return false;
      if (!a.planejamento) return false
      const actStart = a.planejamento
      const actEnd = a.dataPrevistaFinalizacao && a.dataPrevistaFinalizacao.length === 10 ? a.dataPrevistaFinalizacao : actStart
      return actStart <= endStr && actEnd >= startStr
    })
  }, [activities, weekStart, onlyAnalysts])

  // Agrupamento de Swimlanes por Área
  const groupedSwimlanes = useMemo(() => {
    const areas = ['T&P', 'Projetos', 'Sem Área'];
    return areas.map(area => {
      const groupUsers = onlyAnalysts.filter(u => {
        if (area === 'Sem Área') return !u.area;
        return u.area === area;
      });
      
      const userLanes = groupUsers.map(user => {
        const userActs = weekActs.filter(a => a.responsavel === user.id)
        const byDay = days.map(day => {
          const dStr = formatDate(day.date)
          return {
            date: dStr,
            acts: userActs.filter(a => {
              const start = a.planejamento
              const end = a.dataPrevistaFinalizacao && a.dataPrevistaFinalizacao.length === 10 ? a.dataPrevistaFinalizacao : start
              return dStr >= start && dStr <= end
            }),
          }
        })
        return { user, byDay, total: userActs.length, done: userActs.filter(a => a.status === 'FINALIZADA').length }
      });

      return { area, userLanes };
    }).filter(g => g.userLanes.length > 0);
  }, [onlyAnalysts, weekActs, days]);

  const [autoScroll, setAutoScroll] = useState(false)
  const [speed, setSpeed] = useState(1)

  useEffect(() => {
    if (!autoScroll) return
    const el = document.querySelector('.kb-swimlanes')
    if (!el) return
    let animationId: number
    let direction = 1
    let pos = el.scrollTop
    const tick = () => {
      const scrollEl = document.querySelector('.kb-swimlanes')
      if (!scrollEl) return
      const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight
      if (maxScroll <= 0) return
      pos += direction * 0.75 * speed
      if (pos >= maxScroll) { pos = maxScroll; direction = -1; }
      else if (pos <= 0) { pos = 0; direction = 1; }
      scrollEl.scrollTop = pos
      animationId = requestAnimationFrame(tick)
    }
    animationId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animationId)
  }, [autoScroll, speed])

  return (
    <div className="tab-content kb-root">
      <div className="tab-header">
        <div>
          <h1 className="tab-title">Programação Semanal</h1>
          <p className="tab-subtitle">Semana {weekRangeLabel(weekStart)}</p>
        </div>
        <div className="kb-week-nav">
          <button className="kb-nav-btn" onClick={() => setWeekOffset(o => o - 1)}><ChevronLeft size={18} /></button>
          <button className={`kb-nav-btn kb-nav-today ${weekOffset === 0 ? 'kb-nav-today-active' : ''}`} onClick={() => setWeekOffset(0)}>
            <Calendar size={15} /> Hoje
          </button>
          <button className="kb-nav-btn" onClick={() => setWeekOffset(o => o + 1)}><ChevronRight size={18} /></button>
        </div>
      </div>

      <div className="presentation-floating-bar">
        <div className="pres-bar-content">
          <span className="speed-tag">{speed}x</span>
          <button className={`pres-btn ${autoScroll ? 'active' : ''}`} onClick={() => setAutoScroll(!autoScroll)}>
            {autoScroll ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button className="pres-btn" onClick={() => setSpeed(s => s >= 3 ? 1 : s + 1)}><FastForward size={20} /></button>
        </div>
      </div>

      <div className="kb-board">
        <div className="kb-col-headers">
          <div className="kb-swimlane-lbl-head" />
          {days.map(day => (
            <div key={day.short} className={`kb-col-header ${day.isToday ? 'kb-col-today' : ''}`}>
              <span className="kb-col-day">{day.label}</span>
              <span className={`kb-col-date ${day.isToday ? 'kb-col-date-today' : ''}`}>{formatDayLabel(day.date)}</span>
            </div>
          ))}
        </div>

        <div className="kb-swimlanes">
          {groupedSwimlanes.map(group => (
            <div key={group.area} className="kb-group-section">
              <div className="kb-group-row-header">
                <span className={`kb-group-pill ${group.area.toLowerCase().replace('&','').replace(' ','-')}`}>
                  {group.area.toUpperCase()}
                </span>
              </div>
              {group.userLanes.map(({ user, byDay, total, done }) => (
                <div key={user.id} className="kb-swimlane">
                  <div className="kb-swimlane-lbl">
                    <div className="kb-analyst-avatar" style={{ background: user.color }}>{user.name.charAt(0)}</div>
                    <div className="kb-analyst-info">
                      <span className="kb-analyst-name">{user.name}</span>
                      <div className="kb-analyst-stats">
                        <span className="kb-stat"><CheckCircle2 size={11} style={{ color: '#10b981' }} /> {done}</span>
                        <span className="kb-stat-div">/</span>
                        <span className="kb-stat"><User2 size={11} /> {total}</span>
                      </div>
                    </div>
                  </div>
                  {byDay.map(({ date, acts }) => {
                    const dayDef = days.find(d => formatDate(d.date) === date)
                    const holiday = holidayMap[date];
                    return (
                      <div key={date} className={`kb-cell ${dayDef?.isToday ? 'kb-cell-today' : ''} ${holiday ? 'kb-cell-holiday' : ''}`}>
                        {holiday ? (
                          <div className="kb-holiday-placeholder">
                            <Calendar size={20} className="kb-holiday-icon-cell" />
                            <span className="kb-holiday-label">{holiday.type.toUpperCase()}</span>
                            {holiday.description && <span className="kb-holiday-desc">{holiday.description}</span>}
                          </div>
                        ) : acts.length === 0 ? <div className="kb-empty-cell" /> : 
                          acts.map(act => <ActivityCard key={act.id} act={act} theme={themeMap[act.tema]} isToday={dayDef?.isToday ?? false} cardDate={date} />)
                        }
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          ))}
          {groupedSwimlanes.length === 0 && (
            <div className="kb-no-acts">
              <Calendar size={36} style={{ opacity: 0.25 }} />
              <p>Nenhuma atividade planejada</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
