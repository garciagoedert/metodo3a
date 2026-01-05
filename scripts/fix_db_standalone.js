
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
    console.log("Resetting 0 to NULL...");
    const { data, error } = await supabase
        .from('monthly_funnel_metrics')
        .update({ new_followers: null })
        .eq('new_followers', 0)
        .select();

    if (error) {
        console.error("Error:", error);
    } else {
        console.log(`Success! Updated ${data.length} rows.`);
    }
}

run();
