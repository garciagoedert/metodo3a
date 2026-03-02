import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/roteiros?select=id,roteiro_comments(count)&limit=1`;

async function run() {
    const res = await fetch(url, {
        headers: {
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
        }
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

run();
