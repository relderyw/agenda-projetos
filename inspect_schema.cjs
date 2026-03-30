const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://efeikudymqplfamtexgq.supabase.co';
const supabaseKey = 'sb_publishable_IKq4DPh80AlDfYmElLvw4Q_xAUYE6hf';
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    console.log('--- Inspecionando colunas da tabela "activities" ---');
    // We try to select one row or just check errors
    const { data, error } = await supabase.from('activities').select('*').limit(1);
    if (error) {
        console.error('Erro na inspeção:', error);
    } else {
        console.log('Colunas reais:', data.length > 0 ? Object.keys(data[0]) : 'Tabela vazia');
        // If empty, try to get columns via a different trick
        const { data: cols, error: err2 } = await supabase.rpc('get_table_columns', { table_name: 'activities' });
        if (err2) console.log('RPC falhou (esperado se não existir):', err2.message);
        else console.log('Colunas via RPC:', cols);
    }
}
inspect();
