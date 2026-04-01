import { useState, useMemo } from 'react';
import {
  Plus, Search, Filter, ChevronDown, Edit2, Trash2,
  CheckCircle2, Clock, AlertCircle, X, Calendar, Save,
  ChevronsUpDown, ChevronUp, Download, RefreshCw
} from 'lucide-react';
import type { Activity, Theme, User, Priority, Status } from '../types';

interface Props {
  currentUser: User | null;
  activities: Activity[];
  themes: Theme[];
  users: User[];
  onAdd: (a: Activity) => void;
  onUpdate: (a: Activity) => void;
  onDelete: (id: string) => void;
}

type SortKey = keyof Activity | '';
type SortDir = 'asc' | 'desc';

const PRIORITIES: Priority[] = ['Alta', 'Média', 'Baixa'];
const STATUSES: Status[] = ['PENDENTE', 'EM ANDAMENTO', 'FINALIZADA', 'POSTERGADA'];

const PRIO_ORDER: Record<Priority, number> = { Alta: 0, Média: 1, Baixa: 2 };
const STATUS_ORDER: Record<Status, number> = { PENDENTE: 0, 'EM ANDAMENTO': 1, FINALIZADA: 2, POSTERGADA: 3 };

function getStatusIcon(status: Status) {
  if (status === 'FINALIZADA') return <CheckCircle2 size={14} />;
  if (status === 'EM ANDAMENTO') return <Clock size={14} />;
  return <AlertCircle size={14} />;
}
function getStatusClass(status: Status) {
  if (status === 'FINALIZADA') return 'badge-green';
  if (status === 'EM ANDAMENTO') return 'badge-blue';
  return 'badge-red';
}
function getPrioClass(p: Priority) {
  if (p === 'Alta') return 'prio-alta';
  if (p === 'Média') return 'prio-media';
  return 'prio-baixa';
}

const empty = (): Omit<Activity, 'id'> => ({
  planejamento: new Date().toISOString().slice(0, 10),
  descricao: '',
  tema: '',
  responsavel: '',
  prioridade: 'Média',
  dataPrevistaFinalizacao: '',
  percentualAndamento: 0,
  dataFinalizada: '',
  diasEsperadosConclusao: 0,
  esforcoRealizado: 0,
  status: 'PENDENTE',
  week: '',
  comentario: '',
  dataComentario: ''
});

// ── Sortable column header ─────────────────────────────────
function SortTh({
  label, sortKey, current, dir, onClick, resizable
}: {
  label: string; sortKey: SortKey; current: SortKey; dir: SortDir; onClick: (k: SortKey) => void; resizable?: boolean;
}) {
  const active = current === sortKey;
  return (
    <th
      className={`sortable-th ${active ? 'sort-active' : ''} ${resizable ? 'resizable-th' : ''}`}
      onClick={() => onClick(sortKey)}
    >
      <div className={`th-inner ${resizable ? 'resizable-inner' : ''}`}>
        <span>{label}</span>
        <span className="sort-icon">
          {active
            ? (dir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />)
            : <ChevronsUpDown size={13} />}
        </span>
      </div>
    </th>
  );
}

export default function AtividadesTab({ currentUser, activities, themes, users, onAdd, onUpdate, onDelete }: Props) {
  const canEdit = currentUser?.permissions?.atividades.edit ?? false;
  const canDelete = currentUser?.permissions?.atividades.delete ?? false;

  const [search, setSearch] = useState('');
  const [filterResp, setFilterResp] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPrio, setFilterPrio] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('planejamento');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [modal, setModal] = useState<{ open: boolean; editing: Activity | null }>({ open: false, editing: null });
  const [form, setForm] = useState<Omit<Activity, 'id'>>(empty());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Apenas analistas e outros papéis operacionais aparecem nos dropdowns
  const filteredUsers = useMemo(() => {
    return users.filter(u => u.role !== 'Administrador');
  }, [users]);


  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filteredAndSorted = useMemo(() => {
    const f = activities.filter(a => {
      const matchSearch = a.descricao.toLowerCase().includes(search.toLowerCase());
      const matchResp = filterResp === 'all' || a.responsavel === filterResp;
      const matchStatus = filterStatus === 'all' || a.status === filterStatus;
      const matchPrio = filterPrio === 'all' || a.prioridade === filterPrio;
      
      // Sempre ocultar atividades atribuídas a Administrador ou Gestão
      const u = users.find(usr => usr.id === a.responsavel);
      const isManagement = u?.role === 'Administrador' || u?.role === 'Gestão';
      if (isManagement) return false;

      return matchSearch && matchResp && matchStatus && matchPrio;
    });

    if (!sortKey) return f;

    return [...f].sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';

      if (sortKey === 'prioridade') {
        av = PRIO_ORDER[a.prioridade as Priority] ?? 99;
        bv = PRIO_ORDER[b.prioridade as Priority] ?? 99;
      } else if (sortKey === 'status') {
        av = STATUS_ORDER[a.status as Status] ?? 99;
        bv = STATUS_ORDER[b.status as Status] ?? 99;
      } else if (sortKey === 'responsavel') {
        const ua = users.find(u => u.id === a.responsavel)?.name ?? '';
        const ub = users.find(u => u.id === b.responsavel)?.name ?? '';
        av = ua; bv = ub;
      } else if (sortKey === 'tema') {
        const ta = themes.find(t => t.id === a.tema)?.name ?? '';
        const tb = themes.find(t => t.id === b.tema)?.name ?? '';
        av = ta; bv = tb;
      } else {
        av = (a as unknown as Record<string, unknown>)[sortKey] as string | number ?? '';
        bv = (b as unknown as Record<string, unknown>)[sortKey] as string | number ?? '';
      }

      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [activities, search, filterResp, filterStatus, filterPrio, sortKey, sortDir, users, themes]);

  const openNew = () => { setForm(empty()); setModal({ open: true, editing: null }); };
  const openEdit = (a: Activity) => { setForm({ ...a }); setModal({ open: true, editing: a }); };
  const closeModal = () => setModal({ open: false, editing: null });

  const handleSave = async () => {
    if (!form.descricao.trim()) return alert("A descrição é obrigatória.");
    if (!form.responsavel) return alert("Selecione um responsável.");
    if (!form.tema) return alert("Selecione um tema.");
    
    if (form.status === 'POSTERGADA' && !form.dataFinalizada) {
      return alert("Para postergar, informe a Nova Data (no campo 'Dt. Finalizada' para este recurso).");
    }
    
    setIsSaving(true);
    try {
      const act = { ...form };
      
      // Se era edição e mudou para POSTERGADA, vamos disparar a duplicata para a nova data
      if (modal.editing && form.status === 'POSTERGADA' && modal.editing.status !== 'POSTERGADA') {
        const duplicate: Activity = {
           ...act, 
           id: crypto.randomUUID(),
           planejamento: act.dataFinalizada || act.planejamento,
           status: 'PENDENTE',
           percentualAndamento: 0,
           dataFinalizada: undefined
        };
        await onAdd(duplicate);
      } else if (!modal.editing && form.status === 'POSTERGADA') {
        const duplicate: Activity = {
           ...act, 
           id: crypto.randomUUID(),
           planejamento: act.dataFinalizada || act.planejamento,
           status: 'PENDENTE',
           percentualAndamento: 0,
           dataFinalizada: undefined
        };
        await onAdd(duplicate);
      }

      // Cálculos...
      if (act.planejamento) {
        const [y, m, d] = act.planejamento.split('-').map(Number);
        const planDate = new Date(y, m - 1, d);
        if (!isNaN(planDate.getTime())) {
          const dayOfMonth = planDate.getDate();
          const weekNum = Math.ceil(dayOfMonth / 7);
          const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
          const monthStr = months[planDate.getMonth()];
          act.week = `W${weekNum > 5 ? 5 : weekNum} - ${monthStr}`;
        }
      }

      // Cálculos de prazos...
      if (act.planejamento && act.dataPrevistaFinalizacao) {
        const [y1, m1, d1] = act.planejamento.split('-').map(Number);
        const [y2, m2, d2] = act.dataPrevistaFinalizacao.split('-').map(Number);
        const date1 = new Date(y1, m1 - 1, d1);
        const date2 = new Date(y2, m2 - 1, d2);
        act.diasEsperadosConclusao = Math.ceil((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
      }

      if (act.planejamento && act.dataFinalizada) {
        const [y1, m1, d1] = act.planejamento.split('-').map(Number);
        const [y2, m2, d2] = act.dataFinalizada.split('-').map(Number);
        const date1 = new Date(y1, m1 - 1, d1);
        const date2 = new Date(y2, m2 - 1, d2);
        act.esforcoRealizado = Math.ceil((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
      }

      if (modal.editing) await onUpdate({ ...act, id: modal.editing.id });
      else await onAdd({ ...act, id: crypto.randomUUID() });
      
      closeModal();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const isActionAllowed = (activity: Activity, action: 'edit' | 'delete') => {
    const hasBasePermission = action === 'edit' ? canEdit : canDelete;
    if (!hasBasePermission || !currentUser) return false;

    // Se estiver POSTERGADA, apenas Admin pode mexer
    if (activity.status === 'POSTERGADA' && currentUser.role !== 'Administrador') {
      return false;
    }
    
    // Gestores e Administradores podem editar/deletar qualquer coisa (além da regra acima)
    if (currentUser.role === 'Administrador' || currentUser.role === 'Gestão') return true;
    
    // Analistas só podem editar/deletar o que for deles mesmos
    return currentUser.role === 'Analista' && activity.responsavel === currentUser.id;
  };

  const getTheme = (id: string) => themes.find(t => t.id === id);
  const getUser = (id: string) => users.find(u => u.id === id);

  const thProps = { current: sortKey, dir: sortDir, onClick: handleSort };

  const exportCSV = () => {
    const headers = ['Planejamento', 'Descrição', 'Tema', 'Responsável', 'Prioridade', 'Dt.Prev.Finalização', '%Andamento', 'Dt.Finalizada', 'Dias Esperados', 'Esforço', 'Status', 'Week'];
    const rows = filteredAndSorted.map(a => {
      const temaNome = getTheme(a.tema)?.name || '';
      const userName = getUser(a.responsavel)?.name || '';
      return [
        a.planejamento,
        `"${a.descricao.replace(/"/g, '""')}"`,
        `"${temaNome}"`,
        `"${userName}"`,
        a.prioridade,
        a.dataPrevistaFinalizacao,
        a.percentualAndamento,
        a.dataFinalizada || '',
        a.diasEsperadosConclusao,
        a.esforcoRealizado,
        a.status,
        a.week || ''
      ].join(';');
    });
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(';'), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.href = encodedUri;
    link.download = `Atividades_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="tab-content">
      {/* Header */}
      <div className="tab-header">
        <div>
          <h1 className="tab-title">Atividades</h1>
          <p className="tab-subtitle">{filteredAndSorted.length} de {activities.length} atividades</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {currentUser?.role === 'Administrador' && (
            <button className="btn-ghost" onClick={exportCSV} title="Exportar para Excel (CSV)">
              <Download size={18} /> Baixar Excel
            </button>
          )}
          {canEdit && (
            <button className="btn-primary" onClick={openNew}>
              <Plus size={18} /> Nova Atividade
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="search-wrap">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Buscar atividade..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="filters">
          <Filter size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />

          <div className="select-wrap">
            <select value={filterResp} onChange={e => setFilterResp(e.target.value)}>
              <option value="all">Todos responsáveis</option>
              {filteredUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <ChevronDown size={14} className="sel-icon" />
          </div>

          <div className="select-wrap">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">Todos status</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown size={14} className="sel-icon" />
          </div>

          <div className="select-wrap">
            <select value={filterPrio} onChange={e => setFilterPrio(e.target.value)}>
              <option value="all">Todas prioridades</option>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <ChevronDown size={14} className="sel-icon" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="table-card">
        <div className="table-scroll custom-scroll" style={{ maxHeight: 'calc(100vh - 220px)', overflow: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <SortTh label="Planejamento"       sortKey="planejamento"           {...thProps} />
                <SortTh label="Descrição"           sortKey="descricao"              {...thProps} resizable />
                <SortTh label="Tema"                sortKey="tema"                   {...thProps} />
                <SortTh label="Responsável"         sortKey="responsavel"            {...thProps} />
                <SortTh label="Prioridade"          sortKey="prioridade"             {...thProps} />
                <SortTh label="Dt. Prev. Finalização" sortKey="dataPrevistaFinalizacao" {...thProps} />
                <SortTh label="% Andamento"         sortKey="percentualAndamento"    {...thProps} />
                <SortTh label="Dt. Finalizada"      sortKey="dataFinalizada"         {...thProps} />
                <SortTh label="Status"              sortKey="status"                 {...thProps} />
                <SortTh label="Week"                sortKey="week"                   {...thProps} />
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.length === 0 && (
                <tr><td colSpan={11} className="empty-row">Nenhuma atividade encontrada</td></tr>
              )}
              {filteredAndSorted.map(a => {
                const tema = getTheme(a.tema);
                const user = getUser(a.responsavel);
                return (
                  <tr key={a.id} className="data-row">
                    <td className="td-date">{fmtDate(a.planejamento)}</td>
                    <td className="td-desc">
                      <span className="desc-text" title={a.descricao}>{a.descricao}</span>
                    </td>
                    <td>
                      {tema && (
                        <span className="theme-chip" style={{ background: tema.color + '22', color: tema.color, borderColor: tema.color + '44' }}>
                          {tema.name}
                        </span>
                      )}
                    </td>
                    <td>
                      {user && (
                        <div className="user-chip">
                          <span className="user-avatar" style={{ background: user.color }}>{user.name[0]}</span>
                          <span>{user.name}</span>
                        </div>
                      )}
                    </td>
                    <td><span className={`prio-badge ${getPrioClass(a.prioridade)}`}>{a.prioridade}</span></td>
                    <td className="td-date">{fmtDate(a.dataPrevistaFinalizacao)}</td>
                    <td>
                      <div className="progress-wrap">
                        <div className="prog-bar">
                          <div className="prog-fill" style={{ width: `${a.percentualAndamento}%`, background: progColor(a.percentualAndamento) }} />
                        </div>
                        <span className="prog-txt">{a.percentualAndamento}%</span>
                      </div>
                    </td>
                    <td className="td-date">{a.dataFinalizada ? fmtDate(a.dataFinalizada) : '—'}</td>
                    <td>
                      <span className={`status-badge ${getStatusClass(a.status)}`}>
                        {getStatusIcon(a.status)}
                        {a.status}
                      </span>
                    </td>
                    <td className="td-week">{a.week}</td>
                    <td>
                      <div className="row-actions">
                        {isActionAllowed(a, 'edit') && <button className="action-btn edit" onClick={() => openEdit(a)} title="Editar"><Edit2 size={14} /></button>}
                        {isActionAllowed(a, 'delete') && <button className="action-btn del" onClick={() => setDeleteConfirm(a.id)} title="Excluir"><Trash2 size={14} /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal.open && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modal.editing ? 'Editar Atividade' : 'Nova Atividade'}</h2>
              <button className="modal-close" onClick={closeModal}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group full">
                  <label>Descrição da Tarefa *</label>
                  <textarea
                    rows={3}
                    value={form.descricao}
                    onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                    placeholder="Descreva a atividade..."
                  />
                </div>

                <div className="form-group">
                  <label>Planejamento *</label>
                  <div className="input-icon-wrap">
                    <Calendar size={15} />
                    <input type="date" value={form.planejamento} onChange={e => {
                      const date = e.target.value;
                      const d = new Date(date);
                      const day = d.getUTCDate();
                      let w = 'W1';
                      if (day > 7) w = 'W2';
                      if (day > 14) w = 'W3';
                      if (day > 21) w = 'W4';
                      const month = d.toLocaleString('pt-BR', { month: 'short' });
                      setForm(f => ({ ...f, planejamento: date, week: `${w} - ${month}` }));
                    }} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Dt. Prevista Finalização</label>
                  <div className="input-icon-wrap">
                    <Calendar size={15} />
                    <input type="date" value={form.dataPrevistaFinalizacao} onChange={e => setForm(f => ({ ...f, dataPrevistaFinalizacao: e.target.value }))} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Tema *</label>
                  <div className="select-wrap full-w">
                    <select value={form.tema} onChange={e => setForm(f => ({ ...f, tema: e.target.value }))}>
                      <option value="">Selecione...</option>
                      {themes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <ChevronDown size={14} className="sel-icon" />
                  </div>
                </div>

                <div className="form-group">
                  <label>Responsável *</label>
                  <div className="select-wrap full-w">
                    <select value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))}>
                      <option value="">Selecione...</option>
                      {filteredUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                    <ChevronDown size={14} className="sel-icon" />
                  </div>
                </div>

                <div className="form-group">
                  <label>Prioridade</label>
                  <div className="select-wrap full-w">
                    <select value={form.prioridade} onChange={e => setForm(f => ({ ...f, prioridade: e.target.value as Priority }))}>
                      {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <ChevronDown size={14} className="sel-icon" />
                  </div>
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <div className="select-wrap full-w">
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Status }))}>
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown size={14} className="sel-icon" />
                  </div>
                </div>

                <div className="form-group">
                  <label>% Andamento</label>
                  <input type="number" min={0} max={100} value={form.percentualAndamento}
                    onChange={e => {
                      const val = Number(e.target.value);
                      setForm(f => ({ 
                        ...f, 
                        percentualAndamento: val,
                        // Se for 100% e não tiver data, coloca hoje. E muda status para FINALIZADA.
                        dataFinalizada: (val === 100 && !f.dataFinalizada) ? new Date().toISOString().slice(0, 10) : f.dataFinalizada,
                        status: val === 100 ? 'FINALIZADA' : (val > 0 ? 'EM ANDAMENTO' : 'PENDENTE')
                      }));
                    }} />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Comentário / Justificativa</label>
                  <textarea 
                    value={form.comentario}
                    placeholder="Adicione um comentário ou motivo do adiamento..."
                    rows={3}
                    onChange={e => {
                      const val = e.target.value;
                      setForm(f => ({ 
                        ...f, 
                        comentario: val,
                        dataComentario: val ? new Date().toLocaleString('pt-BR') : ''
                      }));
                    }}
                  />
                  {form.dataComentario && (
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block', marginTop: '4px' }}>
                      Último comentário em: {form.dataComentario}
                    </small>
                  )}
                </div>

                <div className="form-group">
                  <label>{form.status === 'POSTERGADA' ? 'Nova Data' : 'Dt. Finalizada'}</label>
                  <div className="input-icon-wrap">
                    <Calendar size={15} />
                    <input type="date" value={form.dataFinalizada ?? ''} onChange={e => {
                      const date = e.target.value;
                      setForm(f => ({ 
                        ...f, 
                        dataFinalizada: date,
                        // Se informou data, assume 100% e status FINALIZADA (se não estiver postergado)
                        percentualAndamento: (date && f.status !== 'POSTERGADA') ? 100 : f.percentualAndamento,
                        status: (date && f.status !== 'POSTERGADA' && f.status !== 'FINALIZADA') ? 'FINALIZADA' : f.status
                      }));
                    }} />
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={closeModal} disabled={isSaving}>Cancelar</button>
              <button className="btn-primary" onClick={handleSave} disabled={isSaving}>
                {isSaving ? <RefreshCw size={16} className="spinner" /> : <Save size={16} />}
                {isSaving ? 'Salvando...' : (modal.editing ? 'Salvar Alterações' : 'Adicionar')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="confirm-box" onClick={e => e.stopPropagation()}>
            <Trash2 size={36} style={{ color: '#ef4444', marginBottom: '1rem' }} />
            <h3>Excluir atividade?</h3>
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '1.5rem' }}>
              Esta ação não pode ser desfeita.
            </p>
            <div className="confirm-actions">
              <button className="btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancelar</button>
              <button className="btn-danger" onClick={() => { onDelete(deleteConfirm!); setDeleteConfirm(null); }}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function fmtDate(d?: string) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function progColor(v: number) {
  if (v === 100) return '#10b981';
  if (v >= 50) return '#3b82f6';
  if (v > 0) return '#f59e0b';
  return '#ef4444';
}
