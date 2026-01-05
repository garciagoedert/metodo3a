
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
try {
    const envContent = fs.readFileSync(envPath, 'utf8');

    const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
    const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);

    if (!urlMatch || !keyMatch) {
        console.error("Could not find credentials in .env.local");
        process.exit(1);
    }

    // Handle quoted values if present
    const clean = (val) => val.trim().replace(/^["']|["']$/g, '');
    const url = clean(urlMatch[1]);
    const key = clean(keyMatch[1]);

    async function run() {
        // Query param: new_followers=eq.0
        const endpoint = `${url}/rest/v1/monthly_funnel_metrics?new_followers=eq.0`;
        console.log("Patching zero values...");

        // Native fetch (Node 18+)
        const response = await fetch(endpoint, {
            method: 'PATCH',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({ new_followers: null })
        });

        if (!response.ok) {
            console.error("Error:", response.status, await response.text());
            process.exit(1);
        }

        const data = await response.json();
        console.log(`Success! Updated ${data.length} rows.`);
    }

    run();
} catch (err) {
    console.error("Failed to read .env.local:", err.message);
    process.exit(1);
}
