import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import {
  ChevronLeft, ChevronRight, Calendar, User2,
  CheckCircle2, Clock, AlertCircle, Minus, Play, Pause, FastForward,
  Eye, Edit3, X, Save, ChevronDown
} from 'lucide-react'
import type { Activity, Theme, User, Holiday, OrgSector, Priority, Status } from '../types'
import { dbService } from '../services/db'

interface Props {
  currentUser: User | null;
  activities: Activity[];
  themes: Theme[];
  users: User[];
  holidays: Holiday[];
  onRefresh: () => void;
  showToast?: (type: 'success' | 'error' | 'info', title: string, msg: string) => void;
  sectors: OrgSector[];
  onUpdateActivity?: (a: Activity) => Promise<void> | void;
}

// ── helpers ──────────────────────────────────────────────────────────────────
function parseLocal(str: string): Date {
  if (!str || typeof str !== 'string') return new Date();
  const clean = str.slice(0, 10);
  const [y, m, d] = clean.split('-').map(Number)
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
  act, theme, isToday, cardDate, onClick
}: { act: Activity; theme?: Theme; isToday: boolean; cardDate: string; onClick?: () => void }) {
  
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
  const isLate = !isDone && act.status !== 'CANCELADA' && act.dataPrevistaFinalizacao && act.dataPrevistaFinalizacao < todayStr
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
    <div className={cardClass} onClick={onClick}>
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
        <div className="kb-card-popover">
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

export default function KanbanTab({ activities, themes, users, holidays, currentUser, onRefresh, showToast, sectors, onUpdateActivity }: Props) {
  const canManageHolidays = (currentUser?.role === 'Administrador' || currentUser?.role === 'Super Admin') || currentUser?.role === 'Gestão';

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

  // ── Mapeamento de Usuários e Permissões de Card ────────────
  const userMap = useMemo(() => Object.fromEntries(users.map(u => [u.id, u])), [users]);

  const canEditCard = useCallback((act: Activity): boolean => {
    if (!currentUser) return false;
    const role = currentUser.role;
    const isSuperAdmin = role === 'Super Admin';
    const isAdmin = role === 'Administrador';
    const isGestao = role === 'Gestão' || role === 'Gestao';
    if (isSuperAdmin || isAdmin || isGestao) return true;

    // Analistas e demais: apenas suas próprias atividades
    const isOwner = act.responsavel === currentUser.id ||
      act.responsavel === currentUser.name ||
      (currentUser.name && act.responsavel && act.responsavel.toLowerCase() === currentUser.name.toLowerCase());
    return !!isOwner;
  }, [currentUser]);

  // Modals de Interação
  const [actionModalAct, setActionModalAct] = useState<Activity | null>(null);
  const [viewModalAct, setViewModalAct] = useState<Activity | null>(null);
  const [editModalAct, setEditModalAct] = useState<Activity | null>(null);
  const [editForm, setEditForm] = useState<Activity | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleCardClick = (act: Activity) => {
    setActionModalAct(act);
  };

  const openEditActivity = (act: Activity) => {
    setEditForm({ ...act });
    setEditModalAct(act);
  };

  const formatDisplayDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const parts = clean.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return clean;
  };

  const getViewStatusType = (act: Activity): 'done' | 'late' | 'prog' | 'pend' => {
    if (act.status === 'FINALIZADA' || act.percentualAndamento === 100) return 'done';
    const todayStr = new Date().toISOString().slice(0, 10);
    if (act.status !== 'CANCELADA' && act.dataPrevistaFinalizacao && act.dataPrevistaFinalizacao < todayStr) return 'late';
    if (act.status === 'EM ANDAMENTO' || act.percentualAndamento > 0) return 'prog';
    return 'pend';
  };

  const handlePlanDateChange = (dateStr: string) => {
    if (!dateStr || !editForm) return;
    const [y, m, d] = dateStr.split('-').map(Number);
    const planDate = new Date(y, m - 1, d);
    if (isNaN(planDate.getTime())) return;

    const dayOfMonth = planDate.getDate();
    const firstDay = new Date(y, m - 1, 1);
    const firstDayOfWeek = firstDay.getDay();
    const offset = (firstDayOfWeek + 6) % 7;
    const weekNum = Math.ceil((dayOfMonth + offset) / 7);

    const ptMonths = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const w = `W${weekNum > 5 ? 5 : weekNum}`;
    const month = ptMonths[planDate.getMonth()];

    setEditForm(f => f ? ({ ...f, planejamento: dateStr, week: `${w} - ${month}` }) : null);
  };

  const handleStatusChange = (newStatus: Status) => {
    setEditForm(f => {
      if (!f) return null;
      let newPercent = f.percentualAndamento;
      if (newStatus === 'FINALIZADA') newPercent = 100;
      else if (newStatus === 'PENDENTE') newPercent = 0;
      else if (newStatus === 'EM ANDAMENTO' && f.percentualAndamento === 0) newPercent = 10;

      return {
        ...f,
        status: newStatus,
        percentualAndamento: newPercent,
        dataFinalizada: newStatus === 'FINALIZADA' ? (f.dataFinalizada || new Date().toISOString().slice(0, 10)) : f.dataFinalizada
      };
    });
  };

  const handlePercentChange = (val: number) => {
    const limitedVal = Math.min(100, Math.max(0, val));
    setEditForm(f => {
      if (!f) return null;
      let newStatus = f.status;
      if (limitedVal === 100) newStatus = 'FINALIZADA';
      else if (limitedVal > 0 && f.status === 'PENDENTE') newStatus = 'EM ANDAMENTO';
      else if (limitedVal === 0 && f.status === 'EM ANDAMENTO') newStatus = 'PENDENTE';

      return {
        ...f,
        percentualAndamento: limitedVal,
        status: newStatus,
        dataFinalizada: limitedVal === 100 ? (f.dataFinalizada || new Date().toISOString().slice(0, 10)) : f.dataFinalizada
      };
    });
  };

  const saveEditActivity = async () => {
    if (!editForm) return;
    if (!editForm.descricao.trim()) {
      alert('A descrição é obrigatória.');
      return;
    }
    if (!editForm.responsavel) {
      alert('Selecione um responsável.');
      return;
    }
    if (!editForm.tema) {
      alert('Selecione um tema.');
      return;
    }

    setIsSaving(true);
    try {
      const updated: Activity = {
        ...editForm,
        dataComentario: editForm.comentario !== editModalAct?.comentario
          ? new Date().toLocaleString('pt-BR')
          : editForm.dataComentario
      };

      if (onUpdateActivity) {
        await onUpdateActivity(updated);
      } else {
        const orgId = currentUser?.role === 'Super Admin' ? undefined : currentUser?.organization_id;
        await dbService.saveActivity(updated, orgId);
        onRefresh();
      }

      showToast?.('success', 'Atividade Atualizada', 'As alterações foram salvas com sucesso.');
      setEditModalAct(null);
      setEditForm(null);
    } catch (err: any) {
      console.error(err);
      showToast?.('error', 'Erro ao salvar', 'Não foi possível salvar a atividade.');
    } finally {
      setIsSaving(false);
    }
  };

  
  const onlyAnalysts = useMemo(() => users.filter(u => u.role === 'Analista'), [users]);

  const weekActs = useMemo(() => {
    const startStr = formatDate(weekStart)
    const endStr   = formatDate(addDays(weekStart, 5))
    return activities.filter(a => {
      if (!onlyAnalysts.some(u => u.id === a.responsavel)) return false;
      if (!a.planejamento) return false;
      if (a.status === 'CANCELADA') return false; // Atividades canceladas não aparecem no Kanban semanal
      const actStart = a.planejamento.slice(0, 10)
      const actEnd = (a.dataPrevistaFinalizacao || a.planejamento).slice(0, 10)
      return actStart <= endStr && actEnd >= startStr
    })
  }, [activities, weekStart, onlyAnalysts])

  // Agrupamento de Swimlanes por Área
  const groupedSwimlanes = useMemo(() => {
    const areas = [...sectors.map(s => s.name), 'Sem Área'];
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
              const start = a.planejamento.slice(0, 10)
              const end = (a.dataPrevistaFinalizacao || a.planejamento).slice(0, 10)
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
                          acts.map(act => (
                            <ActivityCard
                              key={act.id}
                              act={act}
                              theme={themeMap[act.tema]}
                              isToday={dayDef?.isToday ?? false}
                              cardDate={date}
                              onClick={() => handleCardClick(act)}
                            />
                          ))
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

      {/* ── MODAL 1: OPÇÕES DO CARD (VISUALIZAR OU EDITAR) ── */}
      {actionModalAct && (
        <div className="modal-overlay" onClick={() => setActionModalAct(null)}>
          <div className="modal-box sm" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', borderRadius: '16px' }}>
            <div className="modal-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {themeMap[actionModalAct.tema] && (
                  <span
                    className="kb-theme-chip"
                    style={{
                      color: themeMap[actionModalAct.tema]?.color,
                      borderColor: `${themeMap[actionModalAct.tema]?.color}40`,
                      background: `${themeMap[actionModalAct.tema]?.color}14`,
                      margin: 0
                    }}
                  >
                    {themeMap[actionModalAct.tema]?.name}
                  </span>
                )}
              </div>
              <button className="modal-close" onClick={() => setActionModalAct(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '1.25rem' }}>
              <p style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '1.25rem', lineHeight: 1.4 }}>
                {actionModalAct.descricao}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Opção Visualizar */}
                <button
                  type="button"
                  className="btn-card-action view"
                  onClick={() => {
                    setViewModalAct(actionModalAct);
                    setActionModalAct(null);
                  }}
                >
                  <div className="action-icon-wrap eye">
                    <Eye size={20} />
                  </div>
                  <div style={{ textAlign: 'left', flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>👁️ Visualizar Atividade</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Expandir card em destaque com todos os detalhes</div>
                  </div>
                </button>

                {/* Opção Editar */}
                {(() => {
                  const canEdit = canEditCard(actionModalAct);
                  return (
                    <button
                      type="button"
                      className={`btn-card-action edit ${!canEdit ? 'disabled' : ''}`}
                      disabled={!canEdit}
                      title={!canEdit ? 'Apenas o responsável ou administradores/gestão podem editar esta atividade' : undefined}
                      onClick={() => {
                        if (!canEdit) return;
                        openEditActivity(actionModalAct);
                        setActionModalAct(null);
                      }}
                    >
                      <div className="action-icon-wrap edit">
                        <Edit3 size={20} />
                      </div>
                      <div style={{ textAlign: 'left', flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>✍️ Editar Atividade</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {canEdit ? 'Atualizar status, datas, progresso e justificativa' : 'Disponível apenas para o responsável'}
                        </div>
                      </div>
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 2: EXPANDIR CARD (VISUALIZAR) ── */}
      {viewModalAct && (
        <div className="modal-overlay" onClick={() => setViewModalAct(null)} style={{ backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.65)' }}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px', borderRadius: '18px', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div style={{ height: '6px', width: '100%', background: themeMap[viewModalAct.tema]?.color || '#3b82f6' }} />

            <div className="modal-header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                {themeMap[viewModalAct.tema] && (
                  <span
                    className="kb-theme-chip"
                    style={{
                      color: themeMap[viewModalAct.tema]?.color,
                      borderColor: `${themeMap[viewModalAct.tema]?.color}50`,
                      background: `${themeMap[viewModalAct.tema]?.color}18`,
                      fontSize: '0.82rem',
                      padding: '4px 10px',
                      fontWeight: 700
                    }}
                  >
                    {themeMap[viewModalAct.tema]?.name}
                  </span>
                )}
                <span className={`kb-status-badge ${statusClassFront(getViewStatusType(viewModalAct))}`} style={{ fontSize: '0.8rem', padding: '3px 8px' }}>
                  <StatusIconFront type={getViewStatusType(viewModalAct)} />
                  {viewModalAct.status}
                </span>
                <span className={`kb-prio-badge ${prioClass(viewModalAct.prioridade)}`} style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                  Prioridade: {viewModalAct.prioridade}
                </span>
              </div>
              <button className="modal-close" onClick={() => setViewModalAct(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Descrição da Atividade
                </span>
                <p style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.35rem', lineHeight: 1.45 }}>
                  {viewModalAct.descricao}
                </p>
              </div>

              {/* Responsável */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'var(--bg-layer)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: userMap[viewModalAct.responsavel]?.color || '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1rem' }}>
                  {userMap[viewModalAct.responsavel]?.name?.[0] || 'U'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Responsável</span>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    {userMap[viewModalAct.responsavel]?.name || viewModalAct.responsavel || 'Não atribuído'}
                  </span>
                </div>
              </div>

              {/* Barra de Progresso Ampliada */}
              <div style={{ padding: '0.85rem 1rem', background: 'var(--bg-layer)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Progresso Geral
                  </span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: themeMap[viewModalAct.tema]?.color || '#3b82f6' }}>
                    {viewModalAct.percentualAndamento}%
                  </span>
                </div>
                <div style={{ height: '10px', width: '100%', background: 'var(--border)', borderRadius: '5px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${viewModalAct.percentualAndamento}%`,
                      background: themeMap[viewModalAct.tema]?.color || '#3b82f6',
                      borderRadius: '5px',
                      transition: 'width 0.4s ease'
                    }}
                  />
                </div>
              </div>

              {/* Grade de Detalhes */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                <div style={{ padding: '0.6rem 0.8rem', background: 'var(--bg-layer)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block' }}>Planejamento</span>
                  <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                    {formatDisplayDate(viewModalAct.planejamento)}
                  </span>
                </div>

                <div style={{ padding: '0.6rem 0.8rem', background: 'var(--bg-layer)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block' }}>Prev. Finalização</span>
                  <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                    {formatDisplayDate(viewModalAct.dataPrevistaFinalizacao) || '--'}
                  </span>
                </div>

                <div style={{ padding: '0.6rem 0.8rem', background: 'var(--bg-layer)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block' }}>Semana</span>
                  <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                    {viewModalAct.week || '--'}
                  </span>
                </div>

                <div style={{ padding: '0.6rem 0.8rem', background: 'var(--bg-layer)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block' }}>Esforço Realizado</span>
                  <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                    {viewModalAct.esforcoRealizado || 0} h
                  </span>
                </div>
              </div>

              {/* Justificativa / Comentário */}
              {viewModalAct.comentario && (
                <div style={{ padding: '0.85rem 1rem', background: 'rgba(245, 158, 11, 0.08)', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <AlertCircle size={15} color="#f59e0b" />
                    <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#b45309', textTransform: 'uppercase' }}>
                      Justificativa / Comentário
                    </span>
                  </div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.4 }}>
                    {viewModalAct.comentario}
                  </p>
                  {viewModalAct.dataComentario && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.35rem' }}>
                      Atualizado em: {viewModalAct.dataComentario}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn-ghost" onClick={() => setViewModalAct(null)}>Fechar</button>
              {canEditCard(viewModalAct) && (
                <button
                  className="btn-primary"
                  onClick={() => {
                    const act = viewModalAct;
                    setViewModalAct(null);
                    openEditActivity(act);
                  }}
                >
                  <Edit3 size={16} /> ✍️ Editar Atividade
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 3: EDITAR ATIVIDADE ── */}
      {editModalAct && editForm && (
        <div className="modal-overlay" onClick={() => setEditModalAct(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '680px' }}>
            <div className="modal-header">
              <h2>✍️ Editar Atividade</h2>
              <button className="modal-close" onClick={() => setEditModalAct(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group full">
                  <label>Descrição da Tarefa *</label>
                  <textarea
                    rows={3}
                    value={editForm.descricao}
                    onChange={e => setEditForm(f => f ? ({ ...f, descricao: e.target.value }) : null)}
                    placeholder="Descreva a atividade..."
                  />
                </div>

                <div className="form-group">
                  <label>Planejamento *</label>
                  <div className="input-icon-wrap">
                    <Calendar size={15} />
                    <input
                      type="date"
                      value={editForm.planejamento}
                      onChange={e => handlePlanDateChange(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Dt. Prevista Finalização</label>
                  <div className="input-icon-wrap">
                    <Calendar size={15} />
                    <input
                      type="date"
                      value={editForm.dataPrevistaFinalizacao || ''}
                      onChange={e => setEditForm(f => f ? ({ ...f, dataPrevistaFinalizacao: e.target.value }) : null)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Tema *</label>
                  <div className="select-wrap full-w">
                    <select
                      value={editForm.tema}
                      onChange={e => setEditForm(f => f ? ({ ...f, tema: e.target.value }) : null)}
                    >
                      <option value="">Selecione...</option>
                      {themes.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="sel-icon" />
                  </div>
                </div>

                <div className="form-group">
                  <label>Responsável *</label>
                  <div className="select-wrap full-w">
                    <select
                      value={editForm.responsavel}
                      disabled={currentUser?.role !== 'Administrador' && currentUser?.role !== 'Super Admin' && currentUser?.role !== 'Gestão' && currentUser?.role !== 'Gestao'}
                      onChange={e => setEditForm(f => f ? ({ ...f, responsavel: e.target.value }) : null)}
                    >
                      <option value="">Selecione...</option>
                      {onlyAnalysts.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="sel-icon" />
                  </div>
                </div>

                <div className="form-group">
                  <label>Prioridade</label>
                  <div className="select-wrap full-w">
                    <select
                      value={editForm.prioridade}
                      onChange={e => setEditForm(f => f ? ({ ...f, prioridade: e.target.value as Priority }) : null)}
                    >
                      <option value="Alta">Alta</option>
                      <option value="Média">Média</option>
                      <option value="Baixa">Baixa</option>
                    </select>
                    <ChevronDown size={14} className="sel-icon" />
                  </div>
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <div className="select-wrap full-w">
                    <select
                      value={editForm.status}
                      onChange={e => handleStatusChange(e.target.value as Status)}
                    >
                      <option value="PENDENTE">PENDENTE</option>
                      <option value="EM ANDAMENTO">EM ANDAMENTO</option>
                      <option value="FINALIZADA">FINALIZADA</option>
                      <option value="POSTERGADA">POSTERGADA</option>
                      <option value="CANCELADA">CANCELADA</option>
                    </select>
                    <ChevronDown size={14} className="sel-icon" />
                  </div>
                </div>

                <div className="form-group">
                  <label>% Andamento ({editForm.percentualAndamento}%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={editForm.percentualAndamento}
                    onChange={e => handlePercentChange(Number(e.target.value))}
                  />
                </div>

                <div className="form-group">
                  <label>Esforço Realizado (horas)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={editForm.esforcoRealizado || 0}
                    onChange={e => setEditForm(f => f ? ({ ...f, esforcoRealizado: Number(e.target.value) }) : null)}
                  />
                </div>

                <div className="form-group full">
                  <label>Justificativa / Comentário</label>
                  <textarea
                    rows={2}
                    value={editForm.comentario || ''}
                    placeholder="Adicione um comentário ou justificativa de status/prazo..."
                    onChange={e => setEditForm(f => f ? ({ ...f, comentario: e.target.value }) : null)}
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setEditModalAct(null)}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={saveEditActivity} disabled={isSaving}>
                <Save size={16} /> {isSaving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

        </div>
      </div>
    </div>
  )
}
