import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, X, Edit2, Plus, Layout, Globe, AlertCircle, Trash2, ShieldAlert, MessageSquare, Calendar, Smile, Frown, MinusCircle } from 'lucide-react';
import type { User, KnowledgeCategory, KnowledgeActivity, KnowledgeProgress, KnowledgeStatus, OrgSector, AnalystFeedback, FeedbackImpact } from '../types';
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
  selectedOrgId?: string;
  analystFeedbacks?: AnalystFeedback[];
  onSaveFeedback?: (feedback: AnalystFeedback) => Promise<void>;
  onDeleteFeedback?: (id: string) => Promise<void>;
}

export default function KnowledgeTab({
  currentUser,
  users,
  categories,
  activities,
  progress,
  onRefresh,
  sectors,
  selectedOrgId,
  analystFeedbacks = [],
  onSaveFeedback,
  onDeleteFeedback
}: Props) {
  const [activeArea, setActiveArea] = useState<string>('');
  const [optimisticProgress, setOptimisticProgress] = useState<Record<string, KnowledgeStatus>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Modals
  const [catModal, setCatModal] = useState<{ open: boolean; editing: KnowledgeCategory | null }>({ open: false, editing: null });
  const [actModal, setActModal] = useState<{ open: boolean; editing: KnowledgeActivity | null; categoryId?: string; suggestedOrder?: string }>({ open: false, editing: null });
  const [userModal, setUserModal] = useState<{ open: boolean }>({ open: false });
  const [feedbackModal, setFeedbackModal] = useState<{ open: boolean; analyst: User | null }>({ open: false, analyst: null });
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  const isAnalyst = currentUser?.role === 'Analista';
  const p = currentUser?.permissions;
  const isGlobalAdmin = (currentUser?.role === 'Administrador' || currentUser?.role === 'Super Admin');
  const isManagementOrAdmin = isGlobalAdmin || currentUser?.role === 'Gestão';
  
  // Set default active area
  useEffect(() => {
    if (isAnalyst && currentUser?.area) {
      setActiveArea(currentUser.area);
      return;
    }
    if (sectors.length > 0 && !activeArea) {
      setActiveArea(sectors[0].name);
    }
  }, [sectors, activeArea, isAnalyst, currentUser?.area]);

  const canView = useMemo(() => {
    if (isGlobalAdmin) return true;
    if (isAnalyst) {
      // Se for analista e tiver área, só pode ver a sua própria área
      if (currentUser?.area && activeArea && currentUser.area.toLowerCase() !== activeArea.toLowerCase()) {
        return false;
      }
      return true;
    }
    if (activeArea === 'T&P') return p?.conhecimentoTP?.view ?? (currentUser?.role === 'Gestão');
    if (activeArea === 'Projetos') return p?.conhecimentoProj?.view ?? (currentUser?.role === 'Gestão');
    return true; 
  }, [currentUser, activeArea, p, isGlobalAdmin, isAnalyst]);

  const canEdit = useMemo(() => {
    if (isAnalyst) return false; // Analista nunca edita
    if (isGlobalAdmin) return true;
    if (activeArea === 'T&P') return p?.conhecimentoTP?.edit ?? (currentUser?.role === 'Gestão');
    if (activeArea === 'Projetos') return p?.conhecimentoProj?.edit ?? (currentUser?.role === 'Gestão');
    return currentUser?.role === 'Gestão';
  }, [currentUser, activeArea, p, isGlobalAdmin, isAnalyst]);

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
    if (!isAdmin || isUpdating || isAnalyst) return;
    
    const key = `${userId}-${activityId}`;
    const currentStatus = progressMap[key] || 'empty';
    let nextStatus: KnowledgeStatus = 'empty';
    
    if (currentStatus === 'empty') nextStatus = 'checked';
    else if (currentStatus === 'checked') nextStatus = 'x';
    else if (currentStatus === 'x') nextStatus = 'empty';

    setOptimisticProgress(prev => ({ ...prev, [key]: nextStatus }));
    
    try {
      setIsUpdating(true);
      await dbService.saveKnowledgeProgress({ userId, activityId, status: nextStatus }, selectedOrgId);
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
    await dbService.saveKnowledgeCategory(catData, selectedOrgId);
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
    await dbService.saveKnowledgeActivity(actData, selectedOrgId);
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
    await dbService.saveUser(newUser as User, currentUser || undefined, selectedOrgId);
    setUserModal({ open: false });
    onRefresh();
  };

  const handleFeedbackSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!feedbackModal.analyst || !currentUser) return;
    const fd = new FormData(e.currentTarget);
    const date = fd.get('date') as string;
    const comment = fd.get('comment') as string;
    const impact = fd.get('impact') as FeedbackImpact;

    if (!date || !comment || !impact) return;

    try {
      setFeedbackSubmitting(true);
      const newFeedback: AnalystFeedback = {
        id: crypto.randomUUID(),
        analystId: feedbackModal.analyst.id,
        authorId: currentUser.id,
        authorName: currentUser.name,
        date,
        comment,
        impact,
        createdAt: new Date().toISOString()
      };

      if (onSaveFeedback) {
        await onSaveFeedback(newFeedback);
      } else {
        await dbService.saveAnalystFeedback(newFeedback, selectedOrgId);
        onRefresh();
      }
      e.currentTarget.reset();
    } catch (err) {
      console.error("Erro ao salvar feedback:", err);
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const getAreaEvolution = (areaName: string) => {
    const areaCats = categories.filter(cat => cat.area === areaName || (!cat.area && sectors.length > 0 && areaName === sectors[0].name));
    const areaActs = activities.filter(act => areaCats.some(cat => cat.id === act.categoryId));
    const areaAnalystsList = users.filter(u => u.role === 'Analista' && (u.area === areaName || !u.area));
    
    if (areaActs.length === 0 || areaAnalystsList.length === 0) return 0;
    
    let checkedCount = 0;
    areaAnalystsList.forEach(u => {
      areaActs.forEach(act => {
        if (progressMap[`${u.id}-${act.id}`] === 'checked') checkedCount++;
      });
    });
    
    return Math.round((checkedCount / (areaActs.length * areaAnalystsList.length)) * 100);
  };

  const analystStats = useMemo(() => {
    const areaCats = categories.filter(cat => cat.area === activeArea || (!cat.area && sectors.length > 0 && activeArea === sectors[0].name));
    const areaActs = activities.filter(act => areaCats.some(cat => cat.id === act.categoryId));
    
    // Se for analista, no strip superior ele só vê o seu próprio card
    const targetAnalysts = isAnalyst 
      ? areaAnalysts.filter(u => u.id === currentUser?.id)
      : areaAnalysts;

    return targetAnalysts.map(u => {
      let checked = 0;
      areaActs.forEach(act => {
        if (progressMap[`${u.id}-${act.id}`] === 'checked') checked++;
      });
      const pct = areaActs.length > 0 ? Math.round((checked / areaActs.length) * 100) : 0;
      return { ...u, pct };
    }).sort((a,b) => b.pct - a.pct);
  }, [areaAnalysts, activities, categories, progressMap, activeArea, sectors, isAnalyst, currentUser?.id]);

  if (!canView) {
    return (
      <div className="tab-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', color: 'var(--text-secondary)' }}>
        <ShieldAlert size={48} />
        <h2>Acesso Restrito</h2>
        <p>Você não tem permissão para visualizar a matriz de {activeArea}.</p>
      </div>
    );
  }

  // Filtragem dos cards de evolução de área: analista só vê a do seu setor
  const visibleSectors = isAnalyst && currentUser?.area
    ? sectors.filter(s => s.name.toLowerCase() === currentUser.area?.toLowerCase())
    : sectors;

  const currentAnalystFeedbacks = feedbackModal.analyst
    ? analystFeedbacks
        .filter(f => f.analystId === feedbackModal.analyst?.id)
        .sort((a, b) => b.date.localeCompare(a.date))
    : [];

  return (
    <div className="tab-content kn-full-root">
      <div className="tab-header kn-header">
        <div className="kn-header-top">
          <div>
            <h1 className="tab-title">Matriz de Competência</h1>
            <p className="tab-subtitle">Controle de aprendizagem e assimilação • {activeArea}</p>
          </div>

          <div className="kn-summary-stats" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {visibleSectors.map(sec => {
              const evo = getAreaEvolution(sec.name);
              return (
                <div 
                  key={sec.id} 
                  className={`kn-stat-card ${activeArea === sec.name ? 'active' : ''}`} 
                  onClick={() => !isAnalyst && setActiveArea(sec.name)} 
                  style={{ cursor: isAnalyst ? 'default' : 'pointer', minWidth: '150px' }}
                >
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
            
            {/* Seletor de área só aparece se não for Analista */}
            {!isAnalyst && (
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
            )}
          </div>
        </div>

        <div className="kn-analysts-strip">
          {analystStats.map(stat => (
            <div key={stat.id} className="kn-analyst-card">
              <div className="kn-analyst-info">
                <span 
                  className={`kn-an-name ${isManagementOrAdmin ? 'clickable-name' : ''}`} 
                  title={isManagementOrAdmin ? `Ver/Registrar relato de ${stat.name}` : stat.name}
                  onClick={() => {
                    if (isManagementOrAdmin) {
                      setFeedbackModal({ open: true, analyst: stat });
                    }
                  }}
                >
                  {stat.name}
                </span>
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
                  {areaAnalysts.map(u => {
                    const isOtherAnalyst = isAnalyst && u.id !== currentUser?.id;
                    return (
                      <th 
                        key={u.id} 
                        className={`kn-th-analyst ${isOtherAnalyst ? 'th-masked' : ''}`}
                        title={isManagementOrAdmin ? `Clique para abrir relato de ${u.name}` : undefined}
                        onClick={() => {
                          if (isManagementOrAdmin) {
                            setFeedbackModal({ open: true, analyst: u });
                          }
                        }}
                        style={{ cursor: isManagementOrAdmin ? 'pointer' : 'default' }}
                      >
                        <div className={`kn-vertical-name ${isManagementOrAdmin ? 'clickable-header' : ''}`}>{u.name}</div>
                      </th>
                    );
                  })}
                  {!isAnalyst && <th className="kn-th-pend">PENDENTE</th>}
                </tr>
              </thead>
              <tbody>
                {areaCategories.map(cat => (
                  <React.Fragment key={cat.id}>
                    <tr className="kn-row-category">
                      <td className="sticky-left">{cat.order}</td>
                      <td colSpan={areaAnalysts.length + (isAnalyst ? 1 : 2)} className="kn-cat-cell">
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
                              const isOtherAnalyst = isAnalyst && u.id !== currentUser?.id;
                              const status = progressMap[`${u.id}-${act.id}`] || 'empty';
                              
                              if (isOtherAnalyst) {
                                return (
                                  <td 
                                    key={u.id} 
                                    className="kn-cell-status kn-cell-masked"
                                    title="Restrito aos demais colaboradores"
                                  >
                                    <div className="kn-masked-blur" />
                                  </td>
                                );
                              }

                              return (
                                <td 
                                  key={u.id} 
                                  className={`kn-cell-status st-${status} ${isAnalyst ? 'kn-cell-readonly' : ''}`} 
                                  onClick={() => handleCycleStatus(u.id, act.id)}
                                >
                                  {status === 'checked' && <div className="mark-check"><Check size={18} /></div>}
                                  {status === 'x' && <div className="mark-x"><X size={18} /></div>}
                                </td>
                              );
                            })}
                            {!isAnalyst && <td className="kn-cell-pend">{pendCount}</td>}
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

      {/* Pop-up de Relato / Feedback do Analista */}
      {feedbackModal.open && feedbackModal.analyst && isManagementOrAdmin && createPortal(
        <div className="modal-overlay" onClick={() => setFeedbackModal({ open: false, analyst: null })}>
          <div className="modal-box kn-feedback-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2>Relato do Analista</h2>
                <span className="kn-feedback-subtitle">
                  Colaborador: <strong>{feedbackModal.analyst.name}</strong> • {feedbackModal.analyst.area || activeArea}
                </span>
              </div>
              <button 
                type="button" 
                className="btn-ghost" 
                style={{ padding: '4px 8px' }} 
                onClick={() => setFeedbackModal({ open: false, analyst: null })}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleFeedbackSubmit} className="kn-feedback-form">
              <div className="modal-body">
                <div className="kn-feedback-grid">
                  <div className="form-group">
                    <label>Data do Relato</label>
                    <input 
                      type="date" 
                      name="date" 
                      defaultValue={new Date().toLocaleDateString('en-CA')} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label>Status / Impacto</label>
                    <select name="impact" defaultValue="Positivo" required>
                      <option value="Positivo">🟢 Positivo</option>
                      <option value="Negativo">🔴 Negativo</option>
                      <option value="Sem Impacto">⚪ Sem Impacto</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '0.75rem' }}>
                  <label>Comentário / Observações</label>
                  <textarea 
                    name="comment" 
                    rows={3} 
                    placeholder="Descreva o alinhamento, desenvolvimento, conduta ou entrega observada..."
                    required
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '4px', display: 'block' }}>
                    * Este comentário é estritamente confidencial e visível apenas para a Gestão.
                  </small>
                </div>
              </div>

              <div className="modal-footer" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                <button 
                  type="button" 
                  className="btn-ghost" 
                  onClick={() => setFeedbackModal({ open: false, analyst: null })}
                >
                  Fechar
                </button>
                <button type="submit" className="btn-primary" disabled={feedbackSubmitting}>
                  {feedbackSubmitting ? 'Salvando...' : 'Adicionar Relato'}
                </button>
              </div>
            </form>

            <div className="kn-feedback-history">
              <h3 style={{ fontSize: '0.85rem', fontWeight: 800, margin: '1rem 0 0.5rem 0', color: 'var(--text-primary)' }}>
                Histórico de Relatos ({currentAnalystFeedbacks.length})
              </h3>
              
              {currentAnalystFeedbacks.length === 0 ? (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '1rem 0' }}>
                  Nenhum relato registrado para este analista até o momento.
                </p>
              ) : (
                <div className="kn-feedback-list">
                  {currentAnalystFeedbacks.map(item => (
                    <div key={item.id} className={`kn-feedback-card impact-${item.impact.toLowerCase().replace(/\s+/g, '-')}`}>
                      <div className="kn-fb-card-top">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className={`kn-fb-badge badge-${item.impact.toLowerCase().replace(/\s+/g, '-')}`}>
                            {item.impact === 'Positivo' && <Smile size={13} />}
                            {item.impact === 'Negativo' && <Frown size={13} />}
                            {item.impact === 'Sem Impacto' && <MinusCircle size={13} />}
                            {item.impact}
                          </span>
                          <span className="kn-fb-date">
                            <Calendar size={12} style={{ display: 'inline', marginRight: 4 }} />
                            {item.date ? item.date.split('-').reverse().join('/') : ''}
                          </span>
                        </div>
                        {onDeleteFeedback && (
                          <button 
                            type="button" 
                            className="btn-icon-danger"
                            title="Excluir relato"
                            onClick={() => onDeleteFeedback(item.id)}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                      <p className="kn-fb-comment">{item.comment}</p>
                      <div className="kn-fb-footer">
                        <span>Registrado por: <strong>{item.authorName}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  );
}
