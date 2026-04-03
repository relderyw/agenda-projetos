import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Check, X, Edit2, Save, ChevronRight, BarChart2, Layout, Globe, Plus, Trash2 } from 'lucide-react';
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
  
  // Modals
  const [catModal, setCatModal] = useState<{ open: boolean; editing: KnowledgeCategory | null }>({ open: false, editing: null });
  const [actModal, setActModal] = useState<{ open: boolean; editing: KnowledgeActivity | null; categoryId?: string }>({ open: false, editing: null });

  const isAdmin = currentUser?.role === 'Administrador' || currentUser?.role === 'Gestão';
  
  // Analysts: show current area analysts OR those with no area
  const areaAnalysts = useMemo(() => 
    users.filter(u => u.role === 'Analista' && (u.area === activeArea || !u.area)), 
  [users, activeArea]);

  // Categories: show current area categories OR those with no area
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

  // --- Category CRUD ---
  const openCatModal = (cat?: KnowledgeCategory) => {
    setCatModal({ open: true, editing: cat || null });
  };
  const handleSaveCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const catData: KnowledgeCategory = {
      id: catModal.editing?.id || crypto.randomUUID(),
      name: fd.get('name') as string,
      order: Number(fd.get('order')),
      area: fd.get('area') as MatrixArea || activeArea
    };
    await dbService.saveKnowledgeCategory(catData);
    setCatModal({ open: false, editing: null });
    onRefresh();
  };

  // --- Activity CRUD ---
  const openActModal = (act?: KnowledgeActivity, categoryId?: string) => {
    setActModal({ open: true, editing: act || null, categoryId });
  };
  const handleSaveActivity = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const actData: KnowledgeActivity = {
      id: actModal.editing?.id || crypto.randomUUID(),
      categoryId: actModal.categoryId || (fd.get('categoryId') as string),
      name: fd.get('name') as string,
      order: Number(fd.get('order'))
    };
    await dbService.saveKnowledgeActivity(actData);
    setActModal({ open: false, editing: null });
    onRefresh();
  };

  const areaProgress = useMemo(() => {
    const areaActivitiesIds = activities.filter(act => 
      areaCategories.some(cat => cat.id === act.categoryId)
    ).map(act => act.id);
    
    return areaAnalysts.map(user => {
      const checked = activities.filter(act => 
        areaActivitiesIds.includes(act.id) && progressMap[`${user.id}-${act.id}`] === 'checked'
      ).length;
      const total = areaActivitiesIds.length;
      const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
      return { user, pct };
    });
  }, [areaAnalysts, areaCategories, activities, progressMap]);

  return (
    <div className="tab-content kn-root">
      <div className="tab-header">
        <div>
          <h1 className="tab-title">Matriz de Competência</h1>
          <p className="tab-subtitle">Controle de aprendizagem e assimilação por Área</p>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {isAdmin && (
            <button className="btn-ghost btn-sm" onClick={() => openCatModal()}>
              <Plus size={16} /> Nova Categoria
            </button>
          )}
          <div className="kn-area-toggle-compact">
            <button 
              className={`kn-toggle-pill ${activeArea === 'T&P' ? 'active-tp' : ''}`}
              onClick={() => setActiveArea('T&P')}
            >
              T&P
            </button>
            <button 
              className={`kn-toggle-pill ${activeArea === 'Projetos' ? 'active-proj' : ''}`}
              onClick={() => setActiveArea('Projetos')}
            >
              PROJETOS
            </button>
          </div>
        </div>
      </div>

      <div className="kn-grid-layout">
        <div className="kn-matrix-card">
          <div className="kn-table-scroll-container">
            <table className="kn-grid-table">
              <thead>
                <tr className="kn-grid-head">
                  <th className="kn-grid-th-id sticky-col">IT</th>
                  <th className="kn-grid-th-desc sticky-col-2">COLABORADOR</th>
                  {areaAnalysts.map(u => (
                    <th key={u.id} className="kn-grid-th-user">
                      <div className="kn-user-vertical">
                        <span>{u.name}</span>
                      </div>
                    </th>
                  ))}
                  <th className="kn-grid-th-user kn-th-pend">PENDENTE</th>
                </tr>
              </thead>
              <tbody>
                {areaCategories.map(cat => (
                  <React.Fragment key={cat.id}>
                    <tr className="kn-grid-category-row">
                      <td className="sticky-col">{cat.order}</td>
                      <td colSpan={areaAnalysts.length + 2} className="kn-grid-category-name">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>{cat.name.toUpperCase()}</span>
                          {isAdmin && (
                            <div className="kn-cat-actions">
                              <button onClick={() => openActModal(undefined, cat.id)} className="cat-action-btn" title="Add Atividade"><Plus size={12}/></button>
                              <button onClick={() => openCatModal(cat)} className="cat-action-btn" title="Editar"><Edit2 size={12}/></button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                    {activities
                      .filter(act => act.categoryId === cat.id)
                      .map(act => {
                        const pendCount = areaAnalysts.filter(u => progressMap[`${u.id}-${act.id}`] !== 'checked').length;
                        return (
                          <tr key={act.id} className="kn-grid-activity-row">
                            <td className="kn-grid-cell-id sticky-col">{act.order}</td>
                            <td className="kn-grid-cell-name sticky-col-2">
                              <div className="act-name-wrapper">
                                <span>{act.name}</span>
                                {isAdmin && (
                                  <button onClick={() => openActModal(act, cat.id)} className="act-edit-btn"><Edit2 size={10}/></button>
                                )}
                              </div>
                            </td>
                            {areaAnalysts.map(u => {
                              const status = progressMap[`${u.id}-${act.id}`] || 'empty';
                              return (
                                <td 
                                  key={u.id} 
                                  className={`kn-grid-cell-status st-${status}`}
                                  onClick={() => handleCycleStatus(u.id, act.id)}
                                >
                                  {status === 'checked' && <div className="kn-mark"><Check size={18} /></div>}
                                  {status === 'x' && <div className="kn-mark kn-mark-x"><X size={18} /></div>}
                                </td>
                              );
                            })}
                            <td className="kn-grid-cell-pend">{pendCount}</td>
                          </tr>
                        );
                      })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="kn-stats-side">
          <div className="kn-stats-header">Evolução por Analista</div>
          <div className="kn-stats-list">
            {areaProgress.map(({ user, pct }) => (
              <div key={user.id} className="kn-stats-item">
                <div className="kn-stats-info">
                  <span className="kn-stats-name">{user.name}</span>
                  <span className="kn-stats-pct">{pct}%</span>
                </div>
                <div className="kn-stats-bar-bg">
                  <div className="kn-stats-bar-fill" style={{ width: `${pct}%`, background: activeArea === 'T&P' ? 'var(--accent-primary)' : '#10b981' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* --- Category Modal --- */}
      {catModal.open && createPortal(
        <div className="modal-overlay" onClick={() => setCatModal({ open: false, editing: null })}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{catModal.editing ? 'Editar Categoria' : 'Nova Categoria'}</h2>
            </div>
            <form onSubmit={handleSaveCategory}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Nome da Categoria</label>
                  <input name="name" defaultValue={catModal.editing?.name} required />
                </div>
                <div className="form-group">
                  <label>Ordem (ex: 1, 2, 3)</label>
                  <input name="order" type="number" defaultValue={catModal.editing?.order} required />
                </div>
                <div className="form-group">
                  <label>Área</label>
                  <select name="area" defaultValue={catModal.editing?.area || activeArea}>
                    <option value="T&P">T&P</option>
                    <option value="Projetos">Projetos</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setCatModal({ open: false, editing: null })}>Cancelar</button>
                <button type="submit" className="btn-primary">Salvar</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* --- Activity Modal --- */}
      {actModal.open && createPortal(
        <div className="modal-overlay" onClick={() => setActModal({ open: false, editing: null })}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{actModal.editing ? 'Editar Atividade' : 'Nova Atividade'}</h2>
            </div>
            <form onSubmit={handleSaveActivity}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Nome da Atividade</label>
                  <input name="name" defaultValue={actModal.editing?.name} required />
                </div>
                <div className="form-group">
                  <label>Ordem (ex: 1.1, 2.3)</label>
                  <input name="order" defaultValue={actModal.editing?.order} required />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setActModal({ open: false, editing: null })}>Cancelar</button>
                <button type="submit" className="btn-primary">Salvar</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
