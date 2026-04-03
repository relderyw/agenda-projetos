import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Check, X, Edit2, Plus, Layout, Globe, AlertCircle, Trash2 } from 'lucide-react';
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
  
  // Modals
  const [catModal, setCatModal] = useState<{ open: boolean; editing: KnowledgeCategory | null }>({ open: false, editing: null });
  const [actModal, setActModal] = useState<{ open: boolean; editing: KnowledgeActivity | null; categoryId?: string }>({ open: false, editing: null });

  const isAdmin = currentUser?.role === 'Administrador' || currentUser?.role === 'Gestão';
  
  const areaAnalysts = useMemo(() => 
    users.filter(u => u.role === 'Analista' && (u.area === activeArea || !u.area)), 
  [users, activeArea]);

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

  const openCatModal = (cat?: KnowledgeCategory) => setCatModal({ open: true, editing: cat || null });
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

  const openActModal = (act?: KnowledgeActivity, categoryId?: string) => setActModal({ open: true, editing: act || null, categoryId });
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

  const getAreaEvolution = (area: MatrixArea) => {
    const areaCats = categories.filter(cat => cat.area === area || (!cat.area && area === 'T&P'));
    const areaActs = activities.filter(act => areaCats.some(cat => cat.id === act.categoryId));
    const areaAnalysts = users.filter(u => u.role === 'Analista' && (u.area === area || !u.area));
    
    if (areaActs.length === 0 || areaAnalysts.length === 0) return 0;
    
    let checkedCount = 0;
    areaAnalysts.forEach(u => {
      areaActs.forEach(act => {
        if (progressMap[`${u.id}-${act.id}`] === 'checked') checkedCount++;
      });
    });
    
    return Math.round((checkedCount / (areaActs.length * areaAnalysts.length)) * 100);
  };

  const tpEvolution = useMemo(() => getAreaEvolution('T&P'), [categories, activities, users, progressMap]);
  const projEvolution = useMemo(() => getAreaEvolution('Projetos'), [categories, activities, users, progressMap]);

  // Individual Analyst Progress
  const analystStats = useMemo(() => {
    const areaCats = categories.filter(cat => cat.area === activeArea || (!cat.area && activeArea === 'T&P'));
    const areaActs = activities.filter(act => areaCats.some(cat => cat.id === act.categoryId));
    
    return areaAnalysts.map(u => {
      let checked = 0;
      areaActs.forEach(act => {
        if (progressMap[`${u.id}-${act.id}`] === 'checked') checked++;
      });
      const pct = areaActs.length > 0 ? Math.round((checked / areaActs.length) * 100) : 0;
      return { ...u, pct };
    }).sort((a,b) => b.pct - a.pct); // Sort by highest progress
  }, [areaAnalysts, activities, categories, progressMap, activeArea]);

  return (
    <div className="tab-content kn-full-root">
      {/* ── Header ── */}
      <div className="tab-header kn-header">
        <div>
          <h1 className="tab-title">Matriz de Competência</h1>
          <p className="tab-subtitle">Controle de aprendizagem e assimilação • {activeArea}</p>
        </div>

        <div className="kn-summary-stats">
          <div className="kn-stat-card tp">
            <span className="kn-stat-label">EVOLUÇÃO T&P</span>
            <div className="kn-stat-value-row">
              <span className="kn-stat-number">{tpEvolution}%</span>
              <div className="kn-stat-mini-bar"><div className="kn-stat-fill" style={{ width: `${tpEvolution}%` }} /></div>
            </div>
          </div>
          <div className="kn-stat-card proj">
            <span className="kn-stat-label">EVOLUÇÃO PROJETOS</span>
            <div className="kn-stat-value-row">
              <span className="kn-stat-number">{projEvolution}%</span>
              <div className="kn-stat-mini-bar"><div className="kn-stat-fill" style={{ width: `${projEvolution}%` }} /></div>
            </div>
          </div>
        </div>

        <div className="kn-nav-actions">
          <div className="kn-legend">
            <div className="kn-leg-item"><div className="kn-leg-box st-checked"><Check size={12}/></div> <span>Aprendido</span></div>
            <div className="kn-leg-item"><div className="kn-leg-box st-x"><X size={12}/></div> <span>Treinar</span></div>
            <div className="kn-leg-item"><div className="kn-leg-box st-empty"></div> <span>Pendente</span></div>
          </div>
          {isAdmin && (
            <button className="btn-primary btn-sm" onClick={() => openCatModal()}>
              <Plus size={16} /> Nova Categoria
            </button>
          )}
          <div className="kn-picker">
            <button className={`kn-picker-btn ${activeArea === 'T&P' ? 'active-tp' : ''}`} onClick={() => setActiveArea('T&P')}>T&P</button>
            <button className={`kn-picker-btn ${activeArea === 'Projetos' ? 'active-proj' : ''}`} onClick={() => setActiveArea('Projetos')}>PROJETOS</button>
          </div>
        </div>
      </div>

      {/* ── Analysts Evolution Strip ── */}
      <div className="kn-analysts-strip">
        {analystStats.map(stat => (
          <div key={stat.id} className="kn-analyst-card">
            <div className="kn-analyst-info">
              <span className="kn-an-name">{stat.name}</span>
              <span className="kn-an-pct">{stat.pct}%</span>
            </div>
            <div className="kn-an-bar-bg">
              <div 
                className="kn-an-bar-fill" 
                style={{ 
                  width: `${stat.pct}%`,
                  background: stat.pct > 70 ? '#10b981' : stat.pct > 30 ? '#f59e0b' : '#ef4444' 
                }} 
              />
            </div>
          </div>
        ))}
      </div>

      {/* ── Table Container ── */}
      <div className="kn-matrix-wrapper">
        {areaCategories.length === 0 ? (
          <div className="kn-empty-onboarding">
            <AlertCircle size={48} className="kn-empty-icon" />
            <h2>Nenhuma competência cadastrada</h2>
            <p>Você ainda não definiu itens para a matriz de <strong>{activeArea}</strong>.</p>
            {isAdmin && (
              <button className="btn-primary" onClick={() => openCatModal()} style={{ marginTop: '1.5rem' }}>
                Adicionar Primeira Categoria
              </button>
            )}
          </div>
        ) : (
          <div className="kn-table-frame">
            <table className="kn-photo-table">
              <thead>
                <tr>
                  <th className="kn-th-it sticky-left">IT</th>
                  <th className="kn-th-colab sticky-left-2">COLABORADOR</th>
                  {areaAnalysts.map(u => (
                    <th key={u.id} className="kn-th-analyst">
                      <div className="kn-vertical-name">{u.name}</div>
                    </th>
                  ))}
                  <th className="kn-th-pend">PENDENTE</th>
                </tr>
              </thead>
              <tbody>
                {areaCategories.map(cat => (
                  <React.Fragment key={cat.id}>
                    <tr className="kn-row-category">
                      <td className="sticky-left">{cat.order}</td>
                      <td colSpan={areaAnalysts.length + 2} className="kn-cat-cell">
                        <div className="kn-cat-flex">
                          <span>{cat.name.toUpperCase()}</span>
                          {isAdmin && (
                            <div className="kn-cat-tools">
                              <button onClick={() => openActModal(undefined, cat.id)} className="tool-btn" title="Add Atividade"><Plus size={12}/></button>
                              <button onClick={() => openCatModal(cat)} className="tool-btn" title="Editar"><Edit2 size={12}/></button>
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
                          <tr key={act.id} className="kn-row-activity">
                            <td className="kn-cell-it sticky-left">{act.order}</td>
                            <td className="kn-cell-desc sticky-left-2">
                              <div className="kn-desc-flex">
                                <span>{act.name}</span>
                                {isAdmin && (
                                  <button onClick={() => openActModal(act, cat.id)} className="act-tool"><Edit2 size={10}/></button>
                                )}
                              </div>
                            </td>
                            {areaAnalysts.map(u => {
                              const status = progressMap[`${u.id}-${act.id}`] || 'empty';
                              return (
                                <td key={u.id} className={`kn-cell-status st-${status}`} onClick={() => handleCycleStatus(u.id, act.id)}>
                                  {status === 'checked' && <div className="mark-check"><Check size={18} /></div>}
                                  {status === 'x' && <div className="mark-x"><X size={18} /></div>}
                                </td>
                              );
                            })}
                            <td className="kn-cell-pend">{pendCount}</td>
                          </tr>
                        );
                      })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- Modals --- */}
      {catModal.open && createPortal(
        <div className="modal-overlay" onClick={() => setCatModal({ open: false, editing: null })}>
          <div className="modal-box" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>{catModal.editing ? 'Editar Categoria' : 'Nova Categoria'}</h2></div>
            <form onSubmit={handleSaveCategory}>
              <div className="modal-body">
                <div className="form-group"><label>Nome da Categoria</label><input name="name" defaultValue={catModal.editing?.name} required /></div>
                <div className="form-group"><label>Ordem (ex: 1, 2, 3)</label><input name="order" type="number" defaultValue={catModal.editing?.order} required /></div>
                <div className="form-group"><label>Área</label>
                  <select name="area" defaultValue={catModal.editing?.area || activeArea}>
                    <option value="T&P">T&P</option><option value="Projetos">Projetos</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setCatModal({ open: false, editing: null })}>Cancelar</button>
                <button type="submit" className="btn-primary">Salvar</button>
              </div>
            </form>
          </div>
        </div>, document.body
      )}

      {actModal.open && createPortal(
        <div className="modal-overlay" onClick={() => setActModal({ open: false, editing: null })}>
          <div className="modal-box" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>{actModal.editing ? 'Editar Atividade' : 'Nova Atividade'}</h2></div>
            <form onSubmit={handleSaveActivity}>
              <div className="modal-body">
                <div className="form-group"><label>Nome da Atividade</label><input name="name" defaultValue={actModal.editing?.name} required /></div>
                <div className="form-group"><label>Ordem (ex: 1.1, 2.3)</label><input name="order" defaultValue={actModal.editing?.order} required /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setActModal({ open: false, editing: null })}>Cancelar</button>
                <button type="submit" className="btn-primary">Salvar</button>
              </div>
            </form>
          </div>
        </div>, document.body
      )}
    </div>
  );
}
