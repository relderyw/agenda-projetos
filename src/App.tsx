import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { LayoutDashboard, ListTodo, BookOpen, ChevronRight, ChevronDown, Sun, Moon, Kanban, Calendar, LogOut, RefreshCw, Menu, X as IconX, ShieldAlert, CheckCircle2, UserCheck, Users, AlertTriangle, Bell, BellOff } from 'lucide-react'
import { defaultActivities, defaultThemes, defaultUsers, defaultHenkatens } from './data'
import type { Activity, Theme, User, Tab, HenkatenEvent, LogEntry, KnowledgeCategory, KnowledgeActivity, KnowledgeProgress, Holiday, AbsenteeismRecord, Employee, OvertimeRecord, Status } from './types'
import type { StaffingBoard, StaffingColumn, StaffingRow, StaffingCell } from './types'
import AtividadesTab from './components/AtividadesTab'
import DashboardTab from './components/DashboardTab'
import CadastrosTab from './components/CadastrosTab'
import KanbanTab from './components/KanbanTab'
import HenkatensTab from './components/HenkatensTab'
import LogsTab from './components/LogsTab'
import KnowledgeTab from './components/KnowledgeTab'
import AbsenteismoTab from './components/AbsenteismoTab'
import QuadroPessoalTab from './components/QuadroPessoalTab'
import Login from './components/Login'
import { dbService } from './services/db'
import { requestNotificationPermission, getNotificationPermission, fireOverdueNotifications, getOverdueActivities, sendWebhookNotification } from './services/notificationService'
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
  const [absenteeism, setAbsenteeism] = useState<AbsenteeismRecord[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [overtimes, setOvertimes] = useState<OvertimeRecord[]>([])
  const [staffingBoards, setStaffingBoards] = useState<StaffingBoard[]>([])
  const [staffingColumns, setStaffingColumns] = useState<StaffingColumn[]>([])
  const [staffingRows, setStaffingRows] = useState<StaffingRow[]>([])
  const [staffingCells, setStaffingCells] = useState<StaffingCell[]>([])
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    return (localStorage.getItem('theme') as ThemeMode) || 'light'
  });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [notifPermission, setNotifPermission] = useState<'granted' | 'denied' | 'default' | 'unsupported'>('default');
  const [isClosureModalOpen, setIsClosureModalOpen] = useState(false);
  const [isAgendaClosedToday, setIsAgendaClosedToday] = useState(() => {
    const today = new Date().toLocaleDateString('en-CA');
    return localStorage.getItem('agenda_closed_date') === today;
  });


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

  const getMyTodayPendingCount = useCallback(() => {
    if (!currentUser) return 0;
    const todayStr = new Date().toLocaleDateString('en-CA');
    const todayPt = new Date().toLocaleDateString('pt-BR');
    
    const myTodayActs = activities.filter(a => 
      a && a.responsavel === currentUser.id && a.planejamento === todayStr
    );

    if (myTodayActs.length === 0) return 0;

    return myTodayActs.filter(a => {
      // Regra: Somente atividades PENDENTE ou EM ANDAMENTO contam como pendência para o card
      if (a.status !== 'PENDENTE' && a.status !== 'EM ANDAMENTO') return false;
      
      // Teve comentário ou atualização hoje? OK.
      const commentDate = (typeof a.dataComentario === 'string') ? a.dataComentario.split(' ')[0] : '';
      const updateDate = (typeof a.dataUltimaAtualizacao === 'string') ? a.dataUltimaAtualizacao.split(' ')[0] : '';
      
      if (commentDate === todayPt || updateDate === todayPt) return false;

      return true;
    }).length;
  }, [activities, currentUser]);

  const getMyPendingCount = useCallback(() => {
    if (!currentUser) return 0;
    const todayStr = new Date().toLocaleDateString('en-CA');
    return activities.filter(a => {
      if (a.responsavel !== currentUser.id) return false;
      if (a.status === 'FINALIZADA' || a.status === 'CANCELADA') return false;
      return a.planejamento <= todayStr;
    }).length;
  }, [activities, currentUser]);

  // ── Teams Notification Effect (16:05) ──
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'Analista') return;

    const checkTimeAndNotify = async () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const todayStr = now.toLocaleDateString('en-CA');
      
      // Only at 16:05 (allow a small window)
      if (hours === 16 && minutes >= 5 && minutes <= 10) {
        const notifiedToday = localStorage.getItem(`teams_notified_${todayStr}`);
        if (notifiedToday) return;

        const pendingToday = getMyTodayPendingCount();
        if (pendingToday > 0) {
          const msg = `🔔 <b>Atenção ${currentUser.name}!</b>\n` +
                      `Sua agenda de hoje ainda possui <b>${pendingToday}</b> atividades sem atualização.\n` +
                      `Por favor, acesse o sistema e realize o fechamento do turno para evitar atrasos.`;
          
          const ok = await sendWebhookNotification(msg, currentUser.email);
          if (ok) {
            localStorage.setItem(`teams_notified_${todayStr}`, 'true');
            console.log('[Teams] Notificação de pendência enviada.');
          }
        }
      }
    };

    const interval = setInterval(checkTimeAndNotify, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [currentUser, getMyTodayPendingCount]);

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'Analista' || isAgendaClosedToday) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const now = new Date();
      const hours = now.getHours();
      if (hours >= 15 && getMyPendingCount() > 0) {
        e.preventDefault();
        e.returnValue = 'Você tem atividades pendentes na agenda hoje. Por favor, faça o Fechamento de Turno antes de sair.';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentUser, isAgendaClosedToday, getMyPendingCount]);


  const loadData = useCallback(async () => {
    // Only show the central spinner on the very first app load
    if (isFirstLoad) setLoading(true);
    
    try {
      const [a, t, u, h, l, k, hol, abs, emp, ove, staffing] = await Promise.all([
        dbService.getActivities(),
        dbService.getThemes(),
        dbService.getUsers(),
        dbService.getHenkatens(),
        dbService.getTodayLogs(),
        dbService.getKnowledgeBase(),
        dbService.getHolidays(),
        dbService.getAbsenteeism(),
        dbService.getEmployees(),
        dbService.getOvertimes(),
        dbService.getStaffingData()
      ])
      setActivities(a)
      setThemes(t)
      setUsers(u)
      setHenkatens(h)
      setLogs(l)
      setKnowledgeBase(k)
      setHolidays(hol)
      setAbsenteeism(abs)
      setEmployees(emp)
      setOvertimes(ove)
      setStaffingBoards(staffing.boards)
      setStaffingColumns(staffing.columns)
      setStaffingRows(staffing.rows)
      setStaffingCells(staffing.cells)
    } finally {
      if (isFirstLoad) setLoading(false);
      setIsFirstLoad(false);
    }
  }, [isFirstLoad])


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

  // --- Migration: Corrigir Labels de Semanas (Executa uma vez por sessão se houver discrepância) ---
  const migrateWeeks = useCallback(async () => {
    if (!currentUser || (currentUser.role !== 'Administrador' && currentUser.role !== 'Gestão')) return;
    if ((window as any)._weeks_migrated) return;
    (window as any)._weeks_migrated = true;

    const getWeekOfMonthString = (dateStr: string) => {
      if (!dateStr) return '';
      const [y, m, d] = dateStr.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      if (isNaN(date.getTime())) return '';
      const dayOfMonth = date.getDate();
      const firstDay = new Date(y, m - 1, 1);
      const firstDayOfWeek = firstDay.getDay();
      const offset = (firstDayOfWeek + 6) % 7; 
      const weekNum = Math.ceil((dayOfMonth + offset) / 7);
      const ptMonths = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
      return `W${weekNum > 5 ? 5 : weekNum} - ${ptMonths[date.getMonth()]}`;
    };

    const toUpdate = activities.filter(a => {
      if (!a.planejamento) return false;
      const correctWeek = getWeekOfMonthString(a.planejamento);
      return a.week !== correctWeek;
    });

    if (toUpdate.length > 0) {
      console.log(`[MIGRATION] Sincronizando ${toUpdate.length} atividades...`);
      for (const a of toUpdate) {
        const correctWeek = getWeekOfMonthString(a.planejamento);
        await dbService.saveActivity({ ...a, week: correctWeek });
      }
      showToast('info', 'Correção de Calendário', `${toUpdate.length} atividades foram sincronizadas com o novo padrão semanal.`);
      loadData();
    }
  }, [activities, currentUser, showToast, loadData]);

  useEffect(() => {
    if (activities.length > 0 && currentUser) {
      migrateWeeks();
    }
  }, [activities.length, currentUser, migrateWeeks]);

  // ── Overdue Notifications ─────────────────────────────────
  useEffect(() => {
    if (!currentUser || activities.length === 0 || users.length === 0) return;

    const perm = getNotificationPermission();
    setNotifPermission(perm as any);

    if (perm === 'default') {
      // Ask permission after a short delay (less intrusive)
      const timer = setTimeout(async () => {
        const granted = await requestNotificationPermission();
        setNotifPermission(granted ? 'granted' : 'denied');
        if (granted) {
          fireOverdueNotifications(activities.filter(a => a.responsavel === currentUser.id), users);
        }
      }, 3000);
      return () => clearTimeout(timer);
    }

    if (perm === 'granted') {
      fireOverdueNotifications(activities.filter(a => a.responsavel === currentUser.id), users);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, activities.length, users.length]);

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

  // ── Absenteeism CRUD ────────────────────────────────────────
  const saveAbsenteeismRecord = async (record: Omit<AbsenteeismRecord, 'id'> | AbsenteeismRecord) => {
    if (!currentUser) return;
    const oldAbs = [...absenteeism];
    
    // update locally optimistic
    setAbsenteeism(prev => {
      const idx = prev.findIndex(r => r.employeeId === record.employeeId && r.date === record.date);
      if (idx !== -1) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], status: record.status } as AbsenteeismRecord;
        return copy;
      } else {
        return [...prev, { ...record, id: crypto.randomUUID() } as AbsenteeismRecord];
      }
    });

    const { error } = await dbService.saveAbsenteeism(record);
    if (error) {
       setAbsenteeism(oldAbs);
       showToast('error', 'Aviso de Sincronização', 'Falha ao salvar registro de absenteísmo na nuvem.');
    }
  };

  const deleteAbsenteeismRecord = async (employeeId: string, date: string) => {
    if (!currentUser) return;
    const oldAbs = [...absenteeism];
    setAbsenteeism(prev => prev.filter(r => !(r.employeeId === employeeId && r.date === date)));

    const { error } = await dbService.deleteAbsenteeism(employeeId, date);
    if (error) {
       setAbsenteeism(oldAbs);
       showToast('error', 'Aviso de Sincronização', 'Falha ao remover registro de absenteísmo na nuvem.');
    }
  };

  const saveEmployeeRecord = async (emp: Employee) => {
    if (!currentUser) return;
    const isNew = !employees.find(e => e.id === emp.id);
    setEmployees(prev => {
      const copy = [...prev];
      const idx = copy.findIndex(e => e.id === emp.id);
      if (idx !== -1) copy[idx] = emp;
      else copy.push(emp);
      return copy;
    });
    const { error } = await dbService.saveEmployee(emp);
    if (error) showToast('error', 'Aviso de Sincronização', 'Falha ao salvar funcionário.');
    else if (isNew) showToast('success', 'Funcionário Salvo', `Perfil de ${emp.name} criado com sucesso.`);
  };

  const deleteEmployeeRecord = async (id: string) => {
    if (!currentUser) return;
    setEmployees(prev => prev.filter(e => e.id !== id));
    const { error } = await dbService.deleteEmployee(id);
    if (error) showToast('error', 'Aviso de Sincronização', 'Falha ao excluir funcionário.');
    else showToast('success', 'Excluído', 'Funcionário excluído.');
  };

  const saveOvertimeRecord = async (record: Omit<OvertimeRecord, 'id'> | OvertimeRecord) => {
    if (!currentUser) return;
    setOvertimes(prev => {
      const idx = prev.findIndex(r => r.id === (record as any).id);
      if (idx !== -1) {
        const copy = [...prev];
        copy[idx] = record as OvertimeRecord;
        return copy;
      } else {
        return [...prev, record as OvertimeRecord];
      }
    });

    const { error } = await dbService.saveOvertime(record);
    if (error) showToast('error', 'Aviso de Sincronização', 'Falha ao salvar Hora Extra.');
    else showToast('success', 'Salvo', 'Lançamento de Hora Extra salvo.');
  };

  const deleteOvertimeRecord = async (id: string) => {
    if (!currentUser) return;
    setOvertimes(prev => prev.filter(r => r.id !== id));
    const { error } = await dbService.deleteOvertime(id);
    if (error) showToast('error', 'Aviso de Sincronização', 'Falha ao deletar Hora Extra.');
  };

  // ── Staffing Board CRUD ───────────────────────────────────
  const saveBoardRecord = async (board: StaffingBoard) => {
    setStaffingBoards(prev => {
      const idx = prev.findIndex(b => b.id === board.id);
      if (idx !== -1) return prev.map(b => b.id === board.id ? board : b);
      return [...prev, board];
    });
    const { error } = await dbService.saveStaffingBoard(board);
    if (error) showToast('error', 'Erro', 'Falha ao salvar quadro de pessoal.');
  };

  const deleteBoardRecord = async (id: string) => {
    setStaffingBoards(prev => prev.filter(b => b.id !== id));
    setStaffingColumns(prev => prev.filter(c => c.boardId !== id));
    setStaffingRows(prev => prev.filter(r => r.boardId !== id));
    const { error } = await dbService.deleteStaffingBoard(id);
    if (error) showToast('error', 'Erro', 'Falha ao deletar quadro de pessoal.');
  };

  const saveColumnRecord = async (column: StaffingColumn) => {
    setStaffingColumns(prev => {
      const idx = prev.findIndex(c => c.id === column.id);
      if (idx !== -1) return prev.map(c => c.id === column.id ? column : c);
      return [...prev, column];
    });
    const { error } = await dbService.saveStaffingColumn(column);
    if (error) showToast('error', 'Erro', 'Falha ao salvar coluna de cenário.');
  };

  const deleteColumnRecord = async (id: string) => {
    setStaffingColumns(prev => prev.filter(c => c.id !== id));
    setStaffingCells(prev => prev.filter(cell => cell.columnId !== id));
    const { error } = await dbService.deleteStaffingColumn(id);
    if (error) showToast('error', 'Erro', 'Falha ao deletar coluna de cenário.');
  };

  const saveRowRecord = async (row: StaffingRow) => {
    setStaffingRows(prev => {
      const idx = prev.findIndex(r => r.id === row.id);
      if (idx !== -1) return prev.map(r => r.id === row.id ? row : r);
      return [...prev, row];
    });
    const { error } = await dbService.saveStaffingRow(row);
    if (error) showToast('error', 'Erro', 'Falha ao salvar linha de cargo.');
  };

  const deleteRowRecord = async (id: string) => {
    setStaffingRows(prev => prev.filter(r => r.id !== id));
    setStaffingCells(prev => prev.filter(cell => cell.rowId !== id));
    const { error } = await dbService.deleteStaffingRow(id);
    if (error) showToast('error', 'Erro', 'Falha ao deletar linha de cargo.');
  };

  const saveCellRecord = async (cell: StaffingCell) => {
    setStaffingCells(prev => {
      const idx = prev.findIndex(c => c.rowId === cell.rowId && c.columnId === cell.columnId);
      if (idx !== -1) return prev.map(c => c.rowId === cell.rowId && c.columnId === cell.columnId ? cell : c);
      return [...prev, cell];
    });
    const { error } = await dbService.saveStaffingCell(cell);
    if (error) showToast('error', 'Erro', 'Falha ao salvar célula do quadro.');
  };

  const navItemsRaw: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'kanban',     label: 'Programação', icon: <Kanban size={20} /> },
    { key: 'atividades', label: 'Atividades',  icon: <ListTodo size={20} /> },
    { key: 'dashboard',  label: 'Dashboard',   icon: <LayoutDashboard size={20} /> },
    { key: 'quadroPessoal', label: 'Quadro de Pessoal', icon: <Users size={20} /> },
    { key: 'absenteismo',label: 'Absenteísmo', icon: <UserCheck size={20} /> },
    { key: 'henkatens',  label: 'Henkatens',   icon: <Calendar size={20} /> },
    { key: 'conhecimento', label: 'Conhecimento', icon: <BookOpen size={20} /> },
    { key: 'cadastros',  label: 'Cadastros',   icon: <ShieldAlert size={20} /> },
    { key: 'logs',       label: 'Logs',        icon: <ShieldAlert size={20} /> },
  ]

  const navItems = navItemsRaw.filter(item => {
    if (!currentUser) return false;
    const p = currentUser.permissions;

    // Administrador sempre vê tudo
    if (currentUser.role === 'Administrador') return true;

    if (item.key === 'cadastros') return p?.cadastros?.view ?? false;
    if (item.key === 'logs') return false; // Somente Admin (já coberto acima)
    if (item.key === 'conhecimento') return (p?.conhecimentoTP?.view || p?.conhecimentoProj?.view) ?? (currentUser.role === 'Gestão');
    if (item.key === 'absenteismo') return p?.absenteismo?.view ?? false;
    if (item.key === 'quadroPessoal') return p?.quadroPessoal?.view ?? false;

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
    if (currentUser?.role === 'Analista' && !isAgendaClosedToday && getMyPendingCount() > 0) {
      const now = new Date();
      if (now.getHours() >= 15) {
        if (!confirm('Atenção: Você ainda não realizou o Fechamento de Turno hoje! Deseja mesmo sair sem atualizar sua agenda?')) {
          setIsClosureModalOpen(true);
          return;
        }
      }
    }
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

      {/* ── Overdue Alert Banner ── */}
      {(() => {
        if (!currentUser || bannerDismissed) return null;
        const overdue = getOverdueActivities(activities, users);
        if (overdue.length === 0) return null;

        // Count only MY activities if not admin/gestão
        const isManager = currentUser.role === 'Administrador' || currentUser.role === 'Gestão';
        const myOverdue = isManager
          ? overdue
          : overdue.filter(o => o.activity.responsavel === currentUser.id);
        if (myOverdue.length === 0) return null;

        const mostLate = myOverdue[0];

        return (
          <div className="overdue-banner">
            <div className="overdue-banner-left">
              <AlertTriangle size={18} className="overdue-banner-icon" />
              <div>
                <strong>
                  {myOverdue.length} atividade{myOverdue.length > 1 ? 's' : ''} atrasada{myOverdue.length > 1 ? 's' : ''}
                </strong>
                <span className="overdue-banner-detail">
                  &nbsp;— mais antiga: <em>{mostLate.activity.descricao.substring(0, 40)}{mostLate.activity.descricao.length > 40 ? '…' : ''}</em>
                  &nbsp;({mostLate.daysLate} dia{mostLate.daysLate > 1 ? 's' : ''} de atraso)
                </span>
              </div>
            </div>
            <div className="overdue-banner-actions">
              <button
                className="overdue-banner-btn"
                onClick={() => setActiveTab('atividades')}
              >
                Ver atividades →
              </button>
              {notifPermission === 'default' && (
                <button
                  className="overdue-banner-btn ghost"
                  title="Ativar notificações Windows"
                  onClick={async () => {
                    const granted = await requestNotificationPermission();
                    setNotifPermission(granted ? 'granted' : 'denied');
                    if (granted) fireOverdueNotifications(activities.filter(a => a.responsavel === currentUser.id), users);
                  }}
                >
                  <Bell size={14} /> Ativar alertas Windows
                </button>
              )}
              {notifPermission === 'denied' && (
                <span className="overdue-banner-hint" title="Permissão de notificação bloqueada no navegador">
                  <BellOff size={13} /> Notificações bloqueadas
                </span>
              )}
              {notifPermission === 'granted' && (
                <span className="overdue-banner-hint" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  <Bell size={13} /> Notificações Windows ativas
                </span>
              )}
              <button
                className="overdue-banner-close"
                onClick={() => setBannerDismissed(true)}
                title="Fechar banner"
              >
                <IconX size={16} />
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Closure Checklist Floating Notification ── */}
      {(() => {
        if (!currentUser || currentUser.role !== 'Analista' || isAgendaClosedToday) return null;
        
        const now = new Date();
        // Show only if it's after 15:00 OR if there are pending today acts
        const pendingToday = getMyTodayPendingCount();
        if (pendingToday === 0) return null;

        // If it's early, maybe don't show it yet? The user said "se ele acessar a pagina da agenda ele receba uma notificação se não atualizou a agenda"
        // So I should show it anytime if it's not updated.

        return (
          <div className="closure-floating-card">
            <div className="cfc-icon">
              <AlertTriangle size={20} />
            </div>
            <div className="cfc-content">
              <div className="cfc-title">Agenda Pendente</div>
              <div className="cfc-text">
                Você possui {pendingToday} atividade{pendingToday !== 1 ? 's' : ''} sem atualização hoje.
              </div>
              <button 
                className="cfc-btn"
                onClick={() => setIsClosureModalOpen(true)}
              >
                Atualizar Agora
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Closure Checklist Modal ── */}
      {isClosureModalOpen && (
        <ClosureChecklistModal
          currentUser={currentUser}
          activities={activities}
          themes={themes}
          onUpdateActivity={updateActivity}
          onClose={() => setIsClosureModalOpen(false)}
          onConfirmClosure={async (finalizedCount: number, pendingCount: number) => {
            const todayStr = new Date().toLocaleDateString('en-CA');
            
            // 1. Save closure log
            const logMsg = `${finalizedCount} concluídas, ${pendingCount} pendentes`;
            const newLog = {
              userId: currentUser.id,
              userName: currentUser.name,
              action: 'Fechamento de Agenda',
              target: logMsg,
              timestamp: new Date().toISOString(),
              id: crypto.randomUUID()
            };
            setLogs(prev => [newLog, ...prev.slice(0, 49)]);
            await dbService.saveLog(newLog);

            // 2. Disparar Webhook
            const todayFmt = (todayStr && todayStr.includes('-')) ? todayStr.split('-').reverse().join('/') : todayStr;
            const groupMsg = `📢 <b>${currentUser.name}</b> encerrou a agenda de hoje (${todayFmt})!\n` +
                             `• Atividades concluídas/atualizadas: <b>${finalizedCount}</b>\n` +
                             `• Atividades que restaram pendentes: <b>${pendingCount}</b>\n` +
                             `<i>Agenda atualizada e confirmada no sistema.</i>`;
            await sendWebhookNotification(groupMsg, currentUser.email);

            // 3. Update states
            localStorage.setItem('agenda_closed_date', todayStr);
            setIsAgendaClosedToday(true);
            setIsClosureModalOpen(false);
            showToast('success', 'Sucesso', 'Fechamento de turno registrado e notificado!');
          }}
        />
      )}

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
            themeMode={themeMode}
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
        {activeTab === 'absenteismo' && (
          <AbsenteismoTab
            currentUser={currentUser}
            employees={employees}
            absenteeismRecords={absenteeism}
            overtimeRecords={overtimes}
            holidays={holidays}
            onSaveAbsenteeism={saveAbsenteeismRecord}
            onDeleteAbsenteeism={deleteAbsenteeismRecord}
            onSaveEmployee={saveEmployeeRecord}
            onDeleteEmployee={deleteEmployeeRecord}
            onSaveOvertime={saveOvertimeRecord}
            onDeleteOvertime={deleteOvertimeRecord}
          />
        )}
        {activeTab === 'quadroPessoal' && (
          <QuadroPessoalTab
            currentUser={currentUser}
            boards={staffingBoards}
            columns={staffingColumns}
            rows={staffingRows}
            cells={staffingCells}
            onSaveBoard={saveBoardRecord}
            onDeleteBoard={deleteBoardRecord}
            onSaveColumn={saveColumnRecord}
            onDeleteColumn={deleteColumnRecord}
            onSaveRow={saveRowRecord}
            onDeleteRow={deleteRowRecord}
            onSaveCell={saveCellRecord}
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

interface ClosureModalProps {
  currentUser: User;
  activities: Activity[];
  themes: Theme[];
  onUpdateActivity: (a: Activity) => Promise<void>;
  onClose: () => void;
  onConfirmClosure: (finalizedCount: number, pendingCount: number) => Promise<void>;
}

function ClosureChecklistModal({ currentUser, activities, themes, onUpdateActivity, onClose, onConfirmClosure }: ClosureModalProps) {
  const todayStr = new Date().toLocaleDateString('en-CA');
  
  // Filter only activities assigned to current user, scheduled for today or overdue
  // Filter criteria: Status must be PENDENTE or EM ANDAMENTO
  const myTasks = useMemo(() => {
    return activities.filter((a: Activity) => {
      if (!a || a.responsavel !== currentUser.id) return false;
      // Exibir apenas PENDENTE ou EM ANDAMENTO
      if (a.status !== 'PENDENTE' && a.status !== 'EM ANDAMENTO') return false;
      // De hoje para trás
      return a.planejamento <= todayStr;
    });
  }, [activities, currentUser.id, todayStr]);

  const pendingTasks = myTasks; // myTasks already filtered by PENDENTE/EM ANDAMENTO

  const [saving, setSaving] = useState(false);
  const [hasMadeChanges, setHasMadeChanges] = useState(false);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [progresses, setProgresses] = useState<Record<string, number>>({});

  const getThemeName = (themeId: string) => {
    return themes.find(t => t.id === themeId)?.name || 'Sem Tema';
  };

  const handleQuickFinalize = async (task: Activity) => {
    setSaving(true);
    setHasMadeChanges(true);
    const updated = {
      ...task,
      status: 'FINALIZADA' as Status,
      percentualAndamento: 100,
      dataFinalizada: todayStr,
      comentario: comments[task.id] || task.comentario || 'Finalizado no encerramento de turno.',
      dataComentario: new Date().toLocaleString('pt-BR')
    };
    await onUpdateActivity(updated);
    setSaving(false);
  };

  const handleUpdateTask = async (task: Activity, status: Status, percent: number) => {
    setSaving(true);
    setHasMadeChanges(true);
    const updated = {
      ...task,
      status,
      percentualAndamento: percent,
      dataFinalizada: status === 'FINALIZADA' ? todayStr : task.dataFinalizada,
      comentario: comments[task.id] || task.comentario,
      dataComentario: comments[task.id] ? new Date().toLocaleString('pt-BR') : task.dataComentario,
      dataUltimaAtualizacao: new Date().toLocaleString('pt-BR')
    };
    await onUpdateActivity(updated);
    setSaving(false);
  };

  const handleFinishDay = async () => {
    // Validar se todas as tarefas pendentes tiveram alguma alteração (status, % ou comentário)
    const unupdatedTasks = pendingTasks.filter(task => {
      const currentStatus = statuses[task.id] || task.status;
      const currentPercent = progresses[task.id] !== undefined ? progresses[task.id] : task.percentualAndamento;
      const currentComment = comments[task.id] !== undefined ? comments[task.id] : (task.comentario || '');
      
      const statusChanged = currentStatus !== task.status;
      const percentChanged = currentPercent !== task.percentualAndamento;
      const commentChanged = currentComment !== (task.comentario || '');

      // Se não mudou absolutamente nada, reprova
      if (!statusChanged && !percentChanged && !commentChanged) return true;
      
      // Se está em andamento, obriga a mudar o % ou colocar um comentário novo
      if (currentStatus === 'EM ANDAMENTO' && !percentChanged && !commentChanged) return true;

      return false;
    });

    if (unupdatedTasks.length > 0) {
      alert(`Você tem ${unupdatedTasks.length} atividade(s) pendente(s) que não sofreram atualização. É obrigatório atualizar o status, % de andamento ou adicionar um comentário novo nas atividades para encerrar o dia.`);
      return;
    }

    const remainingCount = pendingTasks.length;
    if (remainingCount > 0) {
      if (!confirm(`Você ainda possui ${remainingCount} atividades pendentes para hoje. Deseja encerrar a agenda com pendências?`)) {
        return;
      }
    }
    
    setSaving(true);
    const finalizedCount = myTasks.filter((a: Activity) => a.status === 'FINALIZADA' || a.status === 'CANCELADA').length;
    await onConfirmClosure(finalizedCount, remainingCount);
    setSaving(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box closure-modal" style={{ maxWidth: '750px', width: '90%' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={24} style={{ color: '#10b981' }} />
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>Fechamento de Turno - Agenda</h2>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Olá {currentUser.name}, atualize suas atividades pendentes e finalize seu dia.</p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><IconX size={20} /></button>
        </div>

        <div className="modal-body custom-scroll" style={{ maxHeight: '60vh', overflowY: 'auto', padding: '1rem 0' }}>
          {myTasks.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              🎉 Você não tem atividades planejadas para hoje ou atrasadas!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {pendingTasks.length > 0 ? (
                <div className="alert-box warning" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', padding: '10px 14px', borderRadius: '8px', color: '#f59e0b', fontSize: '0.8rem', fontWeight: 500 }}>
                  ⚠️ Você tem {pendingTasks.length} atividades que ainda não foram marcadas como FINALIZADA ou CANCELADA.
                </div>
              ) : (
                <div className="alert-box success" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', padding: '10px 14px', borderRadius: '8px', color: '#10b981', fontSize: '0.8rem', fontWeight: 500 }}>
                  ✅ Tudo atualizado! Excelente trabalho, todas as atividades planejadas para hoje foram concluídas.
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {myTasks.map((task: Activity) => {
                  const isDone = task.status === 'FINALIZADA' || task.status === 'CANCELADA';
                  const taskStatus = statuses[task.id] || task.status;
                  const taskPercent = progresses[task.id] !== undefined ? progresses[task.id] : task.percentualAndamento;
                  const commentText = comments[task.id] !== undefined ? comments[task.id] : (task.comentario || '');

                  return (
                    <div 
                      key={task.id} 
                      className={`closure-task-card ${isDone ? 'done' : 'pending'}`}
                      style={{
                        padding: '1.25rem',
                        borderRadius: '12px',
                        border: '1px solid var(--border-color)',
                        background: isDone ? 'rgba(16,185,129,0.03)' : 'var(--bg-card)',
                        boxShadow: 'var(--card-shadow)',
                        opacity: isDone ? 0.75 : 1
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '10px' }}>
                        <div>
                          <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontWeight: 700 }}>
                            {getThemeName(task.tema)}
                          </span>
                          <h4 style={{ margin: '4px 0', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {task.descricao}
                          </h4>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            Planejado: {(typeof task.planejamento === 'string') ? task.planejamento.split('-').reverse().join('/') : '—'} | 
                            Previsto: {(typeof task.dataPrevistaFinalizacao === 'string') ? task.dataPrevistaFinalizacao.split('-').reverse().join('/') : '—'}
                          </span>
                        </div>
                        
                        {!isDone && (
                          <button 
                            className="btn-primary"
                            onClick={() => handleQuickFinalize(task)}
                            disabled={saving}
                            style={{ padding: '6px 12px', fontSize: '0.75rem', background: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <CheckCircle2 size={12} /> Concluir Rápido
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '12px' }}>
                        <div className="form-group">
                          <label style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', display: 'block', color: 'var(--text-secondary)' }}>Status</label>
                          <div className="select-wrap full-w" style={{ height: '34px' }}>
                            <select 
                              value={taskStatus} 
                              disabled={saving}
                              onChange={e => {
                                const newStatus = e.target.value as Status;
                                const newPercent = newStatus === 'FINALIZADA' ? 100 : (newStatus === 'PENDENTE' ? 0 : taskPercent);
                                setStatuses(prev => ({ ...prev, [task.id]: newStatus }));
                                setProgresses(prev => ({ ...prev, [task.id]: newPercent }));
                                handleUpdateTask(task, newStatus, newPercent);
                              }}
                            >
                              <option value="PENDENTE">PENDENTE</option>
                              <option value="EM ANDAMENTO">EM ANDAMENTO</option>
                              <option value="FINALIZADA">FINALIZADA</option>
                              <option value="POSTERGADA">POSTERGADA</option>
                              <option value="CANCELADA">CANCELADA</option>
                            </select>
                            <ChevronDown size={12} className="sel-icon" />
                          </div>
                        </div>

                        <div className="form-group">
                          <label style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', display: 'block', color: 'var(--text-secondary)' }}>% Andamento</label>
                          <input 
                            type="number" 
                            min="0" 
                            max="100" 
                            value={taskPercent}
                            disabled={saving || taskStatus === 'FINALIZADA'}
                            onChange={e => {
                              const val = Number(e.target.value);
                              setProgresses(prev => ({ ...prev, [task.id]: val }));
                            }}
                            onBlur={() => {
                              const p = progresses[task.id] ?? task.percentualAndamento;
                              handleUpdateTask(task, taskStatus, p);
                            }}
                            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', width: '100%', fontSize: '0.8rem', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                          />
                        </div>
                      </div>

                      <div className="form-group" style={{ marginTop: '10px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', display: 'block', color: 'var(--text-secondary)' }}>Comentário / Justificativa</label>
                        <textarea 
                          rows={2}
                          value={commentText}
                          disabled={saving}
                          placeholder="Adicione observações sobre o andamento..."
                          onChange={e => setComments(prev => ({ ...prev, [task.id]: e.target.value }))}
                          onBlur={() => {
                            if (comments[task.id] !== undefined) {
                              handleUpdateTask(task, taskStatus, taskPercent);
                            }
                          }}
                          style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between' }}>
          <button className="btn-ghost" onClick={onClose} disabled={saving}>Voltar depois</button>
          <button 
            className="btn-primary" 
            onClick={handleFinishDay} 
            disabled={saving}
            style={{ padding: '10px 24px', background: '#10b981', display: 'flex', alignItems: 'center', gap: '8px', border: 'none', color: '#fff', cursor: 'pointer' }}
          >
            {saving ? <RefreshCw size={16} className="spinner" /> : <CheckCircle2 size={16} />}
            Confirmar Encerramento do Dia
          </button>
        </div>
      </div>
    </div>
  );
}

