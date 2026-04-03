import { useState, useMemo } from 'react';
import { Check, X, Edit2, Save, ChevronRight, BarChart2, Globe, Layout } from 'lucide-react';
import type { User, KnowledgeCategory, KnowledgeActivity, KnowledgeProgress, KnowledgeStatus } from '../types';
import { dbService } from '../services/db';
import React from 'react';

interface Props {
  currentUser: User | null;
  users: User[];
  categories: KnowledgeCategory[];
  activities: KnowledgeActivity[];
  progress: KnowledgeProgress[];
  onRefresh: () => void;
}

type MatrixArea = 'T&P' | 'Projetos';

export default function KnowledgeTab({ currentUser, users, categories, activities, progress, onRefresh }: Props) {
  const [activeArea, setActiveArea] = useState<MatrixArea>('T&P');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');

  const isAdmin = currentUser?.role === 'Administrador' || currentUser?.role === 'Gestão';
  
  // Filter analysts based on active area
  const areaAnalysts = useMemo(() => 
    users.filter(u => u.role === 'Analista' && (u.area === activeArea || !u.area)), 
  [users, activeArea]);

  // Filter categories based on active area
  const areaCategories = useMemo(() => 
    categories.filter(cat => cat.area === activeArea || !cat.area), 
  [categories, activeArea]);

  const progressMap = useMemo(() => {
    const map: Record<string, KnowledgeStatus> = {};
    progress.forEach(p => {
      map[`${p.userId}-${p.activityId}`] = p.status;
    });
    return map;
  }, [progress]);

  const handleCycleStatus = async (userId: string, activityId: string) => {
    if (!isAdmin) return;
    
    const currentStatus = progressMap[`${userId}-${activityId}`] || 'empty';
    let nextStatus: KnowledgeStatus = 'empty';
    
    if (currentStatus === 'empty') nextStatus = 'checked';
    else if (currentStatus === 'checked') nextStatus = 'x';
    else if (currentStatus === 'x') nextStatus = 'empty';

    await dbService.saveKnowledgeProgress({ userId, activityId, status: nextStatus });
    onRefresh();
  };

  const handleEditActivity = (act: KnowledgeActivity) => {
    setEditingId(act.id);
    setTempName(act.name);
  };

  const handleSaveActivity = async (act: KnowledgeActivity) => {
    await dbService.saveKnowledgeActivity({ ...act, name: tempName });
    setEditingId(null);
    onRefresh();
  };

  const areaProgress = useMemo(() => {
    const areaActivities = activities.filter(act => 
      areaCategories.some(cat => cat.id === act.categoryId)
    );
    
    return areaAnalysts.map(user => {
      const checked = areaActivities.filter(act => progressMap[`${user.id}-${act.id}`] === 'checked').length;
      const total = areaActivities.length;
      const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
      return { user, pct };
    });
  }, [areaAnalysts, areaCategories, activities, progressMap]);

  return (
    <div className="tab-content kn-root">
      <div className="tab-header">
        <div>
          <h1 className="tab-title">Matriz de Competência</h1>
          <p className="tab-subtitle">Controle de aprendizagem e assimilação • {activeArea}</p>
        </div>

        <div className="kn-area-toggle">
          <button 
            className={`kn-toggle-btn ${activeArea === 'T&P' ? 'active tp' : ''}`}
            onClick={() => setActiveArea('T&P')}
          >
            <Layout size={16} /> T&P
          </button>
          <button 
            className={`kn-toggle-btn ${activeArea === 'Projetos' ? 'active projets' : ''}`}
            onClick={() => setActiveArea('Projetos')}
          >
            <Globe size={16} /> PROJETOS
          </button>
        </div>
      </div>

      <div className="kn-main-container">
        <div className="kn-card premium-shadow">
          <div className="kn-table-outer">
            <div className="kn-table-wrapper">
              <table className="kn-table premium">
                <thead>
                  <tr className="kn-head-row">
                    <th className="kn-th-id sticky-col">IT</th>
                    <th className="kn-th-desc sticky-col-2">DESCRIÇÃO DA ATIVIDADE</th>
                    {areaAnalysts.map(u => (
                      <th key={u.id} className="kn-analyst-head">
                        <div className="kn-analyst-wrapper">
                          <span className="kn-analyst-badge" style={{ background: u.color }}>{u.name.charAt(0)}</span>
                          <div className="kn-analyst-name-vertical">{u.name}</div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {areaCategories.map(cat => (
                    <React.Fragment key={cat.id}>
                      <tr className="kn-category-divider">
                        <td className="kn-cat-idx sticky-col">{cat.order}</td>
                        <td colSpan={areaAnalysts.length + 1} className="kn-cat-label">
                          <ChevronRight size={14} /> {cat.name.toUpperCase()}
                        </td>
                      </tr>
                      {activities
                        .filter(act => act.categoryId === cat.id)
                        .map(act => (
                          <tr key={act.id} className="kn-activity-row">
                            <td className="kn-act-idx sticky-col">{act.order}</td>
                            <td className="kn-act-info sticky-col-2">
                              {editingId === act.id ? (
                                <div className="kn-edit-box">
                                  <input 
                                    className="kn-input-premium"
                                    value={tempName}
                                    onChange={e => setTempName(e.target.value)}
                                    autoFocus
                                  />
                                  <button onClick={() => handleSaveActivity(act)} className="btn-save-mini"><Save size={12}/></button>
                                </div>
                              ) : (
                                <div className="kn-label-box">
                                  <span className="kn-label-text">{act.name}</span>
                                  {isAdmin && (
                                    <button onClick={() => handleEditActivity(act)} className="kn-edit-trigger">
                                      <Edit2 size={10}/>
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                            {areaAnalysts.map(u => {
                              const status = progressMap[`${u.id}-${act.id}`] || 'empty';
                              return (
                                <td 
                                  key={u.id} 
                                  className={`kn-cell-interactive st-${status}`}
                                  onClick={() => handleCycleStatus(u.id, act.id)}
                                >
                                  <div className="kn-status-wrap">
                                    {status === 'checked' && <div className="status-dot dot-green"><Check size={14} /></div>}
                                    {status === 'x' && <div className="status-dot dot-amber"><X size={14} /></div>}
                                    {status === 'empty' && <div className="status-dot dot-empty"></div>}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                    </React.Fragment>
                  ))}
                  {areaCategories.length === 0 && (
                    <tr>
                      <td colSpan={areaAnalysts.length + 2} className="kn-no-data">
                        Nenhuma categoria cadastrada para esta área.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="kn-side-stats">
          <div className="kn-panel premium-shadow">
            <div className="kn-panel-header">
              <BarChart2 size={18} />
              <h3>Evolução de Aprendizado</h3>
            </div>
            <div className="kn-panel-body">
              {areaProgress.length === 0 ? (
                <div className="kn-empty-state">Nenhum analista cadastrado</div>
              ) : (
                <div className="kn-progress-list">
                  {areaProgress.map(({ user, pct }) => (
                    <div key={user.id} className="kn-prog-card">
                      <div className="kn-prog-info">
                        <span className="kn-prog-name">{user.name}</span>
                        <span className="kn-prog-val">{pct}%</span>
                      </div>
                      <div className="kn-prog-track">
                        <div 
                          className="kn-prog-fill" 
                          style={{ 
                            width: `${pct}%`, 
                            background: activeArea === 'T&P' ? 'var(--accent-primary)' : '#10b981',
                            boxShadow: `0 0 10px ${activeArea === 'T&P' ? 'var(--accent-primary)' : '#10b981'}4D`
                          }} 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
