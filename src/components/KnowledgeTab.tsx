import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, X, Edit2, Plus, Layout, Globe, AlertCircle, Trash2, ShieldAlert } from 'lucide-react';
import type { User, KnowledgeCategory, KnowledgeActivity, KnowledgeProgress, KnowledgeStatus, OrgSector } from '../types';
import { dbService } from '../services/db';
import React from 'react';

interface Props {
  currentUser: User | null;
  users: User[];
  categories: KnowledgeCategory[];
  activities: KnowledgeActivity[];
  progress: KnowledgeProgress[];
  onRefresh: () => void;
  sectors: OrgSector[];
}

export default function KnowledgeTab({ currentUser, users, categories, activities, progress, onRefresh, sectors }: Props) {
  const [activeArea, setActiveArea] = useState<string>('');
  const [optimisticProgress, setOptimisticProgress] = useState<Record<string, KnowledgeStatus>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Modals
  const [catModal, setCatModal] = useState<{ open: boolean; editing: KnowledgeCategory | null }>({ open: false, editing: null });
  const [actModal, setActModal] = useState<{ open: boolean; editing: KnowledgeActivity | null; categoryId?: string; suggestedOrder?: string }>({ open: false, editing: null });
  const [userModal, setUserModal] = useState<{ open: boolean }>({ open: false });

  const p = currentUser?.permissions;
  const isGlobalAdmin = (currentUser?.role === 'Administrador' || currentUser?.role === 'Super Admin') || currentUser?.role === 'Super Admin';
  
  // Set default active area
  useEffect(() => {
    if (sectors.length > 0 && !activeArea) {
      setActiveArea(sectors[0].name);
    }
  }, [sectors, activeArea]);

  const canView = useMemo(() => {
    if (isGlobalAdmin) return true;
    if (activeArea === 'T&P') return p?.conhecimentoTP?.view ?? (currentUser?.role === 'Gestão');
    if (activeArea === 'Projetos') return p?.conhecimentoProj?.view ?? (currentUser?.role === 'Gestão');
    return true; 
  }, [currentUser, activeArea, p, isGlobalAdmin]);

  const canEdit = useMemo(() => {
    if (isGlobalAdmin) return true;
    if (activeArea === 'T&P') return p?.conhecimentoTP?.edit ?? (currentUser?.role === 'Gestão');
    if (activeArea === 'Projetos') return p?.conhecimentoProj?.edit ?? (currentUser?.role === 'Gestão');
    return currentUser?.role === 'Gestão';
  }, [currentUser, activeArea, p, isGlobalAdmin]);

  const isAdmin = canEdit;
  
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
    Object.entries(optimisticProgress).forEach(([key, status]) => {
      map[key] = status;
    });
    return map;
  }, [progress, optimisticProgress]);

  const handleCycleStatus = async (userId: string, activityId: string) => {
    if (!isAdmin || isUpdating) return;
    
    const key = `${userId}-${activityId}`;
    const currentStatus = progressMap[key] || 'empty';
    let nextStatus: KnowledgeStatus = 'empty';
    
    if (currentStatus === 'empty') nextStatus = 'checked';
    else if (currentStatus === 'checked') nextStatus = 'x';
    else if (currentStatus === 'x') nextStatus = 'empty';

    setOptimisticProgress(prev => ({ ...prev, [key]: nextStatus }));
    
    try {
      setIsUpdating(true);
      await dbService.saveKnowledgeProgress({ userId, activityId, status: nextStatus }, currentUser?.organization_id);
      onRefresh();
    } catch (err) {
      console.error("Failed to update status:", err);
      setOptimisticProgress(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const openCatModal = (cat?: KnowledgeCategory) => setCatModal({ open: true, editing: cat || null });
  const handleSaveCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const catData: KnowledgeCategory = {
      id: catModal.editing?.id || crypto.randomUUID(),
      name: fd.get('name') as string,
      order: fd.get('order') as string,
      area: fd.get('area') as string || activeArea
    };
    await dbService.saveKnowledgeCategory(catData, currentUser?.organization_id);
    setCatModal({ open: false, editing: null });
    onRefresh();
  };

  const getNextOrder = (catId: string) => {
    const catActs = activities.filter(a => a.categoryId === catId);
    if (catActs.length === 0) {
      const cat = categories.find(c => c.id === catId);
      return cat ? `${cat.order}.1` : '1.1';
    }
    const sorted = [...catActs].sort((a, b) => String(a.order).localeCompare(String(b.order), undefined, { numeric: true }));
    const lastOrder = String(sorted[sorted.length - 1].order);
    const parts = lastOrder.split('.');
    const lastPart = parts[parts.length - 1];
    const nextVal = parseInt(lastPart, 10);
    if (!isNaN(nextVal)) {
      parts[parts.length - 1] = (nextVal + 1).toString();
      return parts.join('.');
    }
    return lastOrder + '.1';
  };

  const openActModal = (act?: KnowledgeActivity, categoryId?: string) => {
    const suggested = (!act && categoryId) ? getNextOrder(categoryId) : undefined;
    setActModal({ open: true, editing: act || null, categoryId, suggestedOrder: suggested });
  };

  const handleSaveActivity = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const actData: KnowledgeActivity = {
      id: actModal.editing?.id || crypto.randomUUID(),
      categoryId: actModal.categoryId || (fd.get('categoryId') as string),
      name: fd.get('name') as string,
      order: fd.get('order') as string
    };
    await dbService.saveKnowledgeActivity(actData, currentUser?.organization_id);
    setActModal({ open: false, editing: null });
    onRefresh();
  };

  const handleSaveUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newUser: Partial<User> = {
      name: fd.get('name') as string,
      role: 'Analista',
      area: fd.get('area') as string,
      id: crypto.randomUUID()
    };
    await dbService.saveUser(newUser as User, currentUser || undefined, currentUser?.organization_id);
    setUserModal({ open: false });
    onRefresh();
  };

  const getAreaEvolution = (areaName: string) => {
    const areaCats = categories.filter(cat => cat.area === areaName || (!cat.area && sectors.length > 0 && areaName === sectors[0].name));
    const areaActs = activities.filter(act => areaCats.some(cat => cat.id === act.categoryId));
    const areaAnalysts = users.filter(u => u.role === 'Analista' && (u.area === areaName || !u.area));
    
    if (areaActs.length === 0 || areaAnalysts.length === 0) return 0;
    
    let checkedCount = 0;
    areaAnalysts.forEach(u => {
      areaActs.forEach(act => {
        if (progressMap[`${u.id}-${act.id}`] === 'checked') checkedCount++;
      });
    });
    
    return Math.round((checkedCount / (areaActs.length * areaAnalysts.length)) * 100);
  };

  const analystStats = useMemo(() => {
    const areaCats = categories.filter(cat => cat.area === activeArea || (!cat.area && sectors.length > 0 && activeArea === sectors[0].name));
    const areaActs = activities.filter(act => areaCats.some(cat => cat.id === act.categoryId));
    
    return areaAnalysts.map(u => {
      let checked = 0;
      areaActs.forEach(act => {
        if (progressMap[`${u.id}-${act.id}`] === 'checked') checked++;
      });
      const pct = areaActs.length > 0 ? Math.round((checked / areaActs.length) * 100) : 0;
      return { ...u, pct };
    }).sort((a,b) => b.pct - a.pct);
  }, [areaAnalysts, activities, categories, progressMap, activeArea, sectors]);

  if (!canView) {
    return (
      <div className="tab-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', color: 'var(--text-secondary)' }}>
        <ShieldAlert size={48} />
        <h2>Acesso Restrito</h2>
        <p>Você não tem permissão para visualizar a matriz de {activeArea}.</p>
      </div>
    );
  }

  return (
    <div className="tab-content kn-full-root">
      <div className="tab-header kn-header">
        <div className="kn-header-top">
          <div>
            <h1 className="tab-title">Matriz de Competência</h1>
            <p className="tab-subtitle">Controle de aprendizagem e assimilação • {activeArea}</p>
          </div>

          <div className="kn-summary-stats" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {sectors.map(sec => {
              const evo = getAreaEvolution(sec.name);
              return (
                <div key={sec.id} className={`kn-stat-card ${activeArea === sec.name ? 'active' : ''}`} onClick={() => setActiveArea(sec.name)} style={{ cursor: 'pointer', minWidth: '150px' }}>
                  <span className="kn-stat-label">EVOLUÇÃO {sec.name.toUpperCase()}</span>
                  <div className="kn-stat-value-row">
                    <span className="kn-stat-number">{evo}%</span>
                    <div className="kn-stat-mini-bar"><div className="kn-stat-fill" style={{ width: `${evo}%`, background: sec.color || 'var(--accent)' }} /></div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="kn-nav-actions">
            <div className="kn-legend">
              <div className="kn-leg-item"><div className="kn-leg-box st-checked"><Check size={12}/></div> <span>Aprendido</span></div>
              <div className="kn-leg-item"><div className="kn-leg-box st-x"><X size={12}/></div> <span>Treinar</span></div>
              <div className="kn-leg-item"><div className="kn-leg-box st-empty"></div> <span>Pendente</span></div>
            </div>
            {isAdmin && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-primary btn-sm" onClick={() => setUserModal({ open: true })}>
                  <Plus size={16} /> Novo Analista
                </button>
                <button className="btn-primary btn-sm" onClick={() => openCatModal()}>
                  <Plus size={16} /> Nova Categoria
                </button>
              </div>
            )}
            <div className="kn-picker">
              {sectors.map(sec => (
                <button
                  key={sec.id}
                  className={`kn-picker-btn ${activeArea === sec.name ? 'active-tp' : ''}`}
                  style={activeArea === sec.name ? { background: sec.color || 'var(--accent)', color: 'white', borderColor: sec.color || 'var(--accent)' } : {}}
                  onClick={() => setActiveArea(sec.name)}
                >
                  {sec.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="kn-analysts-strip">
          {analystStats.map(stat => (
            <div key={stat.id} className="kn-analyst-card">
              <div className="kn-analyst-info">
                <span className="kn-an-name" title={stat.name}>{stat.name}</span>
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
      </div>

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
                    {sectors.map(sec => (
                      <option key={sec.id} value={sec.name}>{sec.name}</option>
                    ))}
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
                <div className="form-group"><label>Ordem (ex: 1.1, 2.3)</label><input name="order" defaultValue={actModal.editing?.order || actModal.suggestedOrder} required /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setActModal({ open: false, editing: null })}>Cancelar</button>
                <button type="submit" className="btn-primary">Salvar</button>
              </div>
            </form>
          </div>
        </div>, document.body
      )}

      {userModal.open && createPortal(
        <div className="modal-overlay" onClick={() => setUserModal({ open: false })}>
          <div className="modal-box" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>Novo Analista</h2></div>
            <form onSubmit={handleSaveUser}>
              <div className="modal-body">
                <div className="form-group"><label>Nome Completo</label><input name="name" required placeholder="Ex: João Silva" /></div>
                <div className="form-group"><label>Área</label>
                  <select name="area" defaultValue={activeArea}>
                    {sectors.map(sec => (
                      <option key={sec.id} value={sec.name}>{sec.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setUserModal({ open: false })}>Cancelar</button>
                <button type="submit" className="btn-primary">Criar Analista</button>
              </div>
            </form>
          </div>
        </div>, document.body
      )}
    </div>
  );
}
