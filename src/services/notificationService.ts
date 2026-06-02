import type { Activity, User } from '../types';

const NOTIFIED_KEY = 'overdue_notified_ids';
const NOTIFIED_DATE_KEY = 'overdue_notified_date';

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

export interface OverdueActivity {
  activity: Activity;
  responsible: User | undefined;
  daysLate: number;
}

/** Calculates which activities are overdue right now */
export function getOverdueActivities(activities: Activity[], users: User[]): OverdueActivity[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return activities
    .filter(a => {
      if (!a.dataPrevistaFinalizacao) return false;
      if (a.status === 'FINALIZADA' || a.status === 'CANCELADA') return false;

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
