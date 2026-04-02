import { useState, useMemo } from 'react';
import { Check, X, Plus, Edit2, Save, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
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

export default function KnowledgeTab({ currentUser, users, categories, activities, progress, onRefresh }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');

  const isAdmin = currentUser?.role === 'Administrador' || currentUser?.role === 'Gestão';
  
  const tpAnalysts = useMemo(() => users.filter(u => u.role === 'Analista' && u.area === 'T&P'), [users]);
  const projectAnalysts = useMemo(() => users.filter(u => u.role === 'Analista' && u.area === 'Projetos'), [users]);
  const otherAnalysts = useMemo(() => users.filter(u => u.role === 'Analista' && !u.area), [users]);
  const allAnalysts = [...tpAnalysts, ...projectAnalysts, ...otherAnalysts];

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

  const getProgressForGroup = (group: User[]) => {
    return group.map(user => {
      const checked = activities.filter(act => progressMap[`${user.id}-${act.id}`] === 'checked').length;
      const total = activities.length;
      const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
      return { user, pct };
    });
  };

  const tpProgress = useMemo(() => getProgressForGroup(tpAnalysts), [tpAnalysts, activities, progressMap]);
  const projProgress = useMemo(() => getProgressForGroup(projectAnalysts), [projectAnalysts, activities, progressMap]);
  const otherProgress = useMemo(() => getProgressForGroup(otherAnalysts), [otherAnalysts, activities, progressMap]);

  return (
    <div className="tab-content kn-root">
      <div className="tab-header">
        <div>
          <h1 className="tab-title">Matriz de Competência</h1>
          <p className="tab-subtitle">Controle de aprendizagem e assimilação por Área</p>
        </div>
      </div>

      <div className="kn-card">
        <div className="kn-table-wrapper">
          <table className="kn-table">
            <thead>
              <tr className="kn-group-header-row">
                <th colSpan={2}></th>
                {tpAnalysts.length > 0 && (
                  <th colSpan={tpAnalysts.length} className="kn-group-th tp-group">T&P</th>
                )}
                {projectAnalysts.length > 0 && (
                  <th colSpan={projectAnalysts.length} className="kn-group-th proj-group">PROJETOS</th>
                )}
                {otherAnalysts.length > 0 && (
                  <th colSpan={otherAnalysts.length} className="kn-group-th">SEM ÁREA</th>
                )}
              </tr>
              <tr>
                <th style={{ width: '40px' }}>IT</th>
                <th style={{ width: '300px' }}>DESCRIÇÃO DA ATIVIDADE</th>
                {allAnalysts.map(u => (
                  <th key={u.id} className="kn-analyst-head">
                    <div className="kn-analyst-name-vertical">{u.name}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map(cat => (
                <React.Fragment key={cat.id}>
                  <tr className="kn-cat-row">
                    <td>{cat.order}</td>
                    <td colSpan={allAnalysts.length + 1} className="kn-cat-name">{cat.name.toUpperCase()}</td>
                  </tr>
                  {activities
                    .filter(act => act.categoryId === cat.id)
                    .map(act => (
                      <tr key={act.id}>
                        <td className="kn-act-order">{act.order}</td>
                        <td className="kn-act-name">
                          {editingId === act.id ? (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <input 
                                className="kn-act-edit-input"
                                value={tempName}
                                onChange={e => setTempName(e.target.value)}
                                autoFocus
                              />
                              <button onClick={() => handleSaveActivity(act)} className="action-btn edit"><Save size={14}/></button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>{act.name}</span>
                              {isAdmin && (
                                <button onClick={() => handleEditActivity(act)} className="action-btn edit" style={{ opacity: 0.3 }}>
                                  <Edit2 size={12}/>
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        {allAnalysts.map(u => {
                          const status = progressMap[`${u.id}-${act.id}`] || 'empty';
                          return (
                            <td 
                              key={u.id} 
                              className="kn-cell-center"
                              onClick={() => handleCycleStatus(u.id, act.id)}
                            >
                              <div className="kn-status-icon">
                                {status === 'checked' && <Check size={18} className="kn-check" />}
                                {status === 'x' && <X size={18} className="kn-x" />}
                                {status === 'empty' && <div className="kn-empty">─</div>}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <div className="kn-charts-container">
          <div className="kn-chart-block">
            <h3 className="kn-chart-title">Evolução T&P</h3>
            {tpProgress.length === 0 ? <p className="kn-no-data">Nenhum analista T&P</p> : 
              tpProgress.map(({ user, pct }) => (
                <div key={user.id} className="kn-progress-row">
                  <span className="kn-progress-label">{user.name}</span>
                  <div className="kn-progress-bar-bg">
                    <div className="kn-progress-bar-fill" style={{ width: `${pct}%`, background: 'var(--accent-primary)' }} />
                  </div>
                  <span className="kn-progress-pct">{pct}%</span>
                </div>
              ))}
          </div>

          <div className="kn-chart-block">
            <h3 className="kn-chart-title">Evolução PROJETOS</h3>
            {projProgress.length === 0 ? <p className="kn-no-data">Nenhum analista Projetos</p> : 
              projProgress.map(({ user, pct }) => (
                <div key={user.id} className="kn-progress-row">
                  <span className="kn-progress-label">{user.name}</span>
                  <div className="kn-progress-bar-bg">
                    <div className="kn-progress-bar-fill" style={{ width: `${pct}%`, background: '#10b981' }} />
                  </div>
                  <span className="kn-progress-pct">{pct}%</span>
                </div>
              ))}
          </div>

          {otherProgress.length > 0 && (
            <div className="kn-chart-block">
              <h3 className="kn-chart-title">Evolução Outros / Sem Área</h3>
              {otherProgress.map(({ user, pct }) => (
                <div key={user.id} className="kn-progress-row">
                  <span className="kn-progress-label">{user.name}</span>
                  <div className="kn-progress-bar-bg">
                    <div className="kn-progress-bar-fill" style={{ width: `${pct}%`, background: '#94a3b8' }} />
                  </div>
                  <span className="kn-progress-pct">{pct}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
