import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL\s*=\s*(['"]?)(.*?)\1/);
const keyMatch = env.match(/VITE_SUPABASE_PUB_KEY\s*=\s*(['"]?)(.*?)\1/);

const url = urlMatch ? urlMatch[2].trim() : '';
const key = keyMatch ? keyMatch[2].trim() : '';

fetch(url + '/rest/v1/activities?select=descricao,planejamento,data_prevista_finalizacao,status', {
  headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
}).then(async r => {
  if (!r.ok) {
    console.error("HTTP error:", await r.text());
    return;
  }
  const data = await r.json();
  const nextWeekActs = data.filter(a => (a.data_prevista_finalizacao && a.data_prevista_finalizacao >= '2026-04-06') || a.planejamento >= '2026-04-06');
  console.log("Next week acts:", nextWeekActs.map(a => `${a.descricao.slice(0, 30)}... | ${a.planejamento} -> ${a.data_prevista_finalizacao || 'null'}`));
}).catch(console.error);
