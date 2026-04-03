import React, { useState, useEffect, useCallback } from 'react'
import { LayoutDashboard, ListTodo, BookOpen, ChevronRight, Sun, Moon, Kanban, Calendar, LogOut, RefreshCw, Menu, X as IconX, ShieldAlert, CheckCircle2 } from 'lucide-react'
import { defaultActivities, defaultThemes, defaultUsers, defaultHenkatens } from './data'
import type { Activity, Theme, User, Tab, HenkatenEvent, LogEntry, KnowledgeCategory, KnowledgeActivity, KnowledgeProgress, Holiday } from './types'
import AtividadesTab from './components/AtividadesTab'
import DashboardTab from './components/DashboardTab'
import CadastrosTab from './components/CadastrosTab'
import KanbanTab from './components/KanbanTab'
import HenkatensTab from './components/HenkatensTab'
import LogsTab from './components/LogsTab'
import KnowledgeTab from './components/KnowledgeTab'
import Login from './components/Login'
import { dbService } from './services/db'
import { supabase } from './lib/supabase'
import './App.css'

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  msg: string;
}

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
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [knowledgeBase, setKnowledgeBase] = useState<{ categories: KnowledgeCategory[], activities: KnowledgeActivity[], progress: KnowledgeProgress[] }>({ categories: [], activities: [], progress: [] })
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    return (localStorage.getItem('theme') as ThemeMode) || 'light'
  });
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((type: Toast['type'], title: string, msg: string) => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, type, title, msg }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  // --- Realtime Presence State ---
  const [onlineUsers, setOnlineUsers] = useState<Record<string, boolean>>({});
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');

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
      const [a, t, u, h, l, k, hol] = await Promise.all([
        dbService.getActivities(),
        dbService.getThemes(),
        dbService.getUsers(),
        dbService.getHenkatens(),
        dbService.getTodayLogs(),
        dbService.getKnowledgeBase(),
        dbService.getHolidays()
      ])
      setActivities(a)
      setThemes(t)
      setUsers(u)
      setHenkatens(h)
      setLogs(l)
      setKnowledgeBase(k)
      setHolidays(hol)
    } finally {
      setLoading(false)
    }
  }, [])


  useEffect(() => {
    loadData()
  }, [loadData])

    // --- Realtime Presence & Logs Tracker Effect ---
  useEffect(() => {
    if (!currentUser || !supabase) return;
    
    // Debug: Mostrar quem sou eu no sistema
    console.log('[DEBUG] Sou o usuário ID:', currentUser.id, 'Nome:', currentUser.name);

    const channel = supabase.channel('lsl_presence_tracker', {
      config: { presence: { key: currentUser.id } },
    });

    const handleSync = () => {
      const state = channel.presenceState();
      const activeMap: Record<string, boolean> = {};
      Object.keys(state).forEach((key) => {
        const userPresences = state[key] as any[];
        userPresences.forEach((presence) => {
          if (presence.userId) activeMap[presence.userId] = true;
        });
      });
      setOnlineUsers(activeMap);
    };

    channel
      .on('presence', { event: 'sync' }, handleSync)
      .on('presence', { event: 'join' }, handleSync)
      .on('presence', { event: 'leave' }, handleSync)
      // OUVIR LOGS EM TEMPO REAL (Por Broadcast)
      .on('broadcast', { event: 'new_log' }, ({ payload }) => {
        console.log('[DEBUG] Recebi log via Broadcast:', payload);
        const row = payload as any;
        if (row) {
          const mapped: LogEntry = {
            id: row.id,
            userId: row.user_id || row.userId,
            userName: row.user_name || row.userName,
            action: row.action,
            target: row.target,
            timestamp: row.timestamp || new Date().toISOString()
          };
          setLogs(prev => [mapped, ...prev.slice(0, 49)]);
        }
      })
      // OUVIR LOGS EM TEMPO REAL (Pela Tabela)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'app_logs' }, (payload) => {
        console.log('[DEBUG] Recebi log via Tabela:', payload.new);
        const row = payload.new as any;
        if (row) {
          const mapped: LogEntry = {
            id: row.id,
            userId: row.user_id || row.userId,
            userName: row.user_name || row.userName,
            action: row.action,
            target: row.target,
            timestamp: row.timestamp || new Date().toISOString()
          };
          // Evitar duplicidade se já recebeu via Broadcast
          setLogs(prev => {
            if (prev.find(l => l.id === mapped.id)) return prev;
            return [mapped, ...prev.slice(0, 49)];
          });
        }
      })
      .subscribe(async (subStatus) => {
        if (subStatus === 'SUBSCRIBED') {
          setRealtimeStatus('connected');
          await channel.track({
            userId: currentUser.id,
            userRole: currentUser.role,
            onlineAt: new Date().toISOString(),
          });
        } else if (subStatus === 'CLOSED' || subStatus === 'CHANNEL_ERROR') {
          setRealtimeStatus('error');
        }
      });

    return () => { channel.unsubscribe(); };
  }, [currentUser]);

  // ── Activities CRUD ──────────────────────────────────────
  const addActivity = async (a: Activity) => {
    if (!currentUser) return;
    // Optimistic update
    setActivities(prev => [a, ...prev])
    
    const { error } = await dbService.saveActivity(a)
    if (error) {
      setActivities(prev => prev.filter(act => act.id !== a.id)) // rollback
      showToast('error', 'Erro ao salvar', 'Não foi possível enviar a atividade para a nuvem. Tente novamente.')
      return;
    }

    const newLog = { userId: currentUser.id, userName: currentUser.name, action: 'Criou Nova Atividade', target: a.descricao.substring(0, 30), timestamp: new Date().toISOString(), id: crypto.randomUUID() };
    setLogs(prev => [newLog, ...prev.slice(0, 49)]);
    await dbService.saveLog(newLog)
    showToast('success', 'Sucesso', 'Atividade salva na nuvem.')
  }
  const updateActivity = async (a: Activity) => {
    if (!currentUser) return;
    const oldActivities = [...activities];
    setActivities(prev => prev.map(p => p.id === a.id ? a : p))
    
    const { error } = await dbService.saveActivity(a)
    if (error) {
      setActivities(oldActivities) // rollback
      showToast('error', 'Erro na atualização', 'Falha ao atualizar atividade na nuvem.')
      return;
    }

    const newLog = { userId: currentUser.id, userName: currentUser.name, action: 'Atualizou Atividade', target: a.descricao.substring(0, 30), timestamp: new Date().toISOString(), id: crypto.randomUUID() };
    setLogs(prev => [newLog, ...prev.slice(0, 49)]);
    await dbService.saveLog(newLog)
    showToast('success', 'Atualizado', 'Alterações salvas com sucesso.')
  }
  const deleteActivity = async (id: string) => {
    if (!currentUser) return;
    const oldActivities = [...activities];
    const act = activities.find(p => p.id === id);
    setActivities(prev => prev.filter(p => p.id !== id))
    
    const { error } = await dbService.deleteActivity(id)
    if (error) {
      setActivities(oldActivities) // rollback
      showToast('error', 'Erro ao excluir', 'Não foi possível excluir a atividade.')
      return;
    }

    const newLog = { userId: currentUser.id, userName: currentUser.name, action: 'Excluiu Atividade', target: act?.descricao.substring(0, 30), timestamp: new Date().toISOString(), id: crypto.randomUUID() };
    setLogs(prev => [newLog, ...prev.slice(0, 49)]);
    await dbService.saveLog(newLog)
    showToast('info', 'Excluído', 'Atividade removida.')
  }

  // ── Themes CRUD ──────────────────────────────────────────
  const addTheme = async (t: Theme) => {
    if (!currentUser) return;
    setThemes(prev => [...prev, t])
    const { error } = await dbService.saveTheme(t, currentUser)
    if (error) {
      setThemes(prev => prev.filter(item => item.id !== t.id))
      showToast('error', 'Erro ao salvar tema', 'Falha na conexão com a nuvem.')
    } else {
      showToast('success', 'Tema Criado', `O tema "${t.name}" foi salvo.`)
    }
  }
  const updateTheme = async (t: Theme) => {
    if (!currentUser) return;
    const oldThemes = [...themes];
    setThemes(prev => prev.map(p => p.id === t.id ? t : p))
    const { error } = await dbService.saveTheme(t, currentUser)
    if (error) {
      setThemes(oldThemes)
      showToast('error', 'Erro ao atualizar', 'Não foi possível salvar as alterações do tema.')
    } else {
      showToast('success', 'Tema Atualizado', 'Alterações confirmadas na nuvem.')
    }
  }
  const deleteTheme = async (id: string) => {
    if (!currentUser) return;
    const oldThemes = [...themes];
    const theme = themes.find(t => t.id === id);
    setThemes(prev => prev.filter(p => p.id !== id))
    const { error } = await dbService.deleteTheme(id)
    if (error) {
      setThemes(oldThemes)
      showToast('error', 'Erro ao excluir', 'O tema não pôde ser removido da nuvem.')
    } else {
      await dbService.saveLog({ userId: currentUser.id, userName: currentUser.name, action: 'Excluiu Tema', target: theme?.name })
      showToast('info', 'Tema Excluído', `O tema "${theme?.name}" foi removido.`)
    }
  }

  // ── Holidays CRUD ─────────────────────────────────────────
  const addHoliday = async (h: Holiday) => {
    if (!currentUser) return;
    setHolidays(prev => [...prev, h])
    const { error } = await dbService.saveHoliday(h)
    if (error) {
      setHolidays(prev => prev.filter(item => item.date !== h.date))
      showToast('error', 'Erro ao salvar feriado', 'Falha na conexão com a nuvem.')
    } else {
      showToast('success', 'Dia Registrado', `${h.date}: ${h.type} salvo.`)
    }
  }
  const deleteHoliday = async (date: string) => {
    if (!currentUser) return;
    const oldHolidays = [...holidays];
    setHolidays(prev => prev.filter(h => h.date !== date))
    const { error } = await dbService.deleteHoliday(date)
    if (error) {
      setHolidays(oldHolidays)
      showToast('error', 'Erro ao excluir', 'Não foi possível remover a data.')
    } else {
      showToast('info', 'Dia Removido', 'A data voltou ao normal.')
    }
  }

  // ── Users CRUD ───────────────────────────────────────────
  const addUser = async (u: User) => {
    if (!currentUser) return;
    setUsers(prev => [...prev, u])
    const { error } = await dbService.saveUser(u, currentUser)
    if (error) {
      setUsers(prev => prev.filter(item => item.id !== u.id))
      showToast('error', 'Erro ao criar usuário', 'Não foi possível salvar o novo usuário.')
    } else {
      showToast('success', 'Usuário Criado', `${u.name} agora tem acesso ao sistema.`)
    }
  }
  const updateUser = async (u: User) => {
    if (!currentUser) return;
    const oldUsers = [...users];
    setUsers(prev => prev.map(p => p.id === u.id ? u : p))
    const { error } = await dbService.saveUser(u, currentUser)
    if (error) {
      setUsers(oldUsers)
      showToast('error', 'Erro na atualização', 'Falha ao salvar alterações do usuário.')
    } else {
      showToast('success', 'Usuário Atualizado', 'Permissões e dados sincronizados.')
    }
  }
  const deleteUser = async (id: string) => {
    if (!currentUser) return;
    const oldUsers = [...users];
    const userToDel = users.find(u => u.id === id);
    setUsers(prev => prev.filter(p => p.id !== id))
    const { error } = await dbService.deleteUser(id)
    if (error) {
      setUsers(oldUsers)
      showToast('error', 'Erro ao excluir', 'O usuário não pôde ser removido.')
    } else {
      await dbService.saveLog({ userId: currentUser.id, userName: currentUser.name, action: 'Excluiu Usuário', target: userToDel?.name })
      showToast('info', 'Usuário Removido', `O acesso de ${userToDel?.name} foi revogado.`)
    }
  }

  // ── Henkatens CRUD ────────────────────────────────────────
  const addHenkaten = async (e: HenkatenEvent) => {
    if (!currentUser) return;
    setHenkatens(prev => [...prev, e])
    const { error } = await dbService.saveHenkaten(e)
    if (error) {
      setHenkatens(prev => prev.filter(item => item.id !== e.id))
      showToast('error', 'Erro ao criar Henkaten', 'Não foi possível salvar o evento.')
    } else {
      await dbService.saveLog({ userId: currentUser.id, userName: currentUser.name, action: 'Criou Henkaten', target: e.title })
      showToast('success', 'Henkaten Criado', `Evento "${e.title}" agendado.`)
    }
  }
  const updateHenkaten = async (e: HenkatenEvent) => {
    if (!currentUser) return;
    const oldH = [...henkatens];
    setHenkatens(prev => prev.map(ev => ev.id === e.id ? e : ev))
    const { error } = await dbService.saveHenkaten(e)
    if (error) {
      setHenkatens(oldH)
      showToast('error', 'Erro na atualização', 'Falha ao salvar alterações do Henkaten.')
    } else {
      await dbService.saveLog({ userId: currentUser.id, userName: currentUser.name, action: 'Atualizou Henkaten', target: e.title })
      showToast('success', 'Evento Atualizado', 'Informações sincronizadas.')
    }
  }
  const deleteHenkaten = async (id: string) => {
    if (!currentUser) return;
    const oldH = [...henkatens];
    const event = henkatens.find(e => e.id === id);
    setHenkatens(prev => prev.filter(ev => ev.id !== id))
    const { error } = await dbService.deleteHenkaten(id)
    if (error) {
      setHenkatens(oldH)
      showToast('error', 'Erro ao excluir', 'O evento não pôde ser removido.')
    } else {
      await dbService.saveLog({ userId: currentUser.id, userName: currentUser.name, action: 'Excluiu Henkaten', target: event?.title })
      showToast('info', 'Evento Excluído', 'Henkaten removido do calendário.')
    }
  }

  const navItemsRaw: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'kanban',     label: 'Programação', icon: <Kanban size={20} /> },
    { key: 'atividades', label: 'Atividades',  icon: <ListTodo size={20} /> },
    { key: 'dashboard',  label: 'Dashboard',   icon: <LayoutDashboard size={20} /> },
    { key: 'henkatens',  label: 'Henkatens',   icon: <Calendar size={20} /> },
    { key: 'conhecimento', label: 'Conhecimento', icon: <BookOpen size={20} /> },
    { key: 'cadastros',  label: 'Cadastros',   icon: <ShieldAlert size={20} /> },
    { key: 'logs',       label: 'Logs',        icon: <ShieldAlert size={20} /> },
  ]

  const navItems = navItemsRaw.filter(item => {
    if (item.key === 'cadastros' && currentUser?.role !== 'Administrador') {
      return false;
    }
    if (item.key === 'logs' && currentUser?.role !== 'Administrador') {
      return false;
    }
    if (item.key === 'conhecimento' && (currentUser?.role !== 'Administrador' && currentUser?.role !== 'Gestão')) {
      return false;
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
          <div className={`cloud-status-badge ${realtimeStatus}`}>
            <div className={`cloud-dot ${realtimeStatus === 'connected' ? 'pulse' : ''}`}></div>
            <span>
              {realtimeStatus === 'connected' ? 'Sistema em Nuvem (Online)' : 
               realtimeStatus === 'connecting' ? 'Conectando à Nuvem...' : 
               'Sistema Offline (Falha)'}
            </span>
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
            holidays={holidays}
            onRefresh={loadData}
            showToast={showToast}
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
            holidays={holidays}
            onAddTheme={addTheme}
            onUpdateTheme={updateTheme}
            onDeleteTheme={deleteTheme}
            onAddUser={addUser}
            onUpdateUser={updateUser}
            onDeleteUser={deleteUser}
            onAddHoliday={addHoliday}
            onDeleteHoliday={deleteHoliday}
          />
        )}
        {activeTab === 'conhecimento' && (
          <KnowledgeTab
            currentUser={currentUser}
            users={users}
            categories={knowledgeBase.categories}
            activities={knowledgeBase.activities}
            progress={knowledgeBase.progress}
            onRefresh={loadData}
          />
        )}
        {activeTab === 'logs' && (
          <LogsTab
            currentUser={currentUser}
            users={users}
            activities={activities}
            logs={logs}
            onlineUsers={onlineUsers}
            realtimeStatus={realtimeStatus}
          />
        )}
      </main>

      {/* ── Toast notifications ── */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
             <div className="toast-icon">
                {t.type === 'success' && <CheckCircle2 size={20} style={{ color: '#10b981' }} />}
                {t.type === 'error' && <ShieldAlert size={20} style={{ color: '#ef4444' }} />}
                {t.type === 'info' && <RefreshCw size={20} style={{ color: '#3b82f6' }} />}
             </div>
             <div className="toast-content">
                <span className="toast-title">{t.title}</span>
                <span className="toast-msg">{t.msg}</span>
             </div>
          </div>
        ))}
      </div>
    </div>
  )
}
