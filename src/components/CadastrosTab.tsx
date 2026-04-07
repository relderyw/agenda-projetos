import { useState } from 'react';
import { Plus, Edit2, Trash2, X, Save, Tag, Users, ChevronDown, CloudUpload, RefreshCw, Calendar, MinusCircle } from 'lucide-react';
import type { Theme, User, UserPermissions, Activity, HenkatenEvent, Holiday } from '../types';
import { dbService } from '../services/db';
import { defaultActivities, defaultThemes, defaultUsers, defaultHenkatens } from '../data';

interface Props {
  currentUser: User | null;
  themes: Theme[];
  users: User[];
  holidays: Holiday[];
  onAddTheme: (t: Theme) => void;
  onUpdateTheme: (t: Theme) => void;
  onDeleteTheme: (id: string) => void;
  onAddUser: (u: User) => void;
  onUpdateUser: (u: User) => void;
  onDeleteUser: (id: string) => void;
  onAddHoliday: (h: Holiday) => void;
  onDeleteHoliday: (date: string) => void;
}

const COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444',
  '#06b6d4', '#f97316', '#ec4899', '#6366f1', '#14b8a6',
  '#84cc16', '#a855f7'
];

const ROLES = ['Analista', 'Coordenador(a)', 'Operacional', 'Gerente', 'Supervisor(a)', 'Técnico(a)'];

const MOCK_PERMS: UserPermissions = {
  atividades:      { view: true, edit: false, delete: false },
  henkatens:       { view: true, edit: false, delete: false },
  cadastros:       { view: false, edit: false, delete: false },
  usuarios:        { view: false, edit: false, delete: false },
  conhecimentoTP:  { view: true, edit: false, delete: false },
  conhecimentoProj: { view: true, edit: false, delete: false }
};

const MODULE_LABELS: Record<keyof UserPermissions, string> = {
  atividades: 'Atividades',
  henkatens: 'Henkatens',
  cadastros: 'Cadastros',
  usuarios: 'Usuários',
  conhecimentoTP: 'Conhecimento T&P',
  conhecimentoProj: 'Conhecimento Projetos'
};

export default function CadastrosTab({
  currentUser, themes, users, holidays,
  onAddTheme, onUpdateTheme, onDeleteTheme,
  onAddUser, onUpdateUser, onDeleteUser,
  onAddHoliday, onDeleteHoliday
}: Props) {
  const canViewThemes = currentUser?.permissions?.cadastros.view ?? false;
  const canEditThemes = currentUser?.permissions?.cadastros.edit ?? false;
  const canDeleteThemes = currentUser?.permissions?.cadastros.delete ?? false;
  
  const canViewUsers = currentUser?.permissions?.usuarios.view ?? false;
  const canEditUsers = currentUser?.permissions?.usuarios.edit ?? false;
  const canDeleteUsers = currentUser?.permissions?.usuarios.delete ?? false;

  const [section, setSection] = useState<'temas' | 'usuarios' | 'holidays'>(() => canViewThemes ? 'temas' : 'usuarios');

  // Theme modal
  const [tModal, setTModal] = useState<{ open: boolean; editing: Theme | null }>({ open: false, editing: null });
  const [tForm, setTForm] = useState<Omit<Theme, 'id'>>({ name: '', color: COLORS[0] });

  // User modal
  const [uModal, setUModal] = useState<{ open: boolean; editing: User | null }>({ open: false, editing: null });
  const [uForm, setUForm] = useState<Omit<User, 'id'>>({
    name: '', role: 'Analista', area: 'Projetos', username: '', password: '', email: '', color: COLORS[0],
    permissions: JSON.parse(JSON.stringify(MOCK_PERMS))
  });

  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'tema' | 'usuario' | 'holiday'; id: string } | null>(null);

  // Holiday modal
  const [hModal, setHModal] = useState(false);
  const [hForm, setHForm] = useState<Holiday>({ date: '', type: 'Feriado', description: '' });

  // ── Theme handlers ──────────────────────────────────────
  const openNewTheme = () => { setTForm({ name: '', color: COLORS[0] }); setTModal({ open: true, editing: null }); };
  const openEditTheme = (t: Theme) => { setTForm({ name: t.name, color: t.color }); setTModal({ open: true, editing: t }); };
  const closeTheme = () => setTModal({ open: false, editing: null });
  const saveTheme = () => {
    if (!tForm.name.trim()) return;
    if (tModal.editing) onUpdateTheme({ ...tForm, id: tModal.editing.id });
    else onAddTheme({ ...tForm, id: crypto.randomUUID() });
    closeTheme();
  };

  // ── User handlers ───────────────────────────────────────
  const openNewUser = () => {
    setUForm({ name: '', role: 'Analista', area: 'Projetos', username: '', password: '', email: '', color: COLORS[0], permissions: JSON.parse(JSON.stringify(MOCK_PERMS)) });
    setUModal({ open: true, editing: null });
  };
  const openEditUser = (u: User) => {
    setUForm({
      name: u.name, role: u.role, area: u.area || 'Projetos', username: u.username || '', password: u.password || '', email: u.email || '', color: u.color,
      permissions: u.permissions ? JSON.parse(JSON.stringify(u.permissions)) : JSON.parse(JSON.stringify(MOCK_PERMS))
    });
    setUModal({ open: true, editing: u });
  };
  const closeUser = () => setUModal({ open: false, editing: null });
  const saveUser = () => {
    if (!uForm.name.trim() || !uForm.username?.trim() || !uForm.password?.trim()) {
      alert("Nome, Usuário e Senha são obrigatórios.");
      return;
    }
    if (uModal.editing) onUpdateUser({ ...uForm, id: uModal.editing.id } as User);
    else onAddUser({ ...uForm, id: crypto.randomUUID() } as User);
    closeUser();
  };

  const setPerm = (module: keyof UserPermissions, action: 'view' | 'edit' | 'delete', val: boolean) => {
    setUForm(prev => {
      if (!prev.permissions) return prev;
      return {
        ...prev,
        permissions: { ...prev.permissions, [module]: { ...prev.permissions[module], [action]: val } }
      }
    });
  };

  const [syncing, setSyncing] = useState(false);
  const handleCloudSync = async () => {
    if (!confirm("Deseja subir TODOS os dados atuais (atividades, temas e usuários padrão) para a nuvem? Isso preencherá o banco de dados do Supabase. Certifique-se de que rodou o SQL no painel primeiro.")) return;
    
    setSyncing(true);
    try {
      // Sync Themes
      for (const t of themes.length > 0 ? themes : defaultThemes) {
        await dbService.saveTheme(t);
      }
      // Sync Users
      for (const u of users.length > 0 ? users : defaultUsers) {
        await dbService.saveUser(u);
      }
      // Sync Activities
      for (const a of (activitiesForSync.length > 0 ? activitiesForSync : defaultActivities)) {
        await dbService.saveActivity(a);
      }
      // Sync Henkatens
      for (const h of (henkatensForSync.length > 0 ? henkatensForSync : defaultHenkatens)) {
        await dbService.saveHenkaten(h);
      }
      
      alert("Sincronização concluída com sucesso! Recarregue a página para começar a usar a Nuvem.");
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert("Erro na sincronização. Verifique se as chaves no arquivo .env.local estão corretas.");
    } finally {
      setSyncing(false);
    }
  };

  // Referência para exportação e sincronização
  const activitiesForSync = defaultActivities; 
  const henkatensForSync = defaultHenkatens;

  const handleDelete = () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'tema') onDeleteTheme(deleteConfirm.id);
    else if (deleteConfirm.type === 'usuario') onDeleteUser(deleteConfirm.id);
    else if (deleteConfirm.type === 'holiday') onDeleteHoliday(deleteConfirm.id);
    setDeleteConfirm(null);
  };

  const saveHoliday = () => {
    if (!hForm.date) return;
    onAddHoliday(hForm);
    setHModal(false);
    setHForm({ date: '', type: 'Feriado', description: '' });
  };

  return (
    <div className="tab-content">
      <div className="tab-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {currentUser?.role === 'Administrador' && (
            <button 
              className="btn-ghost" 
              onClick={handleCloudSync} 
              disabled={syncing}
              style={{ color: '#10b981', borderColor: '#10b98133' }}
            >
              {syncing ? <RefreshCw size={16} className="spinner" /> : <CloudUpload size={16} />}
              {syncing ? 'Sincronizando...' : 'Sincronizar com Nuvem'}
            </button>
          )}
          <div>
            <h1 className="tab-title">Cadastros</h1>
            <p className="tab-subtitle">Gerencie temas e usuários do sistema</p>
          </div>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="section-tabs">
        {canViewThemes && (
          <button className={`sec-tab ${section === 'temas' ? 'sec-active' : ''}`} onClick={() => setSection('temas')}>
            <Tag size={16} /> Temas
          </button>
        )}
        {canViewUsers && (
          <button className={`sec-tab ${section === 'usuarios' ? 'sec-active' : ''}`} onClick={() => setSection('usuarios')}>
            <Users size={16} /> Usuários
          </button>
        )}
        {currentUser?.role === 'Administrador' && (
          <button className={`sec-tab ${section === 'holidays' ? 'sec-active' : ''}`} onClick={() => setSection('holidays')}>
            <Calendar size={16} /> Dias sem Expediente
          </button>
        )}
      </div>

      {/* ── TEMAS ── */}
      {section === 'temas' && (
        <div>
          <div className="cad-section-header">
            <span className="cad-count">{themes.length} temas cadastrados</span>
            <button className="btn-primary" onClick={openNewTheme}><Plus size={16} /> Novo Tema</button>
          </div>
          <div className="cad-grid">
            {themes.map(t => (
              <div key={t.id} className="cad-card">
                <div className="cad-card-left">
                  <div className="cad-color-dot" style={{ background: t.color }} />
                  <div className="cad-card-info">
                    <span className="cad-name">{t.name}</span>
                    <span className="cad-meta" style={{ color: t.color }}>{t.color}</span>
                  </div>
                </div>
                <div className="cad-card-actions">
                  {canEditThemes && <button className="action-btn edit" onClick={() => openEditTheme(t)}><Edit2 size={14} /></button>}
                  {canDeleteThemes && <button className="action-btn del" onClick={() => setDeleteConfirm({ type: 'tema', id: t.id })}><Trash2 size={14} /></button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── USUÁRIOS ── */}
      {section === 'usuarios' && (
        <div>
          <div className="cad-section-header">
            <span className="cad-count">{users.length} usuários cadastrados</span>
            <button className="btn-primary" onClick={openNewUser}><Plus size={16} /> Novo Usuário</button>
          </div>
          <div className="cad-grid">
            {users.map(u => (
              <div key={u.id} className="cad-card">
                <div className="cad-card-left">
                  <span className="user-avatar lg" style={{ background: u.color }}>{u.name[0]}</span>
                  <div className="cad-card-info">
                    <span className="cad-name">{u.name}</span>
                    <span className="cad-meta">{u.role} {u.area ? `· ${u.area}` : ''}</span>
                    {u.email && <span className="cad-email">{u.email}</span>}
                  </div>
                </div>
                <div className="cad-card-actions">
                  {canEditUsers && <button className="action-btn edit" onClick={() => openEditUser(u)}><Edit2 size={14} /></button>}
                  {canDeleteUsers && <button className="action-btn del" onClick={() => setDeleteConfirm({ type: 'usuario', id: u.id })}><Trash2 size={14} /></button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── FERIADOS ── */}
      {section === 'holidays' && (
        <div>
          <div className="cad-section-header">
            <span className="cad-count">{holidays.length} datas cadastradas</span>
            <button className="btn-primary" onClick={() => setHModal(true)}><Plus size={16} /> Nova Data</button>
          </div>
          <div className="cad-grid">
            {holidays.map(h => (
              <div key={h.date} className="cad-card">
                <div className="cad-card-left">
                  <div className={`cad-holiday-icon ${h.type === 'Feriado' ? 'festive' : 'off'}`}>
                    <Calendar size={18} />
                  </div>
                  <div className="cad-card-info">
                    <span className="cad-name">{new Date(h.date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                    <span className="cad-meta">{h.type} {h.description ? `· ${h.description}` : ''}</span>
                  </div>
                </div>
                <div className="cad-card-actions">
                  <button className="action-btn del" onClick={() => setDeleteConfirm({ type: 'holiday', id: h.date })}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
            {holidays.length === 0 && (
              <div className="empty-state">
                <MinusCircle size={32} />
                <p>Nenhuma data especial cadastrada.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Holiday */}
      {hModal && (
        <div className="modal-overlay" onClick={() => setHModal(false)}>
          <div className="modal-box sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Novo Dia sem Expediente</h2>
              <button className="modal-close" onClick={() => setHModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group full">
                <label>Data *</label>
                <input type="date" value={hForm.date}
                  onChange={e => setHForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="form-group full">
                <label>Tipo</label>
                <div className="select-wrap full-w">
                  <select value={hForm.type} onChange={e => setHForm(f => ({ ...f, type: e.target.value as any }))}>
                    <option value="Feriado">Feriado</option>
                    <option value="S/ Expediente">Sem Expediente / Emenda</option>
                  </select>
                  <ChevronDown size={14} className="sel-icon" />
                </div>
              </div>
              <div className="form-group full">
                <label>Descrição (Opcional)</label>
                <input type="text" placeholder="ex: Sexta-feira Santa" value={hForm.description || ''}
                  onChange={e => setHForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setHModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={saveHoliday} disabled={!hForm.date}><Save size={16} /> Salvar</button>
            </div>
          </div>
        </div>
      )}
      {tModal.open && (
        <div className="modal-overlay" onClick={closeTheme}>
          <div className="modal-box sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{tModal.editing ? 'Editar Tema' : 'Novo Tema'}</h2>
              <button className="modal-close" onClick={closeTheme}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group full">
                <label>Nome do Tema *</label>
                <input type="text" placeholder="ex: O/S 103KI" value={tForm.name}
                  onChange={e => setTForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-group full">
                <label>Cor</label>
                <div className="color-picker">
                  {COLORS.map(c => (
                    <button key={c} className={`color-swatch ${tForm.color === c ? 'selected' : ''}`}
                      style={{ background: c }} onClick={() => setTForm(f => ({ ...f, color: c }))} />
                  ))}
                </div>
                <div className="color-preview" style={{ background: tForm.color }}>
                  <span>{tForm.name || 'Pré-visualização'}</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={closeTheme}>Cancelar</button>
              <button className="btn-primary" onClick={saveTheme}><Save size={16} /> Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Usuário */}
      {uModal.open && (
        <div className="modal-overlay" onClick={closeUser}>
          <div className="modal-box sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{uModal.editing ? 'Editar Usuário' : 'Novo Usuário'}</h2>
              <button className="modal-close" onClick={closeUser}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group full">
                  <label>Nome Completo *</label>
                  <input type="text" placeholder="Nome do responsável" value={uForm.name}
                    onChange={e => setUForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Usuário (Login) *</label>
                  <input type="text" placeholder="ex: hudson_silva" value={uForm.username}
                    onChange={e => setUForm(f => ({ ...f, username: e.target.value.toLowerCase() }))} />
                </div>
                <div className="form-group">
                  <label>Senha Provisória *</label>
                  <input type="text" placeholder="ex: 123456" value={uForm.password}
                    onChange={e => setUForm(f => ({ ...f, password: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Função Hierárquica</label>
                  <div className="select-wrap full-w">
                    <select value={uForm.role} onChange={e => setUForm(f => ({ ...f, role: e.target.value }))}>
                      <option value="Administrador">Administrador</option>
                      <option value="Gestão">Gestão</option>
                      <option value="Analista">Analista</option>
                    </select>
                    <ChevronDown size={14} className="sel-icon" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Área Atuação</label>
                  <div className="select-wrap full-w">
                    <select value={uForm.area} onChange={e => setUForm(f => ({ ...f, area: e.target.value as any }))}>
                      <option value="T&P">T&P</option>
                      <option value="Projetos">Projetos</option>
                    </select>
                    <ChevronDown size={14} className="sel-icon" />
                  </div>
                </div>
                <div className="form-group">
                  <label>E-mail Corporativo</label>
                  <input type="email" placeholder="email@empresa.com" value={uForm.email}
                    onChange={e => setUForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="form-group full">
                  <label>Cor de identificação</label>
                  <div className="color-picker">
                    {COLORS.map(c => (
                      <button key={c} className={`color-swatch ${uForm.color === c ? 'selected' : ''}`}
                        style={{ background: c }} onClick={() => setUForm(f => ({ ...f, color: c }))} />
                    ))}
                  </div>
                </div>
                {/* Permissions matrix */}
                <div className="form-group full permissions-section">
                  <label style={{ 
                    borderBottom: '1px solid var(--border-color)', 
                    paddingBottom: '10px', 
                    marginBottom: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    color: 'var(--text-primary)'
                  }}>
                    <span>Níveis de Permissão do App</span>
                  </label>

                  {/* Header Row */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 60px 60px 60px', 
                    gap: '1.5rem', 
                    padding: '8px 12px',
                    borderBottom: '1px solid var(--border-color)',
                    marginBottom: '4px'
                  }}>
                    <span style={{ textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Módulo</span>
                    <span style={{ display: 'flex', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)' }}>VER</span>
                    <span style={{ display: 'flex', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)' }}>EDIT</span>
                    <span style={{ display: 'flex', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)' }}>DEL</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {(Object.keys(MOCK_PERMS) as Array<keyof UserPermissions>).map(mod => (
                      <div key={mod} className="permission-row" style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '1fr 60px 60px 60px', 
                        gap: '1.5rem', 
                        alignItems: 'center', 
                        background: 'rgba(255,255,255,0.02)', 
                        padding: '8px 12px', 
                        borderRadius: '6px'
                      }}>
                        <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{MODULE_LABELS[mod]}</span>
                        
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <input type="checkbox" className="custom-checkbox" checked={uForm.permissions?.[mod]?.view} onChange={e => setPerm(mod, 'view', e.target.checked)} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <input type="checkbox" className="custom-checkbox" checked={uForm.permissions?.[mod]?.edit} onChange={e => setPerm(mod, 'edit', e.target.checked)} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <input type="checkbox" className="custom-checkbox" checked={uForm.permissions?.[mod]?.delete} onChange={e => setPerm(mod, 'delete', e.target.checked)} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={closeUser}>Cancelar</button>
              <button className="btn-primary" onClick={saveUser}><Save size={16} /> Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="confirm-box" onClick={e => e.stopPropagation()}>
            <Trash2 size={36} style={{ color: '#ef4444', marginBottom: '1rem' }} />
            <h3>Excluir {deleteConfirm.type === 'tema' ? 'tema' : 'usuário'}?</h3>
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '1.5rem' }}>
              Esta ação não pode ser desfeita.
            </p>
            <div className="confirm-actions">
              <button className="btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancelar</button>
              <button className="btn-danger" onClick={handleDelete}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
