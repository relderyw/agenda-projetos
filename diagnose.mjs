import fs from 'fs';

const envLines = fs.readFileSync('.env.local', 'utf-8').split(/\r?\n/);
let url = '';
let key = '';
for (const line of envLines) {
  if (line.startsWith('VITE_SUPABASE_URL=')) {
    url = line.split('=')[1].trim();
  }
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) {
    key = line.split('=')[1].trim();
  }
}

console.log("Supabase URL:", url);

async function testTable(tableName) {
  try {
    const res = await fetch(`${url}/rest/v1/${tableName}?select=*&limit=1`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    console.log(`Table ${tableName} GET status:`, res.status);
    if (!res.ok) {
      console.log(`Table ${tableName} GET error:`, await res.text());
    } else {
      const data = await res.json();
      console.log(`Table ${tableName} GET data sample:`, data);
    }
  } catch (err) {
    console.error(`Table ${tableName} connection error:`, err.message);
  }
}

async function testInsert() {
  const board = { id: `diag-${Date.now()}`, name: 'DIAGNOSTIC BOARD', order: 999 };
  try {
    const res = await fetch(`${url}/rest/v1/staffing_boards`, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(board)
    });
    console.log("Insert Test POST status:", res.status);
    console.log("Insert Test POST response:", await res.text());
  } catch (err) {
    console.error("Insert Test error:", err.message);
  }
}

async function run() {
  await testTable('staffing_boards');
  await testTable('staffing_columns');
  await testTable('staffing_rows');
  await testTable('staffing_cells');
  await testInsert();
}

run();
