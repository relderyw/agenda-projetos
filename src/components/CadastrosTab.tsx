import { useState } from 'react';
import { Plus, Edit2, Trash2, X, Save, Tag, Users, ChevronDown, CloudUpload, RefreshCw } from 'lucide-react';
import type { Theme, User, UserPermissions, Activity, HenkatenEvent } from '../types';
import { dbService } from '../services/db';
import { defaultActivities, defaultThemes, defaultUsers, defaultHenkatens } from '../data';

interface Props {
  currentUser: User | null;
  themes: Theme[];
  users: User[];
  onAddTheme: (t: Theme) => void;
  onUpdateTheme: (t: Theme) => void;
  onDeleteTheme: (id: string) => void;
  onAddUser: (u: User) => void;
  onUpdateUser: (u: User) => void;
  onDeleteUser: (id: string) => void;
}

const COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444',
  '#06b6d4', '#f97316', '#ec4899', '#6366f1', '#14b8a6',
  '#84cc16', '#a855f7'
];

const ROLES = ['Analista', 'Coordenador(a)', 'Operacional', 'Gerente', 'Supervisor(a)', 'Técnico(a)'];

const MOCK_PERMS: UserPermissions = {
  atividades: { view: true, edit: false, delete: false },
  henkatens:  { view: true, edit: false, delete: false },
  cadastros:  { view: false, edit: false, delete: false },
  usuarios:   { view: false, edit: false, delete: false }
};

export default function CadastrosTab({
  currentUser, themes, users,
  onAddTheme, onUpdateTheme, onDeleteTheme,
  onAddUser, onUpdateUser, onDeleteUser
}: Props) {
  const canViewThemes = currentUser?.permissions?.cadastros.view ?? false;
  const canEditThemes = currentUser?.permissions?.cadastros.edit ?? false;
  const canDeleteThemes = currentUser?.permissions?.cadastros.delete ?? false;
  
  const canViewUsers = currentUser?.permissions?.usuarios.view ?? false;
  const canEditUsers = currentUser?.permissions?.usuarios.edit ?? false;
  const canDeleteUsers = currentUser?.permissions?.usuarios.delete ?? false;

  const [section, setSection] = useState<'temas' | 'usuarios'>(() => canViewThemes ? 'temas' : 'usuarios');

  // Theme modal
  const [tModal, setTModal] = useState<{ open: boolean; editing: Theme | null }>({ open: false, editing: null });
  const [tForm, setTForm] = useState<Omit<Theme, 'id'>>({ name: '', color: COLORS[0] });

  // User modal
  const [uModal, setUModal] = useState<{ open: boolean; editing: User | null }>({ open: false, editing: null });
  const [uForm, setUForm] = useState<Omit<User, 'id'>>({
    name: '', role: 'Analista', area: 'Projetos', username: '', password: '', email: '', color: COLORS[0],
    permissions: JSON.parse(JSON.stringify(MOCK_PERMS))
  });

  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'tema' | 'usuario'; id: string } | null>(null);

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
    else onDeleteUser(deleteConfirm.id);
    setDeleteConfirm(null);
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

      {/* Modal Tema */}
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
                  <label>Nome de Usuário (Para Login) *</label>
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
                <div className="form-group full">
                  <label style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '8px' }}>
                    Níveis de Permissão do App
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(['atividades', 'henkatens', 'cadastros', 'usuarios'] as const).map(mod => (
                      <div key={mod} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 1fr', gap: '1rem', alignItems: 'center', background: 'var(--bg-card)', padding: '8px', borderRadius: '4px' }}>
                        <span style={{ textTransform: 'capitalize', fontWeight: 600, fontSize: '0.85rem' }}>{mod}</span>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
                          <input type="checkbox" checked={uForm.permissions?.[mod].view} onChange={e => setPerm(mod, 'view', e.target.checked)} /> Visualizar
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
                          <input type="checkbox" checked={uForm.permissions?.[mod].edit} onChange={e => setPerm(mod, 'edit', e.target.checked)} /> Editar
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
                          <input type="checkbox" checked={uForm.permissions?.[mod].delete} onChange={e => setPerm(mod, 'delete', e.target.checked)} /> Excluir
                        </label>
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
