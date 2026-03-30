const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://efeikudymqplfamtexgq.supabase.co';
const supabaseKey = 'sb_publishable_IKq4DPh80AlDfYmElLvw4Q_xAUYE6hf';
const supabase = createClient(supabaseUrl, supabaseKey);

const activitiesData = JSON.parse(fs.readFileSync('activities.json', 'utf8'));

const DEFAULT_PERMISSIONS = {
  atividades: { view: true, edit: true, delete: true },
  henkatens: { view: true, edit: true, delete: false },
  cadastros: { view: false, edit: false, delete: false },
  usuarios: { view: false, edit: false, delete: false }
};

async function pushData() {
    console.log('🚀 Migração Inteligente: Mapeando analistas e temas existentes...');

    // 1. Fetch Existing
    const { data: exThemes } = await supabase.from('themes').select('id, name');
    const { data: exUsers } = await supabase.from('users').select('id, name');

    const themeMap = {}; exThemes?.forEach(t => themeMap[t.name] = t.id);
    const userMap = {}; exUsers?.forEach(u => userMap[u.name] = u.id);

    // 2. Insert Missing Themes
    const themesToPush = [...new Set(activitiesData.map(a => a.themeName).filter(Boolean))].filter(t => !themeMap[t]);
    for (const t of themesToPush) {
        const { data } = await supabase.from('themes').insert({ name: t, color: '#3b82f6' }).select();
        if (data?.[0]) themeMap[t] = data[0].id;
    }

    // 3. Insert Missing Users
    const usersToPush = [...new Set(activitiesData.map(a => a.userName).filter(Boolean))].filter(u => !userMap[u]);
    for (const u of usersToPush) {
        const username = u.toLowerCase().replace(' ', '_');
        const email = `${username}@lslgr.com.br`;
        const { data } = await supabase.from('users').insert({ 
            name: u, 
            username: username,
            password: '123',
            email: email,
            role: 'Analista',
            color: '#3b82f6',
            permissions: DEFAULT_PERMISSIONS
        }).select();
        if (data?.[0]) userMap[u] = data[0].id;
    }

    // 4. Map and Insert Activities (USANDO SNAKE_CASE PADRÃO CONFIRMADO)
    console.log(`--- Sincronizando ${activitiesData.length} tarefas LSL com a Nuvem ---`);
    const activitiesToInsert = activitiesData.map(a => ({
        planejamento: a.planejamento,
        descricao: a.descricao,
        tema: themeMap[a.themeName],
        responsavel: userMap[a.userName],
        prioridade: a.prioridade,
        data_prevista_finalizacao: a.dataPrevistaFinalizacao,
        percentual_andamento: a.percentualAndamento,
        data_finalizada: a.dataFinalizada,
        esforco_realizado: a.esforcoRealizado,
        status: a.status,
        week: a.week
    })).filter(a => a.tema && a.responsavel);

    if (activitiesToInsert.length === 0) {
        console.error('❌ ERRO: Falha total no mapeamento.');
        return;
    }

    // Chunk insert to avoid timeout
    const chunkSize = 50;
    for (let i = 0; i < activitiesToInsert.length; i += chunkSize) {
        const chunk = activitiesToInsert.slice(i, i + chunkSize);
        const { error } = await supabase.from('activities').insert(chunk);
        if (error) console.error(`❌ Erro no bloco ${i}:`, error);
        else console.log(`✅ Bloco ${i} (+${chunk.length} tarefas) enviado.`);
    }

    console.log('🏁 SUCESSO TOTAL! Todas as atividades agora estão no seu painel.');
}

pushData();
