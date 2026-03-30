const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://efeikudymqplfamtexgq.supabase.co';
const supabaseKey = 'sb_publishable_IKq4DPh80AlDfYmElLvw4Q_xAUYE6hf';
const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanDuplicates() {
    console.log('--- 🧹 Limpeza de Temas e Usuários Duplicados ---');

    // 1. LIMPAR TEMAS
    const { data: themes } = await supabase.from('themes').select('id, name');
    const themeGroups = {};
    themes.forEach(t => {
        if (!themeGroups[t.name]) themeGroups[t.name] = [];
        themeGroups[t.name].push(t.id);
    });

    for (const name in themeGroups) {
        const ids = themeGroups[name];
        if (ids.length > 1) {
            const primaryId = ids[0];
            const duplicateIds = ids.slice(1);
            console.log(`Limpando duplicado: "${name}" (${duplicateIds.length} encontrados)`);
            
            // Remapear atividades
            const { error: remapErr } = await supabase.from('activities')
                .update({ tema: primaryId })
                .in('tema', duplicateIds);
            
            if (!remapErr) {
                // Deletar temas duplicados
                await supabase.from('themes').delete().in('id', duplicateIds);
                console.log(`✅ Duplicados removidos para "${name}".`);
            } else {
                console.error(`❌ Erro ao remapear atividades de "${name}":`, remapErr.message);
            }
        }
    }

    // 2. LIMPAR USUÁRIOS (Mesma lógica)
    const { data: users } = await supabase.from('users').select('id, name');
    const userGroups = {};
    users.forEach(u => {
        if (!userGroups[u.name]) userGroups[u.name] = [];
        userGroups[u.name].push(u.id);
    });

    for (const name in userGroups) {
        const ids = userGroups[name];
        if (ids.length > 1) {
            const primaryId = ids[0];
            const duplicateIds = ids.slice(1);
            console.log(`Limpando usuário duplicado: "${name}"`);
            
            // Remapear atividades (responsaavel)
            const { error: remapErr } = await supabase.from('activities')
                .update({ responsavel: primaryId })
                .in('responsavel', duplicateIds);
            
            if (!remapErr) {
                await supabase.from('users').delete().in('id', duplicateIds);
                console.log(`✅ Duplicados removidos para "${name}".`);
            }
        }
    }

    console.log('🏁 Limpeza massiva concluída com sucesso!');
}

cleanDuplicates();
