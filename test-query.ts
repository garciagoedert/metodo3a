import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const admin = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await admin
        .from('roteiros')
        .select(`
            *,
            roteiro_comments(count)
        `)
        .limit(1);
    console.log(JSON.stringify(data, null, 2));
}
run();
