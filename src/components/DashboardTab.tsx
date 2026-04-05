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
  // Estados de Controle e Scroll
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(1);
  
  // Filtros
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedUser, setSelectedUser] = useState<string>('all');

  // Filtro Permanente: Apenas Analistas nos indicadores
  const onlyAnalysts = useMemo(() => {
    return users.filter(u => u.role === 'Analista');
  }, [users]);

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
  const cycleSpeed = () => setScrollSpeed(prev => (prev === 3 ? 1 : prev + 1));

  const filteredActivities = useMemo(() => {
    return activities.filter(a => {
      // Regra: Somente atividades de analistas aparecem no Dashboard
      const isAnalystAct = onlyAnalysts.some(u => u.id === a.responsavel);
      if (!isAnalystAct) return false;
      
      const matchUser = selectedUser === 'all' || a.responsavel === selectedUser;
      const matchStart = !startDate || a.planejamento >= startDate;
      const matchEnd = !endDate || a.planejamento <= endDate;
      return matchUser && matchStart && matchEnd;
    });
  }, [activities, onlyAnalysts, selectedUser, startDate, endDate]);

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

  // Por responsável (Apenas analistas)
  const byUser = useMemo(() => onlyAnalysts.map(u => {
    const acts = filteredActivities.filter(a => a.responsavel === u.id);
    const doneActs = acts.filter(a => a.status === 'FINALIZADA');
    const done = doneActs.length;
    const total = acts.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    
    // Análise de prioridade alta:
    const doneHighPrio = doneActs.filter(a => a.prioridade === 'Alta').length;
    const pctHighPrio = done > 0 ? Math.round((doneHighPrio / done) * 100) : 0;

    const late = acts.filter(a => {
      const today = new Date().toISOString().slice(0, 10);
      return a.dataPrevistaFinalizacao && a.dataPrevistaFinalizacao < today && a.status !== 'FINALIZADA';
    }).length;
    return { user: u, total, done, late, pct, doneHighPrio, pctHighPrio };
  }).sort((a,b) => b.total - a.total), [filteredActivities, onlyAnalysts]);

  // Por tema
  const byTheme = useMemo(() => {
    const map: Record<string, { count: number; done: number }> = {};
    filteredActivities.forEach(a => {
      if (!map[a.tema]) map[a.tema] = { count: 0, done: 0 };
      map[a.tema].count++;
      if (a.status === 'FINALIZADA') map[a.tema].done++;
    });
    return Object.entries(map).map(([tid, v]) => ({
      theme: themes.find(t => t.id === tid),
      ...v,
      pct: Math.round((v.done / v.count) * 100),
    })).sort((a, b) => b.count - a.count);
  }, [filteredActivities, themes]);

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

  // ── Rankings de Performance (Gestão) ──
  const isAdminOrGestao = currentUser?.role === 'Administrador' || currentUser?.role === 'Gestão';

  const topLateThemes = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const map: Record<string, number> = {};
    filteredActivities.forEach(a => {
      if (a.status !== 'FINALIZADA' && a.dataPrevistaFinalizacao && a.dataPrevistaFinalizacao < today) {
        map[a.tema] = (map[a.tema] || 0) + 1;
      }
    });
    return Object.entries(map)
      .map(([tid, count]) => ({ theme: themes.find(t => t.id === tid), count }))
      .sort((a,b) => b.count - a.count).slice(0, 5);
  }, [filteredActivities, themes]);

  const topLateUsers = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const map: Record<string, number> = {};
    filteredActivities.forEach(a => {
      if (a.status !== 'FINALIZADA' && a.dataPrevistaFinalizacao && a.dataPrevistaFinalizacao < today) {
        map[a.responsavel] = (map[a.responsavel] || 0) + 1;
      }
    });
    return Object.entries(map)
      .map(([uid, count]) => ({ user: onlyAnalysts.find(u => u.id === uid), count }))
      .sort((a,b) => b.count - a.count).slice(0, 5);
  }, [filteredActivities, onlyAnalysts]);

  const topDeliveryUsers = useMemo(() => {
    const map: Record<string, number> = {};
    filteredActivities.forEach(a => {
      if (a.status === 'FINALIZADA') {
        map[a.responsavel] = (map[a.responsavel] || 0) + 1;
      }
    });
    return Object.entries(map)
      .map(([uid, count]) => ({ user: onlyAnalysts.find(u => u.id === uid), count }))
      .sort((a,b) => b.count - a.count).slice(0, 5);
  }, [filteredActivities, onlyAnalysts]);

  // ── Gráfico Anual ──
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
      const plano = filteredActivities.filter(a => a.planejamento >= m.start && a.planejamento <= m.end).length;
      const real = filteredActivities.filter(a => a.status === 'FINALIZADA' && a.dataFinalizada && a.dataFinalizada >= m.start && a.dataFinalizada <= m.end).length;
      const extra = filteredActivities.filter(a => a.tema === extraFlowTheme && a.planejamento >= m.start && a.planejamento <= m.end).length;
      return { month: m.label, plano, real, extra };
    });
  }, [filteredActivities, themes]);

  return (
    <div className="tab-content dashboard-revamp">
      <div className="tab-header dashboard-header">
        <div>
          <h1 className="tab-title">Gestão de Resultados</h1>
          <p className="tab-subtitle">Performance e Monitoramento</p>
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
                {onlyAnalysts.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <button className="clear-filter" onClick={() => { setStartDate(''); setEndDate(''); setSelectedUser('all'); }}>Limpar</button>
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

      <div className="kpi-grid">
        <KpiCard icon={<BarChart2 size={24} />} color="blue" label="Total" value={stats.total} />
        <KpiCard icon={<CheckCircle2 size={24} />} color="green" label="Finalizadas" value={stats.finalizadas} sub={`${stats.total > 0 ? Math.round((stats.finalizadas / stats.total) * 100) : 0}% de conclusão`} />
        <KpiCard icon={<AlertCircle size={24} />} color="red" label="Pendentes" value={stats.pendentes} />
        <KpiCard icon={<Clock size={24} />} color="amber" label="Em Andamento" value={stats.emAndamento} />
        <KpiCard icon={<TrendingUp size={24} />} color="purple" label="Performance" value={`${stats.avgProgress}%`} />
      </div>

      <div className="dash-card" style={{ marginBottom: '1rem' }}>
        <div className="dash-card-header">
          <Users size={18} />
          <h3>Performance por Analista</h3>
        </div>
        <div className="analyst-bar-chart" style={{ 
          justifyContent: byUser.length <= 8 ? 'center' : 'space-around', 
          gap: byUser.length <= 8 ? '3rem' : '1.5rem',
          paddingLeft: '1rem', 
          paddingRight: '1rem' 
        }}>
          {byUser.map(({ user, total, done, pct }) => (
            <div key={user.id} className="analyst-bar-col">
              <span className="analyst-bar-pct">{pct}%</span>
              <div className="analyst-bar-track">
                <div
                  className="analyst-bar-fill"
                  style={{ height: `${pct}%`, backgroundColor: user.color }}
                />
              </div>
              <div className="analyst-bar-avatar" style={{ backgroundColor: user.color }}>
                {user.name[0]}
              </div>
              <span className="analyst-bar-name">{user.name.split(' ')[0]}</span>
              <span className="analyst-bar-total">{done}/{total}</span>
            </div>
          ))}
          {byUser.length === 0 && <p className="empty-state-msg">Nenhum analista no período.</p>}
        </div>
        <div className="analyst-legend">
          <span className="leg-item"><span className="leg-dot" style={{background:'#64748b'}} /> Total</span>
          <span className="leg-item"><span className="leg-dot" style={{background:'var(--primary-color)'}} /> Concluído</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
        
        {/* Coluna Esquerda: Gráfico de Linhas (60% width) */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          <div className="dash-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '1rem 1.25rem' }}>
            <div className="dash-card-header" style={{ marginBottom: '0.25rem', paddingBottom: '0.5rem' }}>
              <TrendingUp size={18} />
              <h3>% de Atividades com Prioridade Alta</h3>
            </div>
            <div style={{ flex: 1, minHeight: '220px', position: 'relative', marginTop: '1rem', display: 'flex', flexDirection: 'column' }}>
              {byUser.length > 0 ? (
                <>
                  <div style={{ flex: 1, position: 'relative', minHeight: '160px', padding: '0 20px' }}>
                    <svg width="100%" height="100%" viewBox="0 0 1000 240" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                      <defs>
                        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
                        </linearGradient>
                        <filter id="glow">
                          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                          <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>

                      {/* Linhas de grade horizontais */}
                      {[0, 25, 50, 75, 100].map(v => (
                        <g key={v}>
                          <line 
                            x1="-20" 
                            y1={240 - (v / 100 * 180) - 30} 
                            x2="1020" 
                            y2={240 - (v / 100 * 180) - 30} 
                            stroke="rgba(255,255,255,0.08)" 
                            strokeDasharray="4 4"
                            vectorEffect="non-scaling-stroke" 
                          />
                          <text 
                            x="-25" 
                            y={240 - (v / 100 * 180) - 30} 
                            fill="rgba(255,255,255,0.3)" 
                            fontSize="9" 
                            textAnchor="end" 
                            alignmentBaseline="middle"
                          >
                            {v}%
                          </text>
                        </g>
                      ))}
                      
                      {/* Área Preenchida */}
                      <path
                        d={`M ${(0.5) * (1000 / byUser.length)},240 ` + 
                           byUser.map((u, i) => `L ${(i + 0.5) * (1000 / byUser.length)},${240 - (u.pctHighPrio / 100 * 180) - 30}`).join(' ') +
                           ` L ${(byUser.length - 0.5) * (1000 / byUser.length)},240 Z`}
                        fill="url(#areaGradient)"
                      />

                      {/* Linha Principal do Gráfico */}
                      <polyline 
                        points={byUser.map((u, i) => `${(i + 0.5) * (1000 / byUser.length)},${240 - (u.pctHighPrio / 100 * 180) - 30}`).join(' ')} 
                        fill="none" 
                        stroke="#ef4444" 
                        strokeWidth="3" 
                        filter="url(#glow)"
                        vectorEffect="non-scaling-stroke" 
                      />
                    </svg>

                    {/* Pontos sobre a linha e Rótulos */}
                    <div style={{ position: 'absolute', inset: '0 20px' }}>
                      {byUser.map((u, i) => {
                        const xPct = ((i + 0.5) / byUser.length) * 100;
                        const yVal = 240 - (u.pctHighPrio / 100 * 180) - 30;
                        const yPct = (yVal / 240) * 100;
                        return (
                          <div key={u.user.id}>
                            {/* Círculo do ponto */}
                            <div 
                              style={{
                                position: 'absolute',
                                left: `${xPct}%`,
                                top: `${yPct}%`,
                                transform: 'translate(-50%, -50%)',
                                width: '10px', height: '10px',
                                borderRadius: '50%',
                                background: '#1e293b',
                                border: '2px solid #ef4444',
                                zIndex: 2,
                                boxShadow: '0 0 8px rgba(239, 68, 68, 0.4)'
                              }}
                            />
                            {/* Rótulo de Valor */}
                            <span 
                              style={{ 
                                position: 'absolute', 
                                left: `${xPct}%`, 
                                top: `calc(${yPct}% - 22px)`,
                                transform: 'translateX(-50%)',
                                color: '#ef4444', 
                                fontWeight: '800', 
                                fontSize: '0.8rem',
                                textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                                pointerEvents: 'none'
                              }}
                            >
                              {u.pctHighPrio}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Nomes Eixo X (Melhorado) */}
                  <div style={{ display: 'flex', height: '45px', alignItems: 'flex-start', marginTop: '10px', padding: '0 20px' }}>
                    {byUser.map((u) => (
                      <div key={u.user.id} style={{ flex: 1, textAlign: 'center', fontSize: '10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        <div style={{ transform: 'rotate(-40deg) translateX(-10px)', display: 'inline-block', fontWeight: '700', width: '100%', textAlign: 'right' }}>
                          {u.user.name.split(' ')[0]}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="empty-state-msg">Sem dados suficientes para o gráfico.</p>
              )}
            </div>
          </div>
        </div>

        {/* Coluna Direita: Métricas Gerais (40% width) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>
          <div className="dash-card" style={{ padding: '1rem' }}>
            <div className="dash-card-header" style={{ marginBottom: '0.75rem', paddingBottom: '0.5rem' }}>
              <BarChart2 size={18} />
              <h3>Progresso por Semana</h3>
            </div>
            <div className="week-bars" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {byWeek.length > 0 ? byWeek.map(({ week, total, done, pct }) => (
                <div key={week} className="week-row-prime" style={{ padding: '2px 0' }}>
                  <span className="week-label-prime" style={{ minWidth: '70px', fontSize: '0.75rem' }}>{week}</span>
                  <div className="week-prog-prime" style={{ height: '12px', borderRadius: '6px' }}>
                    <div
                      className="week-fill-prime"
                      style={{
                        width: `${pct}%`,
                        borderRadius: '6px',
                        background: pct === 100 ? 'linear-gradient(90deg, #059669, #10b981)' : pct >= 50 ? 'linear-gradient(90deg, #2563eb, #3b82f6)' : 'linear-gradient(90deg, #d97706, #f59e0b)'
                      }}
                    />
                  </div>
                  <div className="week-meta-prime" style={{ minWidth: '85px' }}>
                    <span className="week-nums-prime" style={{ fontSize: '0.7rem' }}>{done}/{total}</span>
                    <span className="week-pct-prime" style={{ fontSize: '0.8rem', minWidth: '34px', textAlign: 'right' }}>{pct}%</span>
                  </div>
                </div>
              )) : <p className="empty-state-msg">Sem dados semanais.</p>}
            </div>
          </div>

          <div className="dash-card" style={{ padding: '1rem' }}>
            <div className="monthly-chart-section" style={{ marginTop: 0 }}>
              <h4 className="chart-title-sm" style={{ marginBottom: '1rem', fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-primary)' }}>Desempenho Anual (FY 26/27)</h4>
              <div className="monthly-scroll-wrap" style={{ overflow: 'visible' }}>
                <div className="monthly-grid-new" style={{ gap: '0.5rem', justifyContent: 'space-between' }}>
                  {monthlyData.map(m => (
                    <div key={m.month} className="monthly-col-new" style={{ flex: 1 }}>
                      <div className="monthly-bars-new" style={{ height: '80px', gap: '2px' }}>
                        {(m.plano > 0 || m.real > 0 || m.extra > 0) ? (
                          <>
                            {m.plano > 0 && (
                              <div className="m-bar-wrap">
                                <span className="m-bar-lbl" style={{ fontSize: '0.5rem' }}>{m.plano}</span>
                                <div className="m-bar-new" style={{ 
                                  width: '8px',
                                  height: `${(m.plano / Math.max(...monthlyData.flatMap(d => [d.plano, d.real, d.extra]), 1)) * 100}%`, 
                                  background: 'linear-gradient(to bottom, #94a3b8, #64748b)' 
                                }} />
                              </div>
                            )}
                            {m.real > 0 && (
                              <div className="m-bar-wrap">
                                <span className="m-bar-lbl" style={{ fontSize: '0.5rem' }}>{m.real}</span>
                                <div className="m-bar-new" style={{ 
                                  width: '8px',
                                  height: `${(m.real / Math.max(...monthlyData.flatMap(d => [d.plano, d.real, d.extra]), 1)) * 100}%`, 
                                  background: 'linear-gradient(to bottom, #3b82f6, #2563eb)' 
                                }} />
                              </div>
                            )}
                            {m.extra > 0 && (
                              <div className="m-bar-wrap">
                                <span className="m-bar-lbl" style={{ fontSize: '0.5rem' }}>{m.extra}</span>
                                <div className="m-bar-new" style={{ 
                                  width: '8px',
                                  height: `${(m.extra / Math.max(...monthlyData.flatMap(d => [d.plano, d.real, d.extra]), 1)) * 100}%`, 
                                  background: 'linear-gradient(to bottom, #f59e0b, #d97706)' 
                                }} />
                              </div>
                            )}
                          </>
                        ) : (
                           <div style={{ height: '1px', width: '100%', background: 'rgba(255,255,255,0.05)' }} />
                        )}
                      </div>
                      <span className="month-lbl-new" style={{ fontSize: '0.55rem', marginTop: '6px' }}>{m.month.split('/')[0].toUpperCase()}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="chart-legend-new" style={{ marginTop: '1rem', paddingTop: '0.75rem', gap: '1rem' }}>
                <span className="leg-item" style={{ fontSize: '0.65rem' }}><span className="leg-dot" style={{ width: '6px', height: '6px', background: '#94a3b8' }} /> Plano</span>
                <span className="leg-item" style={{ fontSize: '0.65rem' }}><span className="leg-dot" style={{ width: '6px', height: '6px', background: '#3b82f6' }} /> Real</span>
                <span className="leg-item" style={{ fontSize: '0.65rem' }}><span className="leg-dot" style={{ width: '6px', height: '6px', background: '#f59e0b' }} /> Extra</span>
              </div>
            </div>
          </div>
        </div>
      </div>



      {isAdminOrGestao && (
        <div className="management-insights">
          <div className="dash-card insight-card" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
            <div className="dash-card-header"><h3>Top Temas Atrasados</h3></div>
            <div className="ranking-list">
              {topLateThemes.length > 0 ? topLateThemes.map((t, i) => (
                <div key={t.theme?.id} className="ranking-item-premium">
                  <span className={`rank-badge-pill ${i < 3 ? `rank-${i+1}` : 'rank-other'}`}>{i+1}º</span>
                  <span className="rank-name-prime">{t.theme?.name}</span>
                  <span className="rank-val-prime" style={{ color: '#ef4444' }}>{t.count} ativ.</span>
                </div>
              )) : <div className="empty-ranking-msg">✓ Nenhum tema com atraso identificado</div>}
            </div>
          </div>
          <div className="dash-card insight-card" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
            <div className="dash-card-header"><h3>Gargalos por Analista</h3></div>
            <div className="ranking-list">
              {topLateUsers.length > 0 ? topLateUsers.map((u, i) => (
                <div key={u.user?.id} className="ranking-item-premium">
                  <span className={`rank-badge-pill ${i < 3 ? `rank-${i+1}` : 'rank-other'}`}>{i+1}º</span>
                  <span className="rank-name-prime">{u.user?.name}</span>
                  <span className="rank-val-prime" style={{ color: '#f59e0b' }}>{u.count} atrasos</span>
                </div>
              )) : <div className="empty-ranking-msg">✓ Todos os analistas em dia</div>}
            </div>
          </div>
          <div className="dash-card insight-card" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
            <div className="dash-card-header"><h3>Top Performers</h3></div>
            <div className="ranking-list">
              {topDeliveryUsers.length > 0 ? topDeliveryUsers.map((u, i) => (
                <div key={u.user?.id} className="ranking-item-premium">
                  <span className={`rank-badge-pill ${i < 3 ? `rank-${i+1}` : 'rank-other'}`}>{i+1}º</span>
                  <span className="rank-name-prime">{u.user?.name}</span>
                  <span className="rank-val-prime" style={{ color: '#10b981' }}>{u.count} finalizadas</span>
                </div>
              )) : <div className="empty-ranking-msg">Aguardando entregas...</div>}
            </div>
          </div>
        </div>
      )}

      <div className="dash-card">
        <div className="dash-card-header">
          <Target size={18} />
          <h3>Produtividade por Tema</h3>
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
