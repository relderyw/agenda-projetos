const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://efeikudymqplfamtexgq.supabase.co';
const supabaseKey = 'sb_publishable_IKq4DPh80AlDfYmElLvw4Q_xAUYE6hf';
const supabase = createClient(supabaseUrl, supabaseKey);

async function discovery() {
    console.log('--- Iniciando Descoberta de Campos (Brute Force) ---');
    
    const tryInsert = async (obj) => {
        const { error } = await supabase.from('activities').insert(obj);
        if (error) return error.message;
        return 'SUCCESS';
    };

    // 1. Basic
    const res1 = await tryInsert({ planejamento: '2026-03-31', descricao: 'Teste Sync' });
    console.log('Base (planejamento, descricao):', res1);

    // 2. Responsavel variants
    console.log('Responsavel?', await tryInsert({ responsavel: '...' }));
    console.log('responsaavel?', await tryInsert({ responsaavel: '...' }));

    // 3. Prioridade variants
    console.log('prioridade?', await tryInsert({ prioridade: 'Alta' }));
    console.log('prioridadede?', await tryInsert({ prioridadede: 'Alta' }));
    
    // 4. Snake Case variants
    console.log('data_prevista_finalizacao?', await tryInsert({ data_prevista_finalizacao: '2026-03-31' }));
    console.log('dataPrevistaFinalizacao?', await tryInsert({ dataPrevistaFinalizacao: '2026-03-31' }));
}
discovery();
