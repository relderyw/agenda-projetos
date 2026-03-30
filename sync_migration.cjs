const fs = require('fs');
const activities = JSON.parse(fs.readFileSync('activities.json', 'utf8'));

// Generate MIGRATION_ACTIVITIES string
const themes = [...new Set(activities.map(a => a.themeName).filter(Boolean))];
const users = [...new Set(activities.map(a => a.userName).filter(Boolean))];

// Themes Mapping (Reuse colors)
const COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444',
  '#06b6d4', '#f97316', '#ec4899', '#6366f1', '#14b8a6',
  '#84cc16', '#a855f7'
];

const themesData = themes.map((t, i) => ({ name: t, color: COLORS[i % COLORS.length] }));
const usersData = users.map((u, i) => ({ 
  name: u, 
  username: u.toLowerCase().replace(' ', '_'), 
  password: '123', 
  role: 'Analista', 
  email: `${u.toLowerCase().replace(' ', '_')}@lslgr.com.br`, 
  color: COLORS[i % COLORS.length],
  permissions: { atividades: { view: true, edit: true, delete: true }, henkatens: { view: true, edit: true, delete: false }, cadastros: { view: false, edit: false, delete: false }, usuarios: { view: false, edit: false, delete: false } } 
}));

const content = `import type { Theme, User, Activity } from '../types';

export const MIGRATION_THEMES: Omit<Theme, 'id'>[] = ${JSON.stringify(themesData, null, 2)};

export const MIGRATION_USERS: Omit<User, 'id'>[] = ${JSON.stringify(usersData, null, 2)};

export const MIGRATION_ACTIVITIES: any[] = ${JSON.stringify(activities, null, 2)};
`;

fs.writeFileSync('src/services/migrationData.ts', content);
console.log('Success: migrationData.ts updated with ' + activities.length + ' activities.');
