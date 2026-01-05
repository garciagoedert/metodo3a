
const { createClient } = require('@supabase/supabase-js')
const { differenceInDays, getDaysInMonth, startOfMonth, endOfMonth, max, min, parseISO } = require("date-fns")
const fs = require('fs')
const path = require('path')

// Manually load env
try {
    const envPath = path.resolve(process.cwd(), '.env.local')
    const envFile = fs.readFileSync(envPath, 'utf8')
    envFile.split('\n').forEach(line => {
        const [key, ...values] = line.split('=')
        if (key && values.length > 0) {
            const val = values.join('=').trim().replace(/^["']|["']$/g, '')
            process.env[key.trim()] = val
        }
    })
} catch (e) {
    console.error("Failed to load .env.local", e)
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Env Vars")
    process.exit(1)
}

const admin = createClient(supabaseUrl, supabaseKey)

async function run() {
    // 1. Get Account ID
    const { data: accounts } = await admin.from('ad_accounts').select('id, name').ilike('name', '%Kihap%')

    if (!accounts || accounts.length === 0) {
        console.error("Account not found")
        return
    }

    const account = accounts[0]
    console.log("Account:", account.name, account.id)

    // 2. Define Range
    const timeRange = {
        since: '2025-10-06',
        until: '2026-01-04'
    }

    const startMonth = timeRange.since.substring(0, 7) + '-01'
    const endMonth = timeRange.until.substring(0, 7) + '-01'

    console.log(`Querying: ${startMonth} to ${endMonth}`)

    // 3. Fetch Data
    const { data: metricsList, error } = await admin
        .from('monthly_funnel_metrics')
        .select('*')
        .eq('ad_account_id', account.id)
        .gte('month_start', startMonth)
        .lte('month_start', endMonth)

    if (error) {
        console.error("DB Error:", error)
        return
    }

    console.log("Found Rows:", metricsList?.length)
    if (metricsList) {
        metricsList.forEach(m => console.log(` - ${m.month_start}: Sched=${m.appointments_scheduled}, Show=${m.appointments_showed}`))
    } else {
        console.log("No metrics list found.")
    }

    // ... (rest of logic can be skipped if zero rows found, but good to keep)
}

run()
