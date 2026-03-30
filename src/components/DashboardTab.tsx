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

  const stats = useMemo(() => {
    const total = activities.length;
    const finalizadas = activities.filter(a => a.status === 'FINALIZADA').length;
    const pendentes = activities.filter(a => a.status === 'PENDENTE').length;
    const emAndamento = activities.filter(a => a.status === 'EM ANDAMENTO').length;
    const atrasadas = activities.filter(a => a.diasEsperadosConclusao < 0 && a.status !== 'FINALIZADA').length;
    
    // Garantir que percentualAndamento seja número antes de reduzir para evitar NaN
    const validProgress = activities.map(a => Number(a.percentualAndamento) || 0);
    const avgProgress = total > 0 ? Math.round(validProgress.reduce((s, p) => s + p, 0) / total) : 0;
    
    return { total, finalizadas, pendentes, emAndamento, atrasadas, avgProgress };
  }, [activities]);

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
    activities.forEach(a => {
      if (!a.week) return;
      if (!map[a.week]) map[a.week] = { total: 0, done: 0 };
      map[a.week].total++;
      if (a.status === 'FINALIZADA') map[a.week].done++;
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]))
      .map(([week, v]) => ({ week, ...v, pct: Math.round((v.done / v.total) * 100) }));
  }, [activities]);

  return (
    <div className="tab-content dashboard-revamp">
      <div className="tab-header">
        <div>
          <h1 className="tab-title">Resultados</h1>
          <p className="tab-subtitle">Monitoramento de performance da equipe LSL</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
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
          
          <button 
            className={`scroll-ctrl-btn ${isScrolling ? 'active' : ''}`}
            onClick={toggleScroll}
            title={isScrolling ? 'Pausar Rolagem' : 'Iniciar Apresentação'}
          >
            {isScrolling ? <Pause size={18} /> : <Play size={18} />}
          </button>

          <button 
            className="scroll-ctrl-btn"
            onClick={cycleSpeed}
            title="Ajustar Velocidade (1x, 2x, 3x)"
          >
            <FastForward size={18} />
            <span style={{ fontSize: '0.7rem', fontWeight: '800' }}>{scrollSpeed}x</span>
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
        {/* Por Responsável */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} />
                <h3>Por Responsável</h3>
              </div>
            </div>
          </div>
          <div className="user-stats">
            {byUser.length === 0 && <p className="empty-state">Nenhum responsável filtrado</p>}
            {byUser.map(({ user, total, done, pending, late, pct }) => (
              <div key={user.id} className="user-stat-row">
                <div className="user-stat-header">
                  <div className="user-chip">
                    <span className="user-avatar" style={{ background: user.color }}>{user.name[0]}</span>
                    <span>{user.name}</span>
                  </div>
                  <div className="user-stat-nums">
                    <span className="stat-pill green">{done} ✓</span>
                    <span className="stat-pill red">{pending} pend.</span>
                    {late > 0 && <span className="stat-pill orange">{late} atras.</span>}
                  </div>
                </div>
                <div className="stat-progress-row">
                  <div className="prog-bar">
                    <div className="prog-fill" style={{ width: `${pct}%`, background: user.color }} />
                  </div>
                  <span className="prog-label">{pct}% ({total} ativ.)</span>
                </div>
              </div>
            ))}
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
        </div>
      </div>

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
