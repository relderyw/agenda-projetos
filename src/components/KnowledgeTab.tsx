import { useState, useMemo } from 'react';
import { Check, X, Plus, Edit2, Save, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import type { User, KnowledgeCategory, KnowledgeActivity, KnowledgeProgress, KnowledgeStatus } from '../types';
import { dbService } from '../services/db';

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
  const analysts = useMemo(() => users.filter(u => u.role === 'Analista'), [users]);

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

  const analystProgress = useMemo(() => {
    return analysts.map(user => {
      const checked = activities.filter(act => progressMap[`${user.id}-${act.id}`] === 'checked').length;
      const total = activities.length;
      const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
      return { user, pct };
    });
  }, [analysts, activities, progressMap]);

  return (
    <div className="tab-content kn-root">
      <div className="tab-header">
        <div>
          <h1 className="tab-title">Matriz de Competência</h1>
          <p className="tab-subtitle">Controle de aprendizagem e assimilação</p>
        </div>
      </div>

      <div className="kn-card">
        <div className="kn-table-wrapper">
          <table className="kn-table">
            <thead>
              <tr>
                <th>IT</th>
                <th>COLABORADOR</th>
                {analysts.map(u => (
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
                    <td colSpan={analysts.length + 1} className="kn-cat-name">{cat.name.toUpperCase()}</td>
                  </tr>
                  {activities
                    .filter(act => act.categoryId === cat.id)
                    .map(act => (
                      <tr key={act.id}>
                        <td>{act.order}</td>
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
                        {analysts.map(u => {
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

        <div className="kn-progress-section">
          <h3 style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Gráfico de Evolução por Analista
          </h3>
          {analystProgress.map(({ user, pct }) => (
            <div key={user.id} className="kn-progress-row">
              <span className="kn-progress-label">{user.name}</span>
              <div className="kn-progress-bar-bg">
                <div className="kn-progress-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="kn-progress-pct">{pct}%</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', fontWeight: 'bold' }}>100%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import React from 'react'; // Final import for React.Fragment
