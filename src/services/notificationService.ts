import type { Activity, User } from '../types';
import { supabase } from '../lib/supabase';

const NOTIFIED_KEY = 'overdue_notified_ids';
const NOTIFIED_DATE_KEY = 'overdue_notified_date';

// ─── Webhook Configuration ───────────────────────────────

export interface WebhookConfig {
  enabled: boolean;
  type: 'discord' | 'slack' | 'teams' | 'telegram' | 'none';
  url: string;
  telegramToken?: string;
  telegramChatId?: string;
}

export const CONFIG_USER_ID = '00000000-0000-0000-0000-000000000000';
const LOCAL_WEBHOOK_KEY = 'settings_webhook_config';

export async function getWebhookConfig(): Promise<WebhookConfig> {
  const localVal = localStorage.getItem(LOCAL_WEBHOOK_KEY);
  let config: WebhookConfig = { enabled: false, type: 'none', url: '' };
  
  if (localVal) {
    try {
      config = JSON.parse(localVal);
    } catch {}
  }

  const isCloudEnabled = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
  if (!isCloudEnabled) return config;

  try {
    const { data, error } = await supabase
      .from('users')
      .select('permissions')
      .eq('id', CONFIG_USER_ID)
      .single();
      
    if (data && data.permissions && (data.permissions as any).webhook) {
      const dbConfig = (data.permissions as any).webhook as WebhookConfig;
      localStorage.setItem(LOCAL_WEBHOOK_KEY, JSON.stringify(dbConfig));
      return dbConfig;
    }
  } catch (err) {
    console.error('Error fetching webhook config from DB:', err);
  }
  
  return config;
}

export async function saveWebhookConfig(config: WebhookConfig): Promise<boolean> {
  localStorage.setItem(LOCAL_WEBHOOK_KEY, JSON.stringify(config));
  
  const isCloudEnabled = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
  if (!isCloudEnabled) return true;

  try {
    const payload = {
      id: CONFIG_USER_ID,
      name: 'Configuração do Sistema',
      username: 'system_config',
      password: 'system',
      email: 'system@config.local',
      role: 'Administrador',
      area: 'Projetos',
      color: '#000000',
      permissions: {
        webhook: config
      }
    };
    
    const { error } = await supabase.from('users').upsert(payload);
    if (error) {
      console.error('Error saving webhook config to DB:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error in saveWebhookConfig:', err);
    return false;
  }
}

export async function sendWebhookNotification(message: string): Promise<boolean> {
  const config = await getWebhookConfig();
  if (!config.enabled || config.type === 'none' || (!config.url && config.type !== 'telegram')) return false;

  try {
    if (config.type === 'discord') {
      const res = await fetch(config.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: message,
          username: 'Agenda 103Ki',
          avatar_url: 'https://costalog.com.br/wp-content/uploads/2024/12/lsl-transportes.webp'
        })
      });
      return res.ok;
    }
    
    if (config.type === 'slack') {
      const res = await fetch(config.url, {
        method: 'POST',
        body: JSON.stringify({ text: message })
      });
      return res.ok;
    }

    if (config.type === 'teams') {
      // Power Automate bloqueia CORS do browser.
      // Usamos a Supabase Edge Function como proxy server-side.
      try {
        const { data, error } = await supabase.functions.invoke('send-webhook', {
          body: {
            webhookUrl: config.url,
            message,
            type: 'teams',
          },
        });
        if (error) {
          console.error('Edge Function error:', error);
          return false;
        }
        return !!(data?.ok);
      } catch (err) {
        console.error('Erro ao invocar Edge Function para Teams:', err);
        return false;
      }
    }

    if (config.type === 'telegram' && config.telegramToken && config.telegramChatId) {
      const res = await fetch(`https://api.telegram.org/bot${config.telegramToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: config.telegramChatId,
          text: message,
          parse_mode: 'HTML'
        })
      });
      return res.ok;
    }
  } catch (err) {
    console.error('Error sending webhook notification:', err);
  }
  return false;
}


// ─── Helpers ──────────────────────────────────────────────

/** Returns set of activity IDs already notified today */
function getNotifiedTodaySet(): Set<string> {
  const today = new Date().toISOString().slice(0, 10);
  const savedDate = localStorage.getItem(NOTIFIED_DATE_KEY);

  // Reset if it's a new day
  if (savedDate !== today) {
    localStorage.setItem(NOTIFIED_DATE_KEY, today);
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify([]));
    return new Set<string>();
  }

  try {
    const ids = JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '[]') as string[];
    return new Set(ids);
  } catch {
    return new Set<string>();
  }
}

function markAsNotified(ids: string[]) {
  const current = getNotifiedTodaySet();
  ids.forEach(id => current.add(id));
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...current]));
}

// ─── Permission ───────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

// ─── Core logic ───────────────────────────────────────────

function getWeekOfMonthString(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  const firstDay = new Date(y, m, 1);
  const firstDayOfWeek = firstDay.getDay();
  const offset = (firstDayOfWeek + 6) % 7;
  const weekNum = Math.ceil((d + offset) / 7);
  const ptMonths = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `W${weekNum > 5 ? 5 : weekNum} - ${ptMonths[m]}`;
}

export interface OverdueActivity {
  activity: Activity;
  responsible: User | undefined;
  daysLate: number;
}

/** Calculates which activities are overdue right now */
export function getOverdueActivities(activities: Activity[], users: User[]): OverdueActivity[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentWeekLabel = getWeekOfMonthString(today);

  return activities
    .filter(a => {
      if (!a.dataPrevistaFinalizacao) return false;
      if (a.status === 'FINALIZADA' || a.status === 'CANCELADA') return false;

      // Filter: only display delays of the current week
      const actWeek = a.week || (a.planejamento ? getWeekOfMonthString(new Date(a.planejamento + 'T00:00:00')) : '');
      if (actWeek !== currentWeekLabel) return false;

      const due = new Date(a.dataPrevistaFinalizacao + 'T00:00:00');
      return due < today;
    })
    .map(a => {
      const due = new Date(a.dataPrevistaFinalizacao + 'T00:00:00');
      const diffMs = today.getTime() - due.getTime();
      const daysLate = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const responsible = users.find(u => u.id === a.responsavel);
      return { activity: a, responsible, daysLate };
    })
    .sort((a, b) => b.daysLate - a.daysLate); // Most late first
}

// ─── Fire Windows Notifications ───────────────────────────

export async function fireOverdueNotifications(
  activities: Activity[],
  users: User[]
): Promise<number> {
  if (!('Notification' in window)) return 0;
  if (Notification.permission !== 'granted') return 0;

  const overdue = getOverdueActivities(activities, users);
  if (overdue.length === 0) return 0;

  const alreadyNotified = getNotifiedTodaySet();
  const toNotify = overdue.filter(o => !alreadyNotified.has(o.activity.id));
  if (toNotify.length === 0) return 0;

  // Group by responsible for a cleaner summary notification
  const byUser: Record<string, OverdueActivity[]> = {};
  toNotify.forEach(o => {
    const key = o.responsible?.name || 'Sem responsável';
    if (!byUser[key]) byUser[key] = [];
    byUser[key].push(o);
  });

  // Fire one notification per responsible (max 5 to avoid spam)
  const keys = Object.keys(byUser).slice(0, 5);
  for (const userName of keys) {
    const group = byUser[userName];
    const count = group.length;
    const sample = group.slice(0, 2).map(o =>
      `• ${o.activity.descricao.substring(0, 45)} (${o.daysLate}d atraso)`
    ).join('\n');
    const more = count > 2 ? `\n+ ${count - 2} outra(s)` : '';

    const notification = new Notification(
      `⚠️ ${count} atividade${count > 1 ? 's' : ''} atrasada${count > 1 ? 's' : ''} — ${userName}`,
      {
        body: sample + more,
        icon: '/fav.png',
        tag: `overdue-${userName}`,
        requireInteraction: false,
        silent: false,
      }
    );

    // Click → focus/open the app tab
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }

  // If more than 5 responsible users, show a summary
  if (Object.keys(byUser).length > 5) {
    const remaining = Object.keys(byUser).length - 5;
    new Notification(`⚠️ Mais ${remaining} responsável(eis) com atividades atrasadas`, {
      body: 'Acesse o app para ver todos os detalhes.',
      icon: '/fav.png',
      tag: 'overdue-summary-extra',
    });
  }

  // Mark all as notified
  markAsNotified(toNotify.map(o => o.activity.id));
  return toNotify.length;
}
