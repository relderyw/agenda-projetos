import { useState, useEffect, useCallback } from 'react'
import { LayoutDashboard, ListTodo, BookOpen, ChevronRight, Sun, Moon, Kanban, Calendar, LogOut, RefreshCw, Menu, X as IconX } from 'lucide-react'
import { defaultActivities, defaultThemes, defaultUsers, defaultHenkatens } from './data'
import type { Activity, Theme, User, Tab, HenkatenEvent } from './types'
import AtividadesTab from './components/AtividadesTab'
import DashboardTab from './components/DashboardTab'
import CadastrosTab from './components/CadastrosTab'
import KanbanTab from './components/KanbanTab'
import HenkatensTab from './components/HenkatensTab'
import Login from './components/Login'
import { dbService } from './services/db'
import './App.css'

type ThemeMode = 'dark' | 'light'

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('currentUser')
    return saved ? JSON.parse(saved) : null
  })

  const [activeTab, setActiveTab] = useState<Tab>('kanban')
  const [activities, setActivities] = useState<Activity[]>([])
  const [themes, setThemes] = useState<Theme[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [henkatens, setHenkatens] = useState<HenkatenEvent[]>([])
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    return (localStorage.getItem('theme') as ThemeMode) || 'light'
  });

  // Apply Auth Persist
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('currentUser', JSON.stringify(currentUser))
    } else {
      localStorage.removeItem('currentUser')
    }
  }, [currentUser])

  // Apply theme to <html> element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode)
    localStorage.setItem('theme', themeMode)
  }, [themeMode])

  const toggleTheme = () => setThemeMode(prev => prev === 'dark' ? 'light' : 'dark')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [a, t, u, h] = await Promise.all([
        dbService.getActivities(),
        dbService.getThemes(),
        dbService.getUsers(),
        dbService.getHenkatens()
      ])
      setActivities(a)
      setThemes(t)
      setUsers(u)
      setHenkatens(h)
    } finally {
      setLoading(false)
    }
  }, [])


  useEffect(() => {
    loadData()
  }, [loadData])

  // ── Activities CRUD ──────────────────────────────────────
  const addActivity = async (a: Activity) => {
    setActivities(prev => [a, ...prev])
    await dbService.saveActivity(a)
  }
  const updateActivity = async (a: Activity) => {
    setActivities(prev => prev.map(p => p.id === a.id ? a : p))
    await dbService.saveActivity(a)
  }
  const deleteActivity = async (id: string) => {
    setActivities(prev => prev.filter(p => p.id !== id))
    await dbService.deleteActivity(id)
  }

  // ── Themes CRUD ──────────────────────────────────────────
  const addTheme = async (t: Theme) => {
    setThemes(prev => [...prev, t])
    await dbService.saveTheme(t)
  }
  const updateTheme = async (t: Theme) => {
    setThemes(prev => prev.map(p => p.id === t.id ? t : p))
    await dbService.saveTheme(t)
  }
  const deleteTheme = async (id: string) => {
    setThemes(prev => prev.filter(p => p.id !== id))
    await dbService.deleteTheme(id)
  }

  // ── Users CRUD ───────────────────────────────────────────
  const addUser = async (u: User) => {
    setUsers(prev => [...prev, u])
    await dbService.saveUser(u)
  }
  const updateUser = async (u: User) => {
    setUsers(prev => prev.map(p => p.id === u.id ? u : p))
    await dbService.saveUser(u)
  }
  const deleteUser = async (id: string) => {
    setUsers(prev => prev.filter(p => p.id !== id))
    await dbService.deleteUser(id)
  }

  // ── Henkatens CRUD ────────────────────────────────────────
  const addHenkaten = async (e: HenkatenEvent) => {
    setHenkatens(prev => [...prev, e])
    await dbService.saveHenkaten(e)
  }
  const updateHenkaten = async (e: HenkatenEvent) => {
    setHenkatens(prev => prev.map(ev => ev.id === e.id ? e : ev))
    await dbService.saveHenkaten(e)
  }
  const deleteHenkaten = async (id: string) => {
    setHenkatens(prev => prev.filter(ev => ev.id !== id))
    await dbService.deleteHenkaten(id)
  }

  const navItemsRaw: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'atividades', label: 'Atividades',  icon: <ListTodo size={20} /> },
    { key: 'kanban',     label: 'Programação', icon: <Kanban size={20} /> },
    { key: 'dashboard',  label: 'Dashboard',   icon: <LayoutDashboard size={20} /> },
    { key: 'henkatens',  label: 'Henkatens',   icon: <Calendar size={20} /> },
    { key: 'cadastros',  label: 'Cadastros',   icon: <BookOpen size={20} /> },
  ]

  const navItems = navItemsRaw.filter(item => {
    if (item.key === 'cadastros' && currentUser?.permissions) {
      // Show cadastros if user can view either themes or users
      return currentUser.permissions.cadastros.view || currentUser.permissions.usuarios.view;
    }
    return true;
  })

  // Auth Gate
  if (!currentUser) {
    // Initial loading for users to allow login check against proper data
    if (loading && users.length === 0) return <div className="app-loader">Carregando segurança...</div>
    return <Login users={users} onLogin={setCurrentUser} />
  }

  if (loading) {
    return (
      <div className="app-loader">
        <RefreshCw size={48} className="spinner" />
        <p>Sincronizando com a Nuvem...</p>
      </div>
    )
  }

  const handleLogout = () => {
    if (confirm('Tem certeza que deseja sair?')) {
      setCurrentUser(null)
    }
  }

  return (
    <div className="app-container">
      {/* ── Mobile Header ── */}
      <header className="mobile-header">
        <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)}>
          <Menu size={24} />
        </button>
        <div className="logo-text" style={{ textAlign: 'center' }}>
          <span className="logo-subtitle">Projetos 103Ki</span>
        </div>
        <div style={{ width: 24 }} /> {/* Spacer */}
      </header>

      {/* ── Mobile Overlay ── */}
      {isMobileMenuOpen && (
        <div className="sidebar-overlay" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={`sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="logo">
          <button className="mobile-menu-btn close-sidebar" onClick={() => setIsMobileMenuOpen(false)} style={{ position: 'absolute', right: '1rem', top: '1rem', display: 'none' }}>
            <IconX size={20} />
          </button>
          <div className="logo-circle-wrapper">
            <img 
              src="https://costalog.com.br/wp-content/uploads/2024/12/lsl-transportes.webp" 
              alt="LSL" 
              className="logo-img-circle" 
            />
          </div>
          <div className="logo-text">
            <span className="logo-title">LSL Transportes</span>
            <span className="logo-subtitle">Projetos 103Ki</span>
          </div>
        </div>

        <nav className="nav">
          {navItems.map(item => (
            <button
              key={item.key}
              className={`nav-item ${activeTab === item.key ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(item.key);
                setIsMobileMenuOpen(false); // Close on click
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {activeTab === item.key && <ChevronRight size={16} className="nav-arrow" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', background: 'var(--bg-card)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '4px', background: currentUser.color || '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                {currentUser.name.charAt(0)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '90px' }}>{currentUser.name}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{currentUser.role}</span>
              </div>
            </div>
            <button className="nav-icon" onClick={handleLogout} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }} title="Sair da Conta">
              <LogOut size={16} />
            </button>
          </div>

          {/* Theme toggle */}
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={themeMode === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          >
            <span className="theme-toggle-icon">
              {themeMode === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </span>
            {themeMode === 'dark' ? 'Tema Claro' : 'Tema Escuro'}
          </button>

          <div className="sidebar-stats">
            <div className="sf-item">
              <span className="sf-val">{activities.filter(a => a.status === 'FINALIZADA').length}</span>
              <span className="sf-lbl">Finalizadas</span>
            </div>
            <div className="sf-divider" />
            <div className="sf-item">
              <span className="sf-val">{activities.filter(a => a.status === 'PENDENTE').length}</span>
              <span className="sf-lbl">Pendentes</span>
            </div>
          </div>
          <div className="cloud-status-badge">
            <div className="cloud-dot pulse"></div>
            <span>Sistema em Nuvem (Automático)</span>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="main-content">
        {activeTab === 'atividades' && (
          <AtividadesTab
            currentUser={currentUser}
            activities={activities}
            themes={themes}
            users={users}
            onAdd={addActivity}
            onUpdate={updateActivity}
            onDelete={deleteActivity}
          />
        )}
        {activeTab === 'kanban' && (
          <KanbanTab
            currentUser={currentUser}
            activities={activities}
            themes={themes}
            users={users}
          />
        )}
        {activeTab === 'dashboard' && (
          <DashboardTab
            currentUser={currentUser}
            activities={activities}
            themes={themes}
            users={users}
          />
        )}
        {activeTab === 'henkatens' && (
          <HenkatensTab
            currentUser={currentUser}
            events={henkatens}
            onAddEvent={addHenkaten}
            onUpdateEvent={updateHenkaten}
            onDeleteEvent={deleteHenkaten}
          />
        )}
        {activeTab === 'cadastros' && (
          <CadastrosTab
            currentUser={currentUser}
            themes={themes}
            users={users}
            onAddTheme={addTheme}
            onUpdateTheme={updateTheme}
            onDeleteTheme={deleteTheme}
            onAddUser={addUser}
            onUpdateUser={updateUser}
            onDeleteUser={deleteUser}
          />
        )}
      </main>
    </div>
  )
}
