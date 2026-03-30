import { useMemo, useState, useEffect } from 'react';
import {
  CheckCircle2, Clock, AlertCircle, TrendingUp,
  Users, BarChart2, Target, Play, Pause, FastForward
} from 'lucide-react';
import type { Activity, Theme, User } from '../types';

interface Props {
  currentUser: User | null;
  activities: Activity[];
  themes: Theme[];
  users: User[];
}

export default function DashboardTab({ currentUser, activities, themes, users }: Props) {
  const [showManagement, setShowManagement] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(1);
  
  // Novos Filtros
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedUser, setSelectedUser] = useState<string>('all');

  // Lógica de Auto-scroll para Apresentação
  useEffect(() => {
    if (!isScrolling) return;

    const scrollContainer = document.querySelector('.main-content');
    if (!scrollContainer) return;

    let direction = 1;
    const interval = setInterval(() => {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      
      if (scrollTop + clientHeight >= scrollHeight - 10) {
        direction = -1; // Sobe
      } else if (scrollTop <= 10) {
        direction = 1; // Desce
      }

      scrollContainer.scrollBy({
        top: direction * scrollSpeed,
        behavior: 'auto'
      });
    }, 50);

    return () => clearInterval(interval);
  }, [isScrolling, scrollSpeed]);

  const toggleScroll = () => setIsScrolling(!isScrolling);
  const cycleSpeed = () => setScrollSpeed(prev => prev === 3 ? 1 : prev + 1);

  const filteredActivities = useMemo(() => {
    return activities.filter(a => {
      const matchUser = selectedUser === 'all' || a.responsavel === selectedUser;
      const matchStart = !startDate || a.planejamento >= startDate;
      const matchEnd = !endDate || a.planejamento <= endDate;
      return matchUser && matchStart && matchEnd;
    });
  }, [activities, selectedUser, startDate, endDate]);

  const stats = useMemo(() => {
    const total = filteredActivities.length;
    const finalizadas = filteredActivities.filter(a => a.status === 'FINALIZADA').length;
    const pendentes = filteredActivities.filter(a => a.status === 'PENDENTE').length;
    const emAndamento = filteredActivities.filter(a => a.status === 'EM ANDAMENTO').length;
    const today = new Date().toISOString().slice(0, 10);
    const atrasadas = filteredActivities.filter(a => 
      a.status !== 'FINALIZADA' && 
      a.dataPrevistaFinalizacao && 
      a.dataPrevistaFinalizacao < today
    ).length;
    
    const validProgress = filteredActivities.map(a => Number(a.percentualAndamento) || 0);
    const avgProgress = total > 0 ? Math.round(validProgress.reduce((s, p) => s + p, 0) / total) : 0;
    
    return { total, finalizadas, pendentes, emAndamento, atrasadas, avgProgress };
  }, [filteredActivities]);

  // Filtro de usuários (Ocultar Admin/Gestão por padrão)
  const filteredUsers = useMemo(() => {
    if (showManagement) return users;
    return users.filter(u => u.role !== 'Administrador' && u.role !== 'Gestão');
  }, [users, showManagement]);

  // Por responsável
  const byUser = useMemo(() => filteredUsers.map(u => {
    const acts = activities.filter(a => a.responsavel === u.id);
    const done = acts.filter(a => a.status === 'FINALIZADA').length;
    const total = acts.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const pending = acts.filter(a => a.status === 'PENDENTE').length;
    const late = acts.filter(a => a.diasEsperadosConclusao < 0 && a.status !== 'FINALIZADA').length;
    return { user: u, total, done, pending, late, pct };
  }).sort((a,b) => b.total - a.total), [activities, filteredUsers]);

  // Por tema
  const byTheme = useMemo(() => {
    const map: Record<string, { count: number; done: number }> = {};
    activities.forEach(a => {
      if (!map[a.tema]) map[a.tema] = { count: 0, done: 0 };
      map[a.tema].count++;
      if (a.status === 'FINALIZADA') map[a.tema].done++;
    });
    return Object.entries(map).map(([tid, v]) => ({
      theme: themes.find(t => t.id === tid),
      ...v,
      pct: Math.round((v.done / v.count) * 100),
    })).sort((a, b) => b.count - a.count);
  }, [activities, themes]);

  // Por semana
  const byWeek = useMemo(() => {
    const map: Record<string, { total: number; done: number }> = {};
    filteredActivities.forEach(a => {
      if (!a.week) return;
      if (!map[a.week]) map[a.week] = { total: 0, done: 0 };
      map[a.week].total++;
      if (a.status === 'FINALIZADA') map[a.week].done++;
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]))
      .map(([week, v]) => ({ week, ...v, pct: Math.round((v.done / v.total) * 100) }));
  }, [filteredActivities]);

  // ── Rankings de Performance (Restrito à Gestão) ──
  const topLateThemes = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const map: Record<string, number> = {};
    activities.forEach(a => {
      if (a.status !== 'FINALIZADA' && a.dataPrevistaFinalizacao && a.dataPrevistaFinalizacao < today) {
        map[a.tema] = (map[a.tema] || 0) + 1;
      }
    });
    return Object.entries(map)
      .map(([tid, count]) => ({ theme: themes.find(t => t.id === tid), count }))
      .sort((a,b) => b.count - a.count).slice(0, 5);
  }, [activities, themes]);

  const topLateUsers = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const map: Record<string, number> = {};
    activities.forEach(a => {
      if (a.status !== 'FINALIZADA' && a.dataPrevistaFinalizacao && a.dataPrevistaFinalizacao < today) {
        map[a.responsavel] = (map[a.responsavel] || 0) + 1;
      }
    });
    return Object.entries(map)
      .map(([uid, count]) => ({ user: users.find(u => u.id === uid), count }))
      .sort((a,b) => b.count - a.count).slice(0, 5);
  }, [activities, users]);

  const topDeliveryUsers = useMemo(() => {
    const map: Record<string, number> = {};
    activities.forEach(a => {
      if (a.status === 'FINALIZADA') {
        map[a.responsavel] = (map[a.responsavel] || 0) + 1;
      }
    });
    return Object.entries(map)
      .map(([uid, count]) => ({ user: users.find(u => u.id === uid), count }))
      .sort((a,b) => b.count - a.count).slice(0, 5);
  }, [activities, users]);

  // ── Gráfico Anual (Abr 26 - Mar 27) ──
  const monthlyData = useMemo(() => {
    const months = [
      { label: 'Abr/26', start: '2026-04-01', end: '2026-04-30' },
      { label: 'Mai/26', start: '2026-05-01', end: '2026-05-31' },
      { label: 'Jun/26', start: '2026-06-01', end: '2026-06-30' },
      { label: 'Jul/26', start: '2026-07-01', end: '2026-07-31' },
      { label: 'Ago/26', start: '2026-08-01', end: '2026-08-31' },
      { label: 'Set/26', start: '2026-09-01', end: '2026-09-30' },
      { label: 'Out/26', start: '2026-10-01', end: '2026-10-31' },
      { label: 'Nov/26', start: '2026-11-01', end: '2026-11-30' },
      { label: 'Dez/26', start: '2026-12-01', end: '2026-12-31' },
      { label: 'Jan/27', start: '2027-01-01', end: '2027-01-31' },
      { label: 'Fev/27', start: '2027-02-01', end: '2027-02-28' },
      { label: 'Mar/27', start: '2027-03-01', end: '2027-03-31' }
    ];

    const extraFlowTheme = themes.find(t => t.name.toLowerCase().includes('extra fluxo'))?.id;

    return months.map(m => {
      const plano = activities.filter(a => a.planejamento >= m.start && a.planejamento <= m.end).length;
      const real = activities.filter(a => a.status === 'FINALIZADA' && a.dataFinalizada && a.dataFinalizada >= m.start && a.dataFinalizada <= m.end).length;
      const extra = activities.filter(a => a.tema === extraFlowTheme && a.planejamento >= m.start && a.planejamento <= m.end).length;
      return { month: m.label, plano, real, extra };
    });
  }, [activities, themes]);

  const isAdminOrGestao = currentUser?.role === 'Administrador' || currentUser?.role === 'Gestão';

  return (
    <div className="tab-content dashboard-revamp">
      <div className="tab-header dashboard-header">
        <div>
          <h1 className="tab-title">Gestão de Resultados</h1>
          <p className="tab-subtitle">Performance e Monitoramento Tático LSL</p>
        </div>

        <div className="dashboard-controls">
          <div className="filter-group">
            <div className="filter-item">
              <label>Período</label>
              <div className="date-inputs">
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                <span>até</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="filter-item">
              <label>Responsável</label>
              <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
                <option value="all">Todos os Analistas</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <button className="clear-filter" onClick={() => { setStartDate(''); setEndDate(''); setSelectedUser('all'); }}>Limpar</button>
          </div>

            <div className="management-toggle">
              <label className="toggle-label">
                <input 
                  type="checkbox" 
                  checked={showManagement} 
                  onChange={() => setShowManagement(!showManagement)} 
                />
                <span className="toggle-text">Ver Gestão</span>
              </label>
            </div>
          </div>
        </div>

      {/* Floating Presentation Bar */}
      <div className="presentation-floating-bar">
        <div className="pres-bar-content">
          <div className="pres-speed-info">
            <span className="speed-tag">{scrollSpeed}x</span>
          </div>
          <button 
            className={`pres-btn ${isScrolling ? 'active' : ''}`}
            onClick={toggleScroll}
            title={isScrolling ? 'Pausar' : 'Play'}
          >
            {isScrolling ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button className="pres-btn" onClick={cycleSpeed} title="Mudar Velocidade">
            <FastForward size={20} />
          </button>
        </div>
      </div>

      {/* KPI Section with Glass Effect */}
      <div className="kpi-grid">
        <KpiCard icon={<BarChart2 size={24} />} color="blue" label="Total" value={stats.total} />
        <KpiCard icon={<CheckCircle2 size={24} />} color="green" label="Finalizadas" value={stats.finalizadas} sub={`${stats.total > 0 ? Math.round((stats.finalizadas / stats.total) * 100) : 0}% de conclusão`} />
        <KpiCard icon={<AlertCircle size={24} />} color="red" label="Pendentes" value={stats.pendentes} />
        <KpiCard icon={<Clock size={24} />} color="amber" label="Em Andamento" value={stats.emAndamento} />
        <KpiCard icon={<TrendingUp size={24} />} color="purple" label="Performance" value={`${stats.avgProgress}%`} />
      </div>

      <div className="dash-two-col">
        {/* Por Responsável (Agora em Colunas) */}
        <div className="dash-card">
          <div className="dash-card-header">
            <Users size={18} />
            <h3>Performance por Analista</h3>
          </div>
          <div className="analyst-column-chart">
            {byUser.map(({ user, total, done, pct }) => (
              <div key={user.id} className="analyst-col">
                <div className="col-bar-container">
                  <div className="col-bar-full">
                    <div className="col-bar-done" style={{ height: `${pct}%`, background: user.color }} />
                  </div>
                  <span className="col-pct-label">{pct}%</span>
                </div>
                <div className="col-avatar" style={{ background: user.color }}>{user.name[0]}</div>
                <span className="col-name-abbr">{user.name.split(' ')[0]}</span>
              </div>
            ))}
            {byUser.length === 0 && <p className="empty-state">Nenhum analista selecionado</p>}
          </div>
          <div className="analyst-legend">
            <span className="leg-item"><i className="leg-dot" style={{ background: 'var(--border)' }} /> Pendente</span>
            <span className="leg-item"><i className="leg-dot" style={{ background: 'var(--primary-color)' }} /> Finalizado</span>
          </div>
        </div>

        {/* Por Semana */}
        <div className="dash-card">
          <div className="dash-card-header">
            <BarChart2 size={18} />
            <h3>Progresso por Semana</h3>
          </div>
          <div className="week-bars">
            {byWeek.map(({ week, total, done, pct }) => (
              <div key={week} className="week-row">
                <span className="week-label">{week}</span>
                <div className="prog-bar week-prog">
                  <div
                    className="prog-fill"
                    style={{
                      width: `${pct}%`,
                      background: pct === 100 ? '#10b981' : pct >= 50 ? '#3b82f6' : '#f59e0b'
                    }}
                  />
                </div>
                <span className="week-nums">{done}/{total}</span>
                <span className="week-pct">{pct}%</span>
              </div>
            ))}
          </div>
          
          <div className="monthly-chart-section">
            <h4 className="chart-title-sm">Desempenho Anual (Fiscal Year 26/27)</h4>
            <div className="monthly-grid">
              {monthlyData.map(m => {
                const maxVal = Math.max(m.plano, m.real, m.extra, 1);
                return (
                  <div key={m.month} className="monthly-col">
                    <div className="monthly-bars">
                      <div className="m-bar plano" style={{ height: `${(m.plano / maxVal) * 100}%` }} title={`Plano: ${m.plano}`} />
                      <div className="m-bar real" style={{ height: `${(m.real / maxVal) * 100}%` }} title={`Real: ${m.real}`} />
                      <div className="m-bar extra" style={{ height: `${(m.extra / maxVal) * 100}%` }} title={`Extra: ${m.extra}`} />
                    </div>
                    <span className="month-lbl">{m.month.split('/')[0]}</span>
                  </div>
                );
              })}
            </div>
            <div className="chart-legend">
              <span className="leg-item"><i className="leg-dot chart-plano" /> Plano</span>
              <span className="leg-item"><i className="leg-dot chart-real" /> Real</span>
              <span className="leg-item"><i className="leg-dot chart-extra" /> Extra Fluxo</span>
            </div>
          </div>
        </div>
      </div>

      {isAdminOrGestao && (
        <div className="management-insights">
          <div className="dash-card insight-card">
            <div className="dash-card-header"><h3>Top Temas Atrasados</h3></div>
            <div className="ranking-list">
              {topLateThemes.map((t, i) => (
                <div key={t.theme?.id} className="ranking-item">
                  <span className="rank-num">{i+1}º</span>
                  <span className="rank-name">{t.theme?.name}</span>
                  <span className="rank-val red">{t.count} ativ.</span>
                </div>
              ))}
            </div>
          </div>
          <div className="dash-card insight-card">
            <div className="dash-card-header"><h3>Gargalos por Analista (Atrasos)</h3></div>
            <div className="ranking-list">
              {topLateUsers.map((u, i) => (
                <div key={u.user?.id} className="ranking-item">
                  <span className="rank-num">{i+1}º</span>
                  <span className="rank-name">{u.user?.name}</span>
                  <span className="rank-val orange">{u.count} atrasos</span>
                </div>
              ))}
            </div>
          </div>
          <div className="dash-card insight-card">
            <div className="dash-card-header"><h3>Top Performers (Entregas)</h3></div>
            <div className="ranking-list">
              {topDeliveryUsers.map((u, i) => (
                <div key={u.user?.id} className="ranking-item">
                  <span className="rank-num">{i+1}º</span>
                  <span className="rank-name">{u.user?.name}</span>
                  <span className="rank-val green">{u.count} finalizadas</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Por Tema */}
      <div className="dash-card">
        <div className="dash-card-header">
          <Target size={18} />
          <h3>Por Tema</h3>
        </div>
        <div className="theme-grid-list">
          {byTheme.map(({ theme, count, done, pct }) => (
            theme && (
              <div key={theme.id} className="theme-stat-card">
                <div className="theme-stat-top">
                  <span className="theme-dot" style={{ background: theme.color }} />
                  <span className="theme-name-txt">{theme.name}</span>
                  <span className="theme-count">{count} ativ.</span>
                </div>
                <div className="prog-bar" style={{ marginTop: '0.5rem' }}>
                  <div className="prog-fill" style={{ width: `${pct}%`, background: theme.color }} />
                </div>
                <div className="theme-stat-bottom">
                  <span>{done} finalizadas</span>
                  <span className="theme-pct">{pct}%</span>
                </div>
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, color, label, value, sub }: {
  icon: React.ReactNode; color: string; label: string; value: string | number; sub?: string;
}) {
  return (
    <div className={`kpi-card kpi-${color}`}>
      <div className="kpi-icon">{icon}</div>
      <div className="kpi-info">
        <span className="kpi-label">{label}</span>
        <span className="kpi-value">{value}</span>
        {sub && <span className="kpi-sub">{sub}</span>}
      </div>
    </div>
  );
}
