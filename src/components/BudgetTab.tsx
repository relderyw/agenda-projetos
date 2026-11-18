import { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Search,
  Filter, Download, Edit2, Trash2, X, Save, DollarSign,
  GraduationCap, Plane, Laptop, CheckCircle2, Clock, AlertCircle,
  FileSpreadsheet, Sparkles, Building, MapPin, Users as UsersIcon,
  HelpCircle, ChevronDown
} from 'lucide-react';
import type { BudgetItem, BudgetType, BudgetStatus, BudgetModalidade, User } from '../types';
import { INITIAL_BUDGET_ITEMS } from '../data/defaultBudget';

interface Props {
  currentUser: User | null;
  users: User[];
  budgetItems: BudgetItem[];
  onAddBudgetItem: (item: BudgetItem) => Promise<void> | void;
  onUpdateBudgetItem: (item: BudgetItem) => Promise<void> | void;
  onDeleteBudgetItem: (id: string) => Promise<void> | void;
  onImportDefaultBudget?: () => Promise<void> | void;
  showToast?: (type: 'success' | 'error' | 'info', title: string, msg: string) => void;
}

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const STATUS_LIST: BudgetStatus[] = [
  'Orçado',
  'Solicitado',
  'Em Aprovação',
  'Concluído',
  'Cancelado',
  'Não Solicitado'
];

const CATEGORIAS_EQUIPAMENTO = [
  'Computadores e Periféricos',
  'Equipamentos',
  'Celulares',
  'Mobiliário & Escritório',
  'Ferramentas & Medição',
  'Licenças de Software',
  'Outros'
];

function formatMoney(val: number): string {
  if (isNaN(val)) return 'R$ 0,00';
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function getStatusBadgeClass(status: BudgetStatus): string {
  switch (status) {
    case 'Concluído': return 'bg-status-done';
    case 'Em Aprovação': return 'bg-status-approval';
    case 'Solicitado': return 'bg-status-requested';
    case 'Orçado': return 'bg-status-budgeted';
    case 'Cancelado': return 'bg-status-cancelled';
    case 'Não Solicitado': return 'bg-status-notsolicited';
    default: return '';
  }
}

function getTypeIcon(tipo: BudgetType) {
  switch (tipo) {
    case 'curso': return <GraduationCap size={15} />;
    case 'viagem': return <Plane size={15} />;
    case 'equipamento': return <Laptop size={15} />;
  }
}

function getTypeLabel(tipo: BudgetType): string {
  switch (tipo) {
    case 'curso': return 'Curso / Treinamento';
    case 'viagem': return 'Viagem / Evento';
    case 'equipamento': return 'Equipamento / Bem';
  }
}

const emptyItem = (tipo: BudgetType = 'curso', initialDate?: string): Omit<BudgetItem, 'id'> => ({
  tipo,
  descricao: '',
  dataPlanejada: initialDate || new Date().toISOString().slice(0, 10),
  dataSolicitada: '',
  status: 'Orçado',
  modalidade: tipo === 'viagem' ? 'Presencial' : 'Remoto',
  quantidade: 1,
  valorUnitario: 0,
  valorTotal: 0,
  justificativa: '',
  colaboradores: [],
  cargos: '',
  evento: '',
  dataEvento: '',
  dataViagemIda: '',
  dataViagemVolta: '',
  cidade: '',
  categoria: tipo === 'equipamento' ? 'Computadores e Periféricos' : undefined,
  motivo: '',
  anoFrota: '',
  objetivo: 'Eficiência'
});

export default function BudgetTab({
  currentUser,
  users,
  budgetItems,
  onAddBudgetItem,
  onUpdateBudgetItem,
  onDeleteBudgetItem,
  onImportDefaultBudget,
  showToast
}: Props) {
  // Permissões
  const isSuperAdmin = currentUser?.role === 'Super Admin';
  const isAdmin = currentUser?.role === 'Administrador';
  const isGestao = currentUser?.role === 'Gestão' || currentUser?.role === 'Gestao';
  const canView = isSuperAdmin || isAdmin || isGestao || (currentUser?.permissions?.budget?.view ?? true);
  const canEdit = isSuperAdmin || isAdmin || isGestao || (currentUser?.permissions?.budget?.edit ?? false);
  const canDelete = isSuperAdmin || isAdmin || (currentUser?.permissions?.budget?.delete ?? false);

  // Estados de navegação e visualização
  const [viewMode, setViewMode] = useState<'calendar' | 'table'>('calendar');
  const [currentDate, setCurrentDate] = useState(() => {
    // Se temos itens de 2027/2028, podemos iniciar no mês do primeiro item ou no atual
    const hasItems = budgetItems.length > 0;
    if (hasItems) {
      const sorted = [...budgetItems].sort((a, b) => a.dataPlanejada.localeCompare(b.dataPlanejada));
      const firstDate = new Date(sorted[0].dataPlanejada + 'T00:00:00');
      if (!isNaN(firstDate.getTime())) return firstDate;
    }
    return new Date();
  });

  // Filtros
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterModalidade, setFilterModalidade] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal de edição / criação
  const [modal, setModal] = useState<{ open: boolean; editing: BudgetItem | null }>({ open: false, editing: null });
  const [form, setForm] = useState<Omit<BudgetItem, 'id'>>(emptyItem());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [newColabInput, setNewColabInput] = useState('');

  // Cálculos do Calendário
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const daysInMonth = useMemo(() => {
    return new Date(currentYear, currentMonth + 1, 0).getDate();
  }, [currentYear, currentMonth]);

  const firstDayOfWeek = useMemo(() => {
    return new Date(currentYear, currentMonth, 1).getDay();
  }, [currentYear, currentMonth]);

  // Itens filtrados para o calendário ou tabela
  const filteredItems = useMemo(() => {
    return budgetItems.filter(item => {
      if (filterType !== 'all' && item.tipo !== filterType) return false;
      if (filterStatus !== 'all' && item.status !== filterStatus) return false;
      if (filterModalidade !== 'all' && item.modalidade !== filterModalidade) return false;

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const inDesc = item.descricao.toLowerCase().includes(term);
        const inEvento = (item.evento || '').toLowerCase().includes(term);
        const inCidade = (item.cidade || '').toLowerCase().includes(term);
        const inColab = (item.colaboradores || []).some(c => c.toLowerCase().includes(term));
        const inMotivo = (item.motivo || item.justificativa || '').toLowerCase().includes(term);
        const inCategoria = (item.categoria || '').toLowerCase().includes(term);
        if (!inDesc && !inEvento && !inCidade && !inColab && !inMotivo && !inCategoria) return false;
      }
      return true;
    });
  }, [budgetItems, filterType, filterStatus, filterModalidade, searchTerm]);

  // Itens mapeados por dia do mês atual (para a visão calendário)
  const itemsByDay = useMemo(() => {
    const map: Record<number, BudgetItem[]> = {};
    const prefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-`;

    filteredItems.forEach(item => {
      if (item.dataPlanejada && item.dataPlanejada.startsWith(prefix)) {
        const day = parseInt(item.dataPlanejada.split('-')[2], 10);
        if (!map[day]) map[day] = [];
        map[day].push(item);
      }
    });

    return map;
  }, [filteredItems, currentYear, currentMonth]);

  // KPIs Financeiros
  const kpis = useMemo(() => {
    const totalGeral = budgetItems.reduce((acc, i) => acc + (i.valorTotal || 0), 0);
    const totalCursos = budgetItems.filter(i => i.tipo === 'curso').reduce((acc, i) => acc + (i.valorTotal || 0), 0);
    const countCursos = budgetItems.filter(i => i.tipo === 'curso').length;

    const totalViagens = budgetItems.filter(i => i.tipo === 'viagem').reduce((acc, i) => acc + (i.valorTotal || 0), 0);
    const countViagens = budgetItems.filter(i => i.tipo === 'viagem').length;

    const totalEquip = budgetItems.filter(i => i.tipo === 'equipamento').reduce((acc, i) => acc + (i.valorTotal || 0), 0);
    const countEquip = budgetItems.filter(i => i.tipo === 'equipamento').length;

    // Total deste mês
    const prefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-`;
    const mesItems = budgetItems.filter(i => i.dataPlanejada && i.dataPlanejada.startsWith(prefix));
    const totalMes = mesItems.reduce((acc, i) => acc + (i.valorTotal || 0), 0);

    return {
      totalGeral,
      totalCursos,
      countCursos,
      totalViagens,
      countViagens,
      totalEquip,
      countEquip,
      totalMes,
      countMes: mesItems.length
    };
  }, [budgetItems, currentYear, currentMonth]);

  // Handlers de Abertura do Modal
  const openNew = (defaultDate?: string) => {
    setNewColabInput('');
    setForm(emptyItem('curso', defaultDate));
    setModal({ open: true, editing: null });
  };

  const openEdit = (item: BudgetItem) => {
    setNewColabInput('');
    setForm({
      ...item,
      colaboradores: item.colaboradores ? [...item.colaboradores] : []
    });
    setModal({ open: true, editing: item });
  };

  const closeModal = () => {
    setModal({ open: false, editing: null });
  };

  // Atualização dinâmica de valores no Form
  const handleTypeChange = (newType: BudgetType) => {
    setForm(f => ({
      ...f,
      tipo: newType,
      modalidade: newType === 'viagem' ? 'Presencial' : f.modalidade,
      categoria: newType === 'equipamento' ? (f.categoria || 'Computadores e Periféricos') : undefined
    }));
  };

  const handleUnitOrQtyChange = (field: 'valorUnitario' | 'quantidade', val: number) => {
    setForm(f => {
      const qty = field === 'quantidade' ? Math.max(1, val) : f.quantidade;
      const unit = field === 'valorUnitario' ? Math.max(0, val) : f.valorUnitario;
      return {
        ...f,
        quantidade: qty,
        valorUnitario: unit,
        valorTotal: qty * unit
      };
    });
  };

  const handleAddColaborador = (nome: string) => {
    if (!nome.trim()) return;
    setForm(f => {
      const current = f.colaboradores || [];
      if (current.includes(nome.trim())) return f;
      const updated = [...current, nome.trim()];
      // Se for curso ou viagem, recalcula quantidade se apropriado
      const newQty = f.tipo === 'curso' ? updated.length : f.quantidade;
      return {
        ...f,
        colaboradores: updated,
        quantidade: newQty,
        valorTotal: newQty * f.valorUnitario
      };
    });
    setNewColabInput('');
  };

  const handleRemoveColaborador = (nome: string) => {
    setForm(f => {
      const updated = (f.colaboradores || []).filter(c => c !== nome);
      const newQty = f.tipo === 'curso' ? Math.max(1, updated.length) : f.quantidade;
      return {
        ...f,
        colaboradores: updated,
        quantidade: newQty,
        valorTotal: newQty * f.valorUnitario
      };
    });
  };

  // Salvar Item
  const handleSave = async () => {
    if (!form.descricao.trim() && form.tipo !== 'viagem') {
      alert('Por favor, informe a descrição do item.');
      return;
    }
    if (form.tipo === 'viagem' && !form.evento && !form.descricao) {
      alert('Por favor, informe o nome do evento ou da viagem.');
      return;
    }
    if (!form.dataPlanejada) {
      alert('A data planejada é obrigatória.');
      return;
    }

    setIsSaving(true);
    try {
      const payload: BudgetItem = {
        ...form,
        id: modal.editing ? modal.editing.id : crypto.randomUUID(),
        descricao: form.descricao || form.evento || 'Lançamento de Budget'
      };

      if (modal.editing) {
        await onUpdateBudgetItem(payload);
        showToast?.('success', 'Budget Atualizado', 'Item atualizado com sucesso.');
      } else {
        await onAddBudgetItem(payload);
        showToast?.('success', 'Item Cadastrado', 'Novo item inserido no Budget.');
      }
      closeModal();
    } catch (err: any) {
      console.error(err);
      showToast?.('error', 'Erro ao salvar', err.message || 'Falha na conexão com o banco.');
    } finally {
      setIsSaving(false);
    }
  };

  // Exclusão
  const handleDelete = async (id: string) => {
    try {
      await onDeleteBudgetItem(id);
      showToast?.('info', 'Item Removido', 'O registro foi excluído do Budget.');
    } catch (err: any) {
      showToast?.('error', 'Erro ao excluir', 'Não foi possível remover o item.');
    } finally {
      setDeleteConfirm(null);
    }
  };

  // Importar dados padrão da planilha
  const handleImportDefaults = async () => {
    if (!confirm('Deseja importar os dados orçamentários da planilha base para o sistema?')) return;
    try {
      if (onImportDefaultBudget) {
        await onImportDefaultBudget();
      } else {
        for (const item of INITIAL_BUDGET_ITEMS) {
          await onAddBudgetItem({
            ...item,
            id: crypto.randomUUID()
          });
        }
      }
      showToast?.('success', 'Planilha Importada', `${INITIAL_BUDGET_ITEMS.length} registros foram sincronizados.`);
    } catch (err: any) {
      showToast?.('error', 'Erro na importação', 'Não foi possível carregar a planilha.');
    }
  };

  // Exportar para Excel / CSV
  const exportCSV = () => {
    const headers = [
      'Tipo',
      'Categoria',
      'Descrição / Evento',
      'Cidade',
      'Colaboradores',
      'Cargos',
      'Data Planejada',
      'Data Solicitada',
      'Modalidade',
      'Quantidade',
      'Valor Unitário (R$)',
      'Valor Total (R$)',
      'Status',
      'Justificativa / Motivo'
    ];

    const rows = filteredItems.map(i => [
      i.tipo.toUpperCase(),
      `"${(i.categoria || '').replace(/"/g, '""')}"`,
      `"${(i.descricao || i.evento || '').replace(/"/g, '""')}"`,
      `"${(i.cidade || '').replace(/"/g, '""')}"`,
      `"${(i.colaboradores || []).join(', ').replace(/"/g, '""')}"`,
      `"${(i.cargos || '').replace(/"/g, '""')}"`,
      i.dataPlanejada,
      i.dataSolicitada || '',
      i.modalidade,
      i.quantidade,
      i.valorUnitario,
      i.valorTotal,
      i.status,
      `"${(i.justificativa || i.motivo || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.href = encodedUri;
    link.download = `Budget_Projetos_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!canView) {
    return (
      <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <AlertCircle size={48} color="#ef4444" style={{ marginBottom: '1rem' }} />
        <h2 style={{ color: 'var(--text-primary)' }}>Acesso Restrito ao Budget</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 420, textAlign: 'center', marginTop: '0.5rem' }}>
          Você não possui permissão para visualizar o planejamento orçamentário. Contate a administração ou gestão para liberar o acesso.
        </p>
      </div>
    );
  }

  return (
    <div className="tab-content budget-root">
      {/* ── HEADER ── */}
      <div className="tab-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 className="tab-title">Budget / Orçamento</h1>
            <span className="budget-kpi-badge">
              {MONTHS[currentMonth]} {currentYear}
            </span>
          </div>
          <p className="tab-subtitle">
            Gestão orçamentária de Cursos, Viagens e Equipamentos de Projetos e T&P
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Alternador de visualização */}
          <div className="budget-view-switch">
            <button
              type="button"
              className={`view-switch-btn ${viewMode === 'calendar' ? 'active' : ''}`}
              onClick={() => setViewMode('calendar')}
              title="Visualizar no formato Calendário estilo Henkaten"
            >
              <CalendarIcon size={15} /> Calendário
            </button>
            <button
              type="button"
              className={`view-switch-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Visualizar no formato Tabela / Planilha"
            >
              <FileSpreadsheet size={15} /> Tabela
            </button>
          </div>

          {budgetItems.length === 0 && canEdit && (
            <button
              className="btn-ghost"
              onClick={handleImportDefaults}
              title="Importar registros iniciais da planilha de budget"
              style={{ borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' }}
            >
              <Sparkles size={16} /> Carregar Planilha Base
            </button>
          )}

          <button className="btn-ghost" onClick={exportCSV} title="Exportar para Excel (CSV)">
            <Download size={16} /> Baixar Excel
          </button>

          {canEdit && (
            <button className="btn-primary" onClick={() => openNew()}>
              <Plus size={16} /> Novo Lançamento
            </button>
          )}
        </div>
      </div>

      {/* ── KPI METRICS SUMMARY ── */}
      <div className="budget-kpis-grid">
        <div className="budget-kpi-card total">
          <div className="kpi-icon-wrap total">
            <DollarSign size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">TOTAL GERAL ORÇADO</span>
            <span className="kpi-value">{formatMoney(kpis.totalGeral)}</span>
            <span className="kpi-subtext">{budgetItems.length} lançamentos no ciclo</span>
          </div>
        </div>

        <div className="budget-kpi-card month">
          <div className="kpi-icon-wrap month">
            <CalendarIcon size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">ORÇADO EM {MONTHS[currentMonth].toUpperCase()}</span>
            <span className="kpi-value">{formatMoney(kpis.totalMes)}</span>
            <span className="kpi-subtext">{kpis.countMes} itens previstos para este mês</span>
          </div>
        </div>

        <div className="budget-kpi-card cursos">
          <div className="kpi-icon-wrap cursos">
            <GraduationCap size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">CURSOS & TREINAMENTOS</span>
            <span className="kpi-value">{formatMoney(kpis.totalCursos)}</span>
            <span className="kpi-subtext">{kpis.countCursos} capacitações mapeadas</span>
          </div>
        </div>

        <div className="budget-kpi-card viagens">
          <div className="kpi-icon-wrap viagens">
            <Plane size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">VIAGENS & EVENTOS</span>
            <span className="kpi-value">{formatMoney(kpis.totalViagens)}</span>
            <span className="kpi-subtext">{kpis.countViagens} eventos e visitas</span>
          </div>
        </div>

        <div className="budget-kpi-card equip">
          <div className="kpi-icon-wrap equip">
            <Laptop size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">EQUIPAMENTOS & BENS</span>
            <span className="kpi-value">{formatMoney(kpis.totalEquip)}</span>
            <span className="kpi-subtext">{kpis.countEquip} itens e máquinas</span>
          </div>
        </div>
      </div>

      {/* ── BARRA DE FILTROS ── */}
      <div className="filter-bar" style={{ marginTop: '0.75rem', marginBottom: '1rem' }}>
        <div className="search-wrap">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Buscar por descrição, evento, colaborador, categoria ou cidade..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filters">
          <Filter size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />

          <div className="select-wrap">
            <select value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="all">Todos os tipos</option>
              <option value="curso">🎓 Cursos</option>
              <option value="viagem">✈️ Viagens</option>
              <option value="equipamento">💻 Equipamentos</option>
            </select>
            <ChevronDown size={14} className="sel-icon" />
          </div>

          <div className="select-wrap">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">Todos os status</option>
              {STATUS_LIST.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
            <ChevronDown size={14} className="sel-icon" />
          </div>

          <div className="select-wrap">
            <select value={filterModalidade} onChange={e => setFilterModalidade(e.target.value)}>
              <option value="all">Todas modalidades</option>
              <option value="Presencial">Presencial</option>
              <option value="Remoto">Remoto</option>
            </select>
            <ChevronDown size={14} className="sel-icon" />
          </div>
        </div>
      </div>

      {/* ── VISÃO 1: CALENDÁRIO ESTILO HENKATEN ── */}
      {viewMode === 'calendar' && (
        <div className="hk-calendar-card">
          {/* Header do Mês */}
          <div className="hk-calendar-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div className="hk-month-nav">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setCurrentDate(new Date(currentYear, currentMonth - 1, 1))}
                  title="Mês Anterior"
                  style={{ padding: '6px 10px' }}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setCurrentDate(new Date())}
                  title="Ir para o mês atual"
                  style={{ padding: '6px 12px', fontSize: '0.85rem', fontWeight: 600 }}
                >
                  Hoje
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setCurrentDate(new Date(currentYear, currentMonth + 1, 1))}
                  title="Próximo Mês"
                  style={{ padding: '6px 10px' }}
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {MONTHS[currentMonth]}
                </span>
                <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
                  {currentYear}
                </span>
              </div>
            </div>

            {/* Legenda rápida */}
            <div className="budget-calendar-legend">
              <span className="legend-chip curso"><GraduationCap size={13} /> Curso</span>
              <span className="legend-chip viagem"><Plane size={13} /> Viagem</span>
              <span className="legend-chip equip"><Laptop size={13} /> Equipamento</span>
            </div>
          </div>

          {/* Grade de Dias da Semana */}
          <div className="hk-calendar-grid">
            {WEEK_DAYS.map(day => (
              <div key={day} className="hk-weekday">
                {day}
              </div>
            ))}

            {/* Células Vazias antes do primeiro dia */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="hk-day-cell hk-day-empty" />
            ))}

            {/* Dias do Mês */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const dayItems = itemsByDay[dayNum] || [];
              const dayTotal = dayItems.reduce((acc, item) => acc + (item.valorTotal || 0), 0);
              const isToday = new Date().toISOString().slice(0, 10) === dateStr;

              return (
                <div
                  key={dayNum}
                  className={`hk-day-cell ${isToday ? 'hk-day-today' : ''}`}
                  onClick={() => canEdit && openNew(dateStr)}
                  title={canEdit ? `Clique para adicionar lançamento no dia ${dayNum}/${currentMonth + 1}/${currentYear}` : undefined}
                >
                  <div className="hk-day-header">
                    <span className="hk-day-number">{dayNum}</span>
                    {dayTotal > 0 && (
                      <span className="budget-day-total">
                        {formatMoney(dayTotal)}
                      </span>
                    )}
                  </div>

                  <div className="budget-day-items custom-scroll">
                    {dayItems.map(item => (
                      <div
                        key={item.id}
                        className={`budget-item-badge ${item.tipo} ${getStatusBadgeClass(item.status)}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(item);
                        }}
                        title={`${getTypeLabel(item.tipo)}: ${item.descricao} - ${formatMoney(item.valorTotal)} (${item.status})`}
                      >
                        <div className="badge-icon-box">
                          {getTypeIcon(item.tipo)}
                        </div>
                        <div className="badge-details">
                          <span className="badge-title">{item.descricao}</span>
                          <span className="badge-price">{formatMoney(item.valorTotal)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── VISÃO 2: TABELA / PLANILHA ── */}
      {viewMode === 'table' && (
        <div className="table-card">
          <div className="table-scroll custom-scroll" style={{ maxHeight: 'calc(100vh - 280px)', overflow: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Descrição / Evento</th>
                  <th>Categoria / Cidade</th>
                  <th>Colaboradores</th>
                  <th>Data Planejada</th>
                  <th>Data Solicitada</th>
                  <th>Mod.</th>
                  <th>Qtd</th>
                  <th>Vlr. Unitário</th>
                  <th>Vlr. Total</th>
                  <th>Status</th>
                  <th style={{ width: 80 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={12} className="empty-row">
                      Nenhum registro de budget encontrado com os filtros selecionados.
                    </td>
                  </tr>
                )}
                {filteredItems.map(item => (
                  <tr key={item.id} className="data-row">
                    <td>
                      <span className={`budget-type-pill ${item.tipo}`}>
                        {getTypeIcon(item.tipo)}
                        <span>{item.tipo.toUpperCase()}</span>
                      </span>
                    </td>
                    <td className="td-desc">
                      <span className="desc-text" style={{ fontWeight: 600 }}>{item.descricao}</span>
                      {item.motivo && (
                        <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                          {item.motivo}
                        </small>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {item.categoria || item.cidade || '—'}
                      </span>
                    </td>
                    <td>
                      {item.colaboradores && item.colaboradores.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                          {item.colaboradores.slice(0, 3).map((c, idx) => (
                            <span key={idx} className="budget-colab-tag" title={c}>{c}</span>
                          ))}
                          {item.colaboradores.length > 3 && (
                            <span className="budget-colab-tag more">+{item.colaboradores.length - 3}</span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-faint)' }}>—</span>
                      )}
                    </td>
                    <td className="td-date">{item.dataPlanejada}</td>
                    <td className="td-date">{item.dataSolicitada || '—'}</td>
                    <td>
                      <span className={`budget-modalidade-tag ${item.modalidade === 'Remoto' ? 'remoto' : 'presencial'}`}>
                        {item.modalidade}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{item.quantidade}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                      {formatMoney(item.valorUnitario)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--accent-primary)' }}>
                      {formatMoney(item.valorTotal)}
                    </td>
                    <td>
                      <span className={`status-badge ${getStatusBadgeClass(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        {canEdit && (
                          <button
                            className="action-btn edit"
                            onClick={() => openEdit(item)}
                            title="Editar"
                          >
                            <Edit2 size={14} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            className="action-btn del"
                            onClick={() => setDeleteConfirm(item.id)}
                            title="Excluir"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL DE CRIAÇÃO / EDIÇÃO ── */}
      {modal.open && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-box lg" onClick={e => e.stopPropagation()} style={{ maxWidth: '720px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={`budget-type-pill ${form.tipo}`}>
                  {getTypeIcon(form.tipo)}
                </span>
                <h2>{modal.editing ? 'Editar Lançamento de Budget' : 'Novo Lançamento de Budget'}</h2>
              </div>
              <button className="modal-close" onClick={closeModal}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {/* Seleção de Tipo (Abas no topo do modal) */}
              <div className="budget-type-tabs">
                <button
                  type="button"
                  className={`type-tab-btn ${form.tipo === 'curso' ? 'active curso' : ''}`}
                  onClick={() => handleTypeChange('curso')}
                >
                  <GraduationCap size={16} /> Curso / Treinamento
                </button>
                <button
                  type="button"
                  className={`type-tab-btn ${form.tipo === 'viagem' ? 'active viagem' : ''}`}
                  onClick={() => handleTypeChange('viagem')}
                >
                  <Plane size={16} /> Viagem / Evento
                </button>
                <button
                  type="button"
                  className={`type-tab-btn ${form.tipo === 'equipamento' ? 'active equip' : ''}`}
                  onClick={() => handleTypeChange('equipamento')}
                >
                  <Laptop size={16} /> Equipamento / Bem
                </button>
              </div>

              <div className="form-grid">
                {/* ── CAMPOS SE CURSO ── */}
                {form.tipo === 'curso' && (
                  <>
                    <div className="form-group full">
                      <label>Nome do Curso / Capacitação *</label>
                      <input
                        type="text"
                        placeholder="Ex: Excel Avançado, Lean Six Sigma, Inteligência Artificial..."
                        value={form.descricao}
                        onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                      />
                    </div>

                    <div className="form-group full">
                      <label>Colaboradores Participantes (1 ou mais)</label>
                      <div className="budget-colab-selector">
                        <div className="colab-tags-wrap">
                          {(form.colaboradores || []).map((c, idx) => (
                            <span key={idx} className="colab-chip">
                              {c}
                              <button
                                type="button"
                                onClick={() => handleRemoveColaborador(c)}
                                title="Remover"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          ))}
                        </div>

                        <div className="colab-input-row">
                          <input
                            type="text"
                            placeholder="Adicionar nome do colaborador..."
                            value={newColabInput}
                            onChange={e => setNewColabInput(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddColaborador(newColabInput);
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => handleAddColaborador(newColabInput)}
                            style={{ padding: '6px 12px' }}
                          >
                            <Plus size={14} /> Adicionar
                          </button>
                        </div>

                        {/* Sugestões rápidas de analistas cadastrados */}
                        <div className="colab-suggestions">
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Sugestões da equipe:</span>
                          {users.filter(u => !(form.colaboradores || []).includes(u.name)).slice(0, 6).map(u => (
                            <button
                              key={u.id}
                              type="button"
                              className="suggestion-pill"
                              onClick={() => handleAddColaborador(u.name)}
                            >
                              + {u.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Cargos Envolvidos</label>
                      <input
                        type="text"
                        placeholder="Ex: Analistas e Assistentes, Especialistas..."
                        value={form.cargos || ''}
                        onChange={e => setForm(f => ({ ...f, cargos: e.target.value }))}
                      />
                    </div>
                  </>
                )}

                {/* ── CAMPOS SE VIAGEM ── */}
                {form.tipo === 'viagem' && (
                  <>
                    <div className="form-group full">
                      <label>Nome do Evento / Visita Técnica *</label>
                      <input
                        type="text"
                        placeholder="Ex: Fispal Tecnologia 2027, Visita Fornecedor Musashi..."
                        value={form.evento || form.descricao}
                        onChange={e => setForm(f => ({ ...f, evento: e.target.value, descricao: e.target.value }))}
                      />
                    </div>

                    <div className="form-group">
                      <label>Cidade / Destino *</label>
                      <div className="input-icon-wrap">
                        <MapPin size={15} />
                        <input
                          type="text"
                          placeholder="Ex: São Paulo - SP, Joinville - SC..."
                          value={form.cidade || ''}
                          onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Data do Evento</label>
                      <div className="input-icon-wrap">
                        <CalendarIcon size={15} />
                        <input
                          type="date"
                          value={form.dataEvento || ''}
                          onChange={e => setForm(f => ({ ...f, dataEvento: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Data Viagem (Ida)</label>
                      <div className="input-icon-wrap">
                        <CalendarIcon size={15} />
                        <input
                          type="date"
                          value={form.dataViagemIda || ''}
                          onChange={e => setForm(f => ({ ...f, dataViagemIda: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Data Viagem (Volta)</label>
                      <div className="input-icon-wrap">
                        <CalendarIcon size={15} />
                        <input
                          type="date"
                          value={form.dataViagemVolta || ''}
                          onChange={e => setForm(f => ({ ...f, dataViagemVolta: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="form-group full">
                      <label>Colaboradores Viajantes</label>
                      <div className="budget-colab-selector">
                        <div className="colab-tags-wrap">
                          {(form.colaboradores || []).map((c, idx) => (
                            <span key={idx} className="colab-chip">
                              {c}
                              <button
                                type="button"
                                onClick={() => handleRemoveColaborador(c)}
                                title="Remover"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          ))}
                        </div>

                        <div className="colab-input-row">
                          <input
                            type="text"
                            placeholder="Adicionar viajante..."
                            value={newColabInput}
                            onChange={e => setNewColabInput(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddColaborador(newColabInput);
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => handleAddColaborador(newColabInput)}
                            style={{ padding: '6px 12px' }}
                          >
                            <Plus size={14} /> Adicionar
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* ── CAMPOS SE EQUIPAMENTO ── */}
                {form.tipo === 'equipamento' && (
                  <>
                    <div className="form-group full">
                      <label>Descrição do Bem / Equipamento *</label>
                      <input
                        type="text"
                        placeholder="Ex: Notebook, Sorter, AMR, Cadeira para Escritório..."
                        value={form.descricao}
                        onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                      />
                    </div>

                    <div className="form-group">
                      <label>Categoria do Bem</label>
                      <div className="select-wrap full-w">
                        <select
                          value={form.categoria || CATEGORIAS_EQUIPAMENTO[0]}
                          onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                        >
                          {CATEGORIAS_EQUIPAMENTO.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="sel-icon" />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Objetivo</label>
                      <div className="select-wrap full-w">
                        <select
                          value={form.objetivo || 'Eficiência'}
                          onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))}
                        >
                          <option value="Eficiência">③ EFICIÊNCIA</option>
                          <option value="Expansão">② EXPANSÃO</option>
                          <option value="Substituição">① PASSADO (SUBSTITUIÇÃO)</option>
                          <option value="Outro">OUTRO</option>
                        </select>
                        <ChevronDown size={14} className="sel-icon" />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Ano Frota (Opcional)</label>
                      <input
                        type="text"
                        placeholder="Ex: 1, 2, 6..."
                        value={form.anoFrota || ''}
                        onChange={e => setForm(f => ({ ...f, anoFrota: e.target.value }))}
                      />
                    </div>
                  </>
                )}

                {/* ── VALORES FINANCEIROS (CALCULADOS AUTOMATICAMENTE) ── */}
                <div className="form-group">
                  <label>Quantidade Orçada *</label>
                  <input
                    type="number"
                    min={1}
                    value={form.quantidade}
                    onChange={e => handleUnitOrQtyChange('quantidade', Number(e.target.value))}
                  />
                </div>

                <div className="form-group">
                  <label>Valor Unitário (R$) *</label>
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={form.valorUnitario}
                    onChange={e => handleUnitOrQtyChange('valorUnitario', Number(e.target.value))}
                  />
                </div>

                <div className="form-group">
                  <label>Valor Total (Cálculo Automático)</label>
                  <div className="budget-total-display">
                    {formatMoney(form.valorTotal)}
                  </div>
                </div>

                <div className="form-group">
                  <label>Status do Lançamento</label>
                  <div className="select-wrap full-w">
                    <select
                      value={form.status}
                      onChange={e => setForm(f => ({ ...f, status: e.target.value as BudgetStatus }))}
                    >
                      {STATUS_LIST.map(st => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="sel-icon" />
                  </div>
                </div>

                <div className="form-group">
                  <label>Data Planejada *</label>
                  <div className="input-icon-wrap">
                    <CalendarIcon size={15} />
                    <input
                      type="date"
                      value={form.dataPlanejada}
                      onChange={e => setForm(f => ({ ...f, dataPlanejada: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Data Solicitada</label>
                  <div className="input-icon-wrap">
                    <CalendarIcon size={15} />
                    <input
                      type="date"
                      value={form.dataSolicitada || ''}
                      onChange={e => setForm(f => ({ ...f, dataSolicitada: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Modalidade</label>
                  <div className="select-wrap full-w">
                    <select
                      value={form.modalidade}
                      onChange={e => setForm(f => ({ ...f, modalidade: e.target.value as BudgetModalidade }))}
                    >
                      <option value="Presencial">Presencial</option>
                      <option value="Remoto">Remoto</option>
                    </select>
                    <ChevronDown size={14} className="sel-icon" />
                  </div>
                </div>

                <div className="form-group full">
                  <label>Justificativa / Motivo da Solicitação</label>
                  <textarea
                    rows={2}
                    placeholder="Explique a necessidade, ganho de produtividade ou impacto no projeto..."
                    value={form.justificativa || form.motivo || ''}
                    onChange={e => setForm(f => ({ ...f, justificativa: e.target.value, motivo: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-ghost" onClick={closeModal} disabled={isSaving}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={handleSave} disabled={isSaving}>
                <Save size={16} />
                {isSaving ? 'Salvando...' : (modal.editing ? 'Salvar Alterações' : 'Cadastrar no Budget')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DE CONFIRMAÇÃO DE EXCLUSÃO ── */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="confirm-box" onClick={e => e.stopPropagation()}>
            <Trash2 size={36} style={{ color: '#ef4444', marginBottom: '1rem' }} />
            <h3>Excluir item de budget?</h3>
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '1.5rem' }}>
              Esta ação removerá este lançamento orçamentário permanentemente do banco de dados.
            </p>
            <div className="confirm-actions">
              <button className="btn-ghost" onClick={() => setDeleteConfirm(null)}>
                Cancelar
              </button>
              <button className="btn-danger" onClick={() => handleDelete(deleteConfirm)}>
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
