import fs from 'fs';

let env = '';
try { env = fs.readFileSync('.env.local', 'utf-8'); } catch {}
try { if(!env) env = fs.readFileSync('.env', 'utf-8'); } catch {}

let url = '';
let key = '';

env.split('\n').forEach(line => {
  if (line.includes('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.includes('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
});

url = url.replace(/["']/g, '');
key = key.replace(/["']/g, '');

fetch(url + '/rest/v1/activities?planejamento=gte.2026-04-04', {
  method: 'DELETE',
  headers: { 
    'apikey': key, 
    'Authorization': 'Bearer ' + key,
    'Prefer': 'return=representation'
  }
}).then(async r => {
  if (!r.ok) {
    console.error("Erro na exclusão:", await r.text());
    return;
  }
  const deleted = await r.json();
  console.log(`Sucesso: ${deleted.length} atividades com data de início a partir de 04/04 foram removidas com sucesso.`);
}).catch(console.error);
