const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

try {
    const envLocal = fs.readFileSync('.env.local', 'utf8');
    const extract = (key) => envLocal.split('\n').find(l => l.startsWith(key))?.split('=')[1]?.trim();

    const url = extract('NEXT_PUBLIC_SUPABASE_URL');
    const key = extract('SUPABASE_SERVICE_ROLE_KEY');

    const supabase = createClient(url, key);

    async function run() {
        console.log("Atualizando status antigos para o novo fluxo...");
        
        const res1 = await supabase.from('roteiros').update({ status: 'em_gravacao' }).eq('status', 'aprovacao');
        console.log("Migração aprovacao -> em_gravacao concluída", res1.error || 'OK');
        
        const res2 = await supabase.from('roteiros').update({ status: 'gravado' }).eq('status', 'aprovado');
        console.log("Migração aprovado -> gravado concluída", res2.error || 'OK');
        
        console.log("Sucesso!");
    }
    run();
} catch(e) {
    console.error(e);
}
