import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, X, Save, Download } from 'lucide-react';
import type { HenkatenEvent, HenkatenType, User } from '../types';

interface Props {
  currentUser: User | null;
  events: HenkatenEvent[];
  onAddEvent?: (e: HenkatenEvent) => void;
  onUpdateEvent?: (e: HenkatenEvent) => void;
  onDeleteEvent?: (id: string) => void;
}

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// ── helpers ──────────────────────────────────────────────────────────────────
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ── Event Badge ─────────────────────────────────────────────────────────────
function EventBadge({ event, onClick }: { event: HenkatenEvent, onClick: () => void }) {
  const type = event.type;
  
  let iconContent = null;
  let className = 'hk-badge';
  
  if (event.status === 'Confirmado') {
    className += ' hk-badge-confirmed';
  } else if (event.status === 'Cancelado') {
    className += ' hk-badge-cancelled';
  } else if (event.status === 'Sem Informação') {
    className += ' hk-badge-seminfo';
  } else if (event.status === 'Postergado') {
    className += ' hk-badge-postponed';
  }
  if (type === 'PP1') {
    className += ' hk-badge-pp1';
    iconContent = (
      <svg width="32" height="18" viewBox="0 0 32 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 2H30L24 22H2L8 2Z" fill="transparent" strokeWidth="2" strokeLinejoin="round" />
        <path d="M6 12H27" strokeWidth="2" />
        <text x="18" y="10" fontFamily="sans-serif" fontSize="9" fontWeight="bold" fill="currentColor" textAnchor="middle" stroke="none">PP1</text>
      </svg>
    );
  } else if (type === 'PP2') {
    className += ' hk-badge-pp2';
    iconContent = (
      <svg width="32" height="18" viewBox="0 0 32 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 2H30L27 12H5.5L8 2Z" fill="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M5.5 12H27L24 22H2L5.5 12Z" fill="transparent" strokeWidth="2" strokeLinejoin="round" />
        <text x="18" y="10" fontFamily="sans-serif" fontSize="9" fontWeight="bold" fill="var(--bg-card, #fff)" textAnchor="middle" stroke="none">PP2</text>
      </svg>
    );
  } else if (type === 'MP') {
    className += ' hk-badge-mp';
    iconContent = (
      <svg width="38" height="18" viewBox="0 0 40 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 20 H 18" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M2 20 L 7 12 H 11 L 13 4 H 38" strokeWidth="2.5" strokeLinejoin="round" />
        <text x="26" y="17" fontFamily="sans-serif" fontSize="13" fontWeight="900" fill="currentColor" textAnchor="middle" stroke="none">MP</text>
      </svg>
    );
  } else if (type === 'TRY OUT') {
    className += ' hk-badge-tryout';
    iconContent = (
      <svg width="40" height="18" viewBox="0 0 40 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="4" width="36" height="16" rx="3" strokeWidth="2" strokeDasharray="4 2" />
        <text x="20" y="16" fontFamily="sans-serif" fontSize="10" fontWeight="bold" fill="currentColor" textAnchor="middle" stroke="none">TRY OUT</text>
      </svg>
    );
  } else {
    className += ' hk-badge-generic';
    iconContent = <span className="hk-icon-text">{(type as string).substring(0, 3).toUpperCase()}</span>;
  }

  return (
    <div className={className} title={`${event.type}: ${event.title}`} onClick={e => { e.stopPropagation(); onClick(); }}>
      <div className="hk-badge-icon">{iconContent}</div>
      <div className="hk-badge-info">
        <span className="hk-badge-title">{event.title}</span>
        {event.status === 'Postergado' && event.postponedDate && (
          <div className="hk-postponed-meta">
            ➔ {new Date(event.postponedDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
          </div>
        )}
      </div>
    </div>
  );
}

const emptyEvent = (): Omit<HenkatenEvent, 'id'> => ({
  date: new Date().toISOString().slice(0, 10),
  type: 'PP1',
  title: '',
  description: '',
  status: 'Planejado'
});

// ── Main component ────────────────────────────────────────────────────────────
export default function HenkatensTab({ currentUser, events, onAddEvent, onUpdateEvent, onDeleteEvent }: Props) {
  const canEdit = currentUser?.permissions?.henkatens.edit ?? false;
  const canDelete = currentUser?.permissions?.henkatens.delete ?? false;

  const [currentDate, setCurrentDate] = useState(() => {
    return new Date(2026, 2, 1); 
  });
  
  const [modal, setModal] = useState<{ open: boolean; editing: HenkatenEvent | null }>({ open: false, editing: null });
  const [form, setForm] = useState<Omit<HenkatenEvent, 'id'>>(emptyEvent());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const openNew = () => { setForm(emptyEvent()); setModal({ open: true, editing: null }); };
  const openEdit = (e: HenkatenEvent) => { setForm({ ...e }); setModal({ open: true, editing: e }); };
  const closeModal = () => setModal({ open: false, editing: null });

  const handleSave = () => {
    if (!form.title.trim() || !form.date || !form.type) return;
    if (modal.editing) {
      if (onUpdateEvent) onUpdateEvent({ ...form, id: modal.editing.id } as HenkatenEvent);
    } else {
      if (onAddEvent) onAddEvent({ ...form, id: crypto.randomUUID() } as HenkatenEvent);
    }
    closeModal();
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const handleToday = () => setCurrentDate(new Date());

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  // Pad the calendar with empty cells from the previous month
  const blanks = Array.from({ length: firstDay }, (_, i) => i);
  // Days of the current month
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map = new Map<string, HenkatenEvent[]>();
    events.forEach(evt => {
      const eDate = evt.date;
      if (!map.has(eDate)) map.set(eDate, []);
      map.get(eDate)!.push(evt);
    });
    return map;
  }, [events]);

  const exportCSV = () => {
    const headers = ['Data', 'Tipo', 'Título', 'Descrição', 'Status', 'Data Postergada'];
    const rows = events.map(e => {
      return [
        e.date,
        e.type,
        `"${e.title.replace(/"/g, '""')}"`,
        `"${(e.description || '').replace(/"/g, '""')}"`,
        e.status,
        e.postponedDate || ''
      ].join(';');
    });
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(';'), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.href = encodedUri;
    link.download = `Henkatens_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="tab-content hk-root">
      {/* ── Header ── */}
      <div className="tab-header">
        <div>
          <h1 className="tab-title">Henkatens</h1>
          <p className="tab-subtitle">Calendário de Eventos Industriais</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {currentUser?.role === 'Administrador' && (
            <button className="btn-ghost" onClick={exportCSV} title="Exportar para Excel (CSV)">
              <Download size={18} /> Baixar Excel
            </button>
          )}
          {canEdit && (
            <button className="btn-primary" onClick={openNew}>
              <Plus size={18} /> Novo Evento
            </button>
          )}
        </div>
      </div>

      {/* ── Calendar UI ── */}
      <div className="hk-calendar-card">
        <div className="hk-calendar-header">
          <div className="hk-month-nav">
             <button className="hk-nav-btn" onClick={handlePrevMonth}><ChevronLeft size={20} /></button>
             <h2 className="hk-month-title">{MONTHS[month]} {year}</h2>
             <button className="hk-nav-btn" onClick={handleNextMonth}><ChevronRight size={20} /></button>
          </div>
          <button className="btn-ghost btn-sm" onClick={handleToday}>
            <CalendarIcon size={16} /> Hoje
          </button>
        </div>

        <div className="hk-calendar-grid">
          {/* Weekday headers */}
          {WEEK_DAYS.map(day => (
            <div key={day} className="hk-weekday">
              {day}
            </div>
          ))}

          {/* Blank cells */}
          {blanks.map(blank => (
             <div key={`blank-${blank}`} className="hk-day-cell hk-day-empty"></div>
          ))}

          {/* Days */}
          {days.map(day => {
            const dateStr = formatDate(year, month, day);
            const dayEvents = eventsByDate.get(dateStr) || [];
            
            // Highlight today
            const isToday = new Date().toISOString().slice(0, 10) === dateStr;

            return (
              <div key={day} className={`hk-day-cell ${isToday ? 'hk-today' : ''}`}>
                <div className="hk-day-num">{day}</div>
                <div className="hk-day-events">
                  {dayEvents.map(evt => (
                    // Always render the event on its original date (evt.date)
                    <EventBadge key={evt.id} event={evt} onClick={canEdit ? () => openEdit(evt) : () => {}} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Formulário */}
      {modal.open && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-box" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modal.editing ? 'Editar Evento' : 'Novo Evento'}</h2>
              <button className="modal-close" onClick={closeModal}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group full">
                  <label>Título do Evento *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Ex: Auditoria Externa"
                  />
                </div>

                <div className="form-group">
                  <label>Data *</label>
                  <div className="input-icon-wrap">
                    <CalendarIcon size={15} />
                    <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Tipo do Evento *</label>
                  <select className="select-wrap full-w" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as HenkatenType }))}>
                    <option value="PP1">PP1</option>
                    <option value="PP2">PP2</option>
                    <option value="MP">MP</option>
                    <option value="TRY OUT">TRY OUT</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <select className="select-wrap full-w" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}>
                    <option value="Planejado">Planejado</option>
                    <option value="Confirmado">Confirmado</option>
                    <option value="Postergado">Postergado</option>
                    <option value="Cancelado">Cancelado</option>
                    <option value="Sem Informação">Sem Informação</option>
                  </select>
                </div>

                {form.status === 'Postergado' && (
                  <div className="form-group">
                    <label>Postergado para a data *</label>
                    <div className="input-icon-wrap">
                      <CalendarIcon size={15} />
                      <input type="date" value={form.postponedDate || ''} onChange={e => setForm(f => ({ ...f, postponedDate: e.target.value }))} />
                    </div>
                  </div>
                )}

                <div className="form-group full">
                  <label>Descrição Opcional</label>
                  <textarea
                    rows={2}
                    value={form.description ?? ''}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Descrição para controle..."
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ justifyContent: modal.editing ? 'space-between' : 'flex-end' }}>
              {modal.editing && onDeleteEvent && canDelete && (
                <button className="btn-danger btn-sm" onClick={() => { onDeleteEvent(modal.editing!.id); closeModal(); }}>Excluir</button>
              )}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn-ghost" onClick={closeModal}>Cancelar</button>
                <button className="btn-primary" onClick={handleSave}>
                  <Save size={16} /> {modal.editing ? 'Salvar' : 'Adicionar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
