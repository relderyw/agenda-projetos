import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Save, Building2, Users, Layers, ChevronRight, RefreshCw } from 'lucide-react';
import type { Organization, OrgSector, User } from '../types';
import { dbService } from '../services/db';

interface Props {
  currentUser: User;
  onSwitchOrg: (org: Organization) => void;
  currentOrg: Organization | null;
}

const COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444',
  '#06b6d4', '#f97316', '#ec4899', '#6366f1', '#14b8a6',
  '#84cc16', '#a855f7'
];

export default function SuperAdminTab({ currentUser, onSwitchOrg, currentOrg }: Props) {
  const [section, setSection] = useState<'orgs' | 'sectors' | 'users'>('orgs');

  // --- Organizations ---
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [orgModal, setOrgModal] = useState<{ open: boolean; editing: Organization | null }>({ open: false, editing: null });
  const [orgForm, setOrgForm] = useState({ name: '', slug: '' });
  const [deleteOrgConfirm, setDeleteOrgConfirm] = useState<string | null>(null);

  // --- Sectors ---
  const [selectedOrgForSectors, setSelectedOrgForSectors] = useState<Organization | null>(null);
  const [sectors, setSectors] = useState<OrgSector[]>([]);
  const [loadingSectors, setLoadingSectors] = useState(false);
  const [sectorModal, setSectorModal] = useState<{ open: boolean; editing: OrgSector | null }>({ open: false, editing: null });
  const [sectorForm, setSectorForm] = useState({ name: '', color: COLORS[0] });
  const [deleteSectorConfirm, setDeleteSectorConfirm] = useState<string | null>(null);

  // --- Users ---
  const [selectedOrgForUsers, setSelectedOrgForUsers] = useState<Organization | null>(null);
  const [orgUsers, setOrgUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => { loadOrgs(); }, []);

  const loadOrgs = async () => {
    setLoadingOrgs(true);
    const data = await dbService.getOrganizations();
    setOrgs(data);
    setLoadingOrgs(false);
  };

  const loadSectors = async (org: Organization) => {
    setLoadingSectors(true);
    const data = await dbService.getOrgSectors(org.id);
    setSectors(data);
    setLoadingSectors(false);
  };

  const loadOrgUsers = async (org: Organization) => {
    setLoadingUsers(true);
    const data = await dbService.getUsers(org.id);
    setOrgUsers(data);
    setLoadingUsers(false);
  };

  const genSlug = (name: string) =>
    name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  // Org handlers
  const openNewOrg = () => { setOrgForm({ name: '', slug: '' }); setOrgModal({ open: true, editing: null }); };
  const openEditOrg = (org: Organization) => { setOrgForm({ name: org.name, slug: org.slug }); setOrgModal({ open: true, editing: org }); };
  const saveOrg = async () => {
    if (!orgForm.name.trim() || !orgForm.slug.trim()) return;
    const payload = orgModal.editing
      ? { ...orgModal.editing, name: orgForm.name, slug: orgForm.slug }
      : { name: orgForm.name, slug: orgForm.slug };
    await dbService.saveOrganization(payload);
    setOrgModal({ open: false, editing: null });
    loadOrgs();
  };
  const deleteOrg = async (id: string) => {
    await dbService.deleteOrganization(id);
    setDeleteOrgConfirm(null);
    loadOrgs();
  };

  // Sector handlers
  const selectOrgForSectors = (org: Organization) => {
    setSelectedOrgForSectors(org);
    loadSectors(org);
    setSection('sectors');
  };
  const openNewSector = () => { setSectorForm({ name: '', color: COLORS[0] }); setSectorModal({ open: true, editing: null }); };
  const openEditSector = (s: OrgSector) => { setSectorForm({ name: s.name, color: s.color }); setSectorModal({ open: true, editing: s }); };
  const saveSector = async () => {
    if (!sectorForm.name.trim() || !selectedOrgForSectors) return;
    const payload = sectorModal.editing
      ? { ...sectorModal.editing, name: sectorForm.name, color: sectorForm.color }
      : { name: sectorForm.name, color: sectorForm.color, organization_id: selectedOrgForSectors.id };
    await dbService.saveOrgSector(payload);
    setSectorModal({ open: false, editing: null });
    loadSectors(selectedOrgForSectors);
  };
  const deleteSector = async (id: string) => {
    await dbService.deleteOrgSector(id);
    setDeleteSectorConfirm(null);
    if (selectedOrgForSectors) loadSectors(selectedOrgForSectors);
  };

  // User handlers
  const selectOrgForUsers = (org: Organization) => {
    setSelectedOrgForUsers(org);
    loadOrgUsers(org);
    setSection('users');
  };

  return (
    <div className="sa-container">
      <div className="sa-header">
        <div>
          <h1 className="sa-title">Painel Super Admin</h1>
          <p className="sa-subtitle">Gerencie todas as organizações do sistema</p>
        </div>
        <div className="sa-badge">🔐 {currentUser.name}</div>
      </div>

      {currentOrg && (
        <div className="sa-current-org-bar">
          <Building2 size={14} />
          <span>Visualizando: <strong>{currentOrg.name}</strong></span>
          <span className="sa-current-org-hint">— Troque a organização na sidebar</span>
        </div>
      )}

      <div className="sa-tabs">
        <button className={`sa-tab ${section === 'orgs' ? 'active' : ''}`} onClick={() => setSection('orgs')}>
          <Building2 size={16} /> Organizações
        </button>
        <button
          className={`sa-tab ${section === 'sectors' ? 'active' : ''}`}
          onClick={() => { if (selectedOrgForSectors) setSection('sectors'); }}
          disabled={!selectedOrgForSectors}
        >
          <Layers size={16} /> Setores {selectedOrgForSectors && <span className="sa-tab-org">({selectedOrgForSectors.name})</span>}
        </button>
        <button
          className={`sa-tab ${section === 'users' ? 'active' : ''}`}
          onClick={() => { if (selectedOrgForUsers) setSection('users'); }}
          disabled={!selectedOrgForUsers}
        >
          <Users size={16} /> Usuários {selectedOrgForUsers && <span className="sa-tab-org">({selectedOrgForUsers.name})</span>}
        </button>
      </div>

      {/* ── ORGANIZATIONS ── */}
      {section === 'orgs' && (
        <div className="sa-section">
          <div className="sa-section-header">
            <h2 className="sa-section-title">Organizações ({orgs.length})</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="sa-btn-refresh" onClick={loadOrgs}><RefreshCw size={14} /></button>
              <button className="sa-btn-add" onClick={openNewOrg}><Plus size={16} /> Nova Organização</button>
            </div>
          </div>

          {loadingOrgs ? (
            <div className="sa-loading"><RefreshCw size={20} className="spinner" /> Carregando...</div>
          ) : (
            <div className="sa-org-grid">
              {orgs.map(org => (
                <div key={org.id} className={`sa-org-card ${currentOrg?.id === org.id ? 'sa-org-card--active' : ''}`}>
                  <div className="sa-org-card-header">
                    <div className="sa-org-icon"><Building2 size={20} /></div>
                    <div className="sa-org-info">
                      <span className="sa-org-name">{org.name}</span>
                      <span className="sa-org-slug">/{org.slug}</span>
                    </div>
                    {currentOrg?.id === org.id && <span className="sa-org-active-badge">Atual</span>}
                  </div>
                  <div className="sa-org-actions">
                    <button className="sa-action-btn" onClick={() => onSwitchOrg(org)}><ChevronRight size={14} /> Visualizar</button>
                    <button className="sa-action-btn" onClick={() => selectOrgForSectors(org)}><Layers size={14} /> Setores</button>
                    <button className="sa-action-btn" onClick={() => selectOrgForUsers(org)}><Users size={14} /> Usuários</button>
                    <button className="sa-action-btn edit" onClick={() => openEditOrg(org)}><Edit2 size={14} /></button>
                    <button className="sa-action-btn danger" onClick={() => setDeleteOrgConfirm(org.id)}><Trash2 size={14} /></button>
                  </div>
                  {deleteOrgConfirm === org.id && (
                    <div className="sa-delete-confirm">
                      <span>⚠️ Excluir <strong>{org.name}</strong>? Isso remove todos os dados associados.</span>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <button className="sa-btn-danger-sm" onClick={() => deleteOrg(org.id)}>Excluir</button>
                        <button className="sa-btn-cancel-sm" onClick={() => setDeleteOrgConfirm(null)}>Cancelar</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {orgs.length === 0 && (
                <div className="sa-empty">
                  <Building2 size={40} />
                  <p>Nenhuma organização cadastrada ainda.</p>
                  <button className="sa-btn-add" onClick={openNewOrg}><Plus size={16} /> Criar primeira organização</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── SECTORS ── */}
      {section === 'sectors' && selectedOrgForSectors && (
        <div className="sa-section">
          <div className="sa-section-header">
            <div>
              <button className="sa-back-btn" onClick={() => setSection('orgs')}>← Voltar</button>
              <h2 className="sa-section-title">Setores — <span style={{ color: 'var(--accent)' }}>{selectedOrgForSectors.name}</span></h2>
            </div>
            <button className="sa-btn-add" onClick={openNewSector}><Plus size={16} /> Novo Setor</button>
          </div>
          {loadingSectors ? (
            <div className="sa-loading"><RefreshCw size={20} className="spinner" /> Carregando...</div>
          ) : (
            <div className="sa-sector-list">
              {sectors.map(s => (
                <div key={s.id} className="sa-sector-item">
                  <div className="sa-sector-dot" style={{ background: s.color }} />
                  <span className="sa-sector-name">{s.name}</span>
                  <div className="sa-sector-actions">
                    <button className="sa-icon-btn" onClick={() => openEditSector(s)}><Edit2 size={14} /></button>
                    {deleteSectorConfirm === s.id ? (
                      <>
                        <button className="sa-btn-danger-sm" onClick={() => deleteSector(s.id)}>Excluir</button>
                        <button className="sa-btn-cancel-sm" onClick={() => setDeleteSectorConfirm(null)}>Cancelar</button>
                      </>
                    ) : (
                      <button className="sa-icon-btn danger" onClick={() => setDeleteSectorConfirm(s.id)}><Trash2 size={14} /></button>
                    )}
                  </div>
                </div>
              ))}
              {sectors.length === 0 && (
                <div className="sa-empty"><Layers size={36} /><p>Nenhum setor cadastrado.</p></div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── USERS ── */}
      {section === 'users' && selectedOrgForUsers && (
        <div className="sa-section">
          <div className="sa-section-header">
            <div>
              <button className="sa-back-btn" onClick={() => setSection('orgs')}>← Voltar</button>
              <h2 className="sa-section-title">Usuários — <span style={{ color: 'var(--accent)' }}>{selectedOrgForUsers.name}</span></h2>
            </div>
            <button className="sa-btn-refresh" onClick={() => loadOrgUsers(selectedOrgForUsers)}><RefreshCw size={14} /></button>
          </div>
          {loadingUsers ? (
            <div className="sa-loading"><RefreshCw size={20} className="spinner" /> Carregando...</div>
          ) : (
            <div className="sa-user-list">
              {orgUsers.map(u => (
                <div key={u.id} className="sa-user-item">
                  <div className="sa-user-avatar" style={{ background: u.color || '#6366f1' }}>{u.name.charAt(0).toUpperCase()}</div>
                  <div className="sa-user-info">
                    <span className="sa-user-name">{u.name}</span>
                    <span className="sa-user-role">{u.role}{u.area ? ` · ${u.area}` : ''}</span>
                    <span className="sa-user-email">{u.email}</span>
                  </div>
                  <span className={`sa-user-badge sa-role-${(u.role || '').toLowerCase().replace(/\s/g, '-')}`}>{u.role}</span>
                </div>
              ))}
              {orgUsers.length === 0 && (
                <div className="sa-empty">
                  <Users size={36} />
                  <p>Nenhum usuário nesta organização.<br />Visualize esta org e crie usuários na aba Cadastros.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── ORG MODAL ── */}
      {orgModal.open && (
        <div className="modal-overlay" onClick={() => setOrgModal({ open: false, editing: null })}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3>{orgModal.editing ? 'Editar Organização' : 'Nova Organização'}</h3>
              <button className="modal-close" onClick={() => setOrgModal({ open: false, editing: null })}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Nome da Organização *</label>
                <input
                  className="form-input"
                  value={orgForm.name}
                  onChange={e => setOrgForm(prev => ({ ...prev, name: e.target.value, slug: prev.slug || genSlug(e.target.value) }))}
                  placeholder="Ex: Compras / RH / Sesmt"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Slug (identificador único)</label>
                <input
                  className="form-input"
                  value={orgForm.slug}
                  onChange={e => setOrgForm(prev => ({ ...prev, slug: genSlug(e.target.value) }))}
                  placeholder="compras-rh-sesmt"
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Apenas letras minúsculas, números e hífens</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setOrgModal({ open: false, editing: null })}>Cancelar</button>
              <button className="btn-primary" onClick={saveOrg} disabled={!orgForm.name.trim() || !orgForm.slug.trim()}>
                <Save size={14} /> Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SECTOR MODAL ── */}
      {sectorModal.open && (
        <div className="modal-overlay" onClick={() => setSectorModal({ open: false, editing: null })}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px' }}>
            <div className="modal-header">
              <h3>{sectorModal.editing ? 'Editar Setor' : 'Novo Setor'}</h3>
              <button className="modal-close" onClick={() => setSectorModal({ open: false, editing: null })}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Nome do Setor *</label>
                <input
                  className="form-input"
                  value={sectorForm.name}
                  onChange={e => setSectorForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Compras, RH, Sesmt..."
                />
              </div>
              <div className="form-group">
                <label className="form-label">Cor</label>
                <div className="color-grid">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      className={`color-dot ${sectorForm.color === c ? 'selected' : ''}`}
                      style={{ background: c }}
                      onClick={() => setSectorForm(prev => ({ ...prev, color: c }))}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setSectorModal({ open: false, editing: null })}>Cancelar</button>
              <button className="btn-primary" onClick={saveSector} disabled={!sectorForm.name.trim()}>
                <Save size={14} /> Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
