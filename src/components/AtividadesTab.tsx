import { useState, useMemo } from 'react';
import {
  Plus, Search, Filter, ChevronDown, Edit2, Trash2,
  CheckCircle2, Clock, AlertCircle, X, Calendar, Save,
  ChevronsUpDown, ChevronUp, Download
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
const STATUSES: Status[] = ['PENDENTE', 'EM ANDAMENTO', 'FINALIZADA'];

const PRIO_ORDER: Record<Priority, number> = { Alta: 0, Média: 1, Baixa: 2 };
const STATUS_ORDER: Record<Status, number> = { PENDENTE: 0, 'EM ANDAMENTO': 1, FINALIZADA: 2 };

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
});

// ── Sortable column header ─────────────────────────────────
function SortTh({
  label, sortKey, current, dir, onClick
}: {
  label: string; sortKey: SortKey; current: SortKey; dir: SortDir; onClick: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <th
      className={`sortable-th ${active ? 'sort-active' : ''}`}
      onClick={() => onClick(sortKey)}
    >
      <div className="th-inner">
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

  // Apenas analistas aparecem nos dropdowns e na lista de atividades
  const filteredUsers = useMemo(() => {
    return users.filter(u => u.role !== 'Administrador' && u.role !== 'Gestão');
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

  const handleSave = () => {
    if (!form.descricao.trim() || !form.responsavel || !form.tema) return;
    if (modal.editing) onUpdate({ ...form, id: modal.editing.id });
    else onAdd({ ...form, id: crypto.randomUUID() });
    closeModal();
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
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <SortTh label="Planejamento"       sortKey="planejamento"           {...thProps} />
                <SortTh label="Descrição"           sortKey="descricao"              {...thProps} />
                <SortTh label="Tema"                sortKey="tema"                   {...thProps} />
                <SortTh label="Responsável"         sortKey="responsavel"            {...thProps} />
                <SortTh label="Prioridade"          sortKey="prioridade"             {...thProps} />
                <SortTh label="Dt. Prev. Finalização" sortKey="dataPrevistaFinalizacao" {...thProps} />
                <SortTh label="% Andamento"         sortKey="percentualAndamento"    {...thProps} />
                <SortTh label="Dt. Finalizada"      sortKey="dataFinalizada"         {...thProps} />
                <SortTh label="Dias Esperados"      sortKey="diasEsperadosConclusao" {...thProps} />
                <SortTh label="Esforço"             sortKey="esforcoRealizado"       {...thProps} />
                <SortTh label="Status"              sortKey="status"                 {...thProps} />
                <SortTh label="Week"                sortKey="week"                   {...thProps} />
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.length === 0 && (
                <tr><td colSpan={13} className="empty-row">Nenhuma atividade encontrada</td></tr>
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
                    <td className={`td-num ${a.diasEsperadosConclusao < 0 ? 'neg' : ''}`}>{a.diasEsperadosConclusao}</td>
                    <td className="td-num">{a.esforcoRealizado}</td>
                    <td>
                      <span className={`status-badge ${getStatusClass(a.status)}`}>
                        {getStatusIcon(a.status)}
                        {a.status}
                      </span>
                    </td>
                    <td className="td-week">{a.week}</td>
                    <td>
                      <div className="row-actions">
                        {canEdit && <button className="action-btn edit" onClick={() => openEdit(a)} title="Editar"><Edit2 size={14} /></button>}
                        {canDelete && <button className="action-btn del" onClick={() => setDeleteConfirm(a.id)} title="Excluir"><Trash2 size={14} /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Formulário */}
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
                    <input type="date" value={form.planejamento} onChange={e => setForm(f => ({ ...f, planejamento: e.target.value }))} />
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
                    onChange={e => setForm(f => ({ ...f, percentualAndamento: Number(e.target.value) }))} />
                </div>

                <div className="form-group">
                  <label>Dt. Finalizada</label>
                  <div className="input-icon-wrap">
                    <Calendar size={15} />
                    <input type="date" value={form.dataFinalizada ?? ''} onChange={e => setForm(f => ({ ...f, dataFinalizada: e.target.value }))} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Dias Esperados p/ Conclusão</label>
                  <input type="number" value={form.diasEsperadosConclusao}
                    onChange={e => setForm(f => ({ ...f, diasEsperadosConclusao: Number(e.target.value) }))} />
                </div>

                <div className="form-group">
                  <label>Esforço Realizado (dias)</label>
                  <input type="number" min={0} value={form.esforcoRealizado}
                    onChange={e => setForm(f => ({ ...f, esforcoRealizado: Number(e.target.value) }))} />
                </div>

                <div className="form-group">
                  <label>Week</label>
                  <input type="text" placeholder="ex: W2 - Mar" value={form.week}
                    onChange={e => setForm(f => ({ ...f, week: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={closeModal}>Cancelar</button>
              <button className="btn-primary" onClick={handleSave}>
                <Save size={16} /> {modal.editing ? 'Salvar Alterações' : 'Adicionar'}
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
