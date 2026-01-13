
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

// Load env
const envPath = path.resolve(__dirname, '../.env.local')
const envFile = fs.readFileSync(envPath, 'utf8')
const envConfig = Object.fromEntries(
    envFile.split('\n').map(line => line.split('=').map(p => p.trim()))
)

const supabaseUrl = envConfig['NEXT_PUBLIC_SUPABASE_URL']
const supabaseServiceKey = envConfig['SUPABASE_SERVICE_ROLE_KEY']

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase credentials")
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
    // 1. Get connect account ID from user (approximate)
    // Or just list all metrics and let me infer
    console.log("Fetching all monthly_funnel_metrics...")

    const { data, error } = await supabase
        .from('monthly_funnel_metrics')
        .select('*')
        .order('month_start', { ascending: true })

    if (error) {
        console.error(error)
        return
    }

    let output = `Found ${data.length} rows.\n`
    data.forEach(row => {
        output += `- Account: ${row.ad_account_id} | Month: ${row.month_start} | Followers: ${row.new_followers} (Type: ${typeof row.new_followers}) | Scheduled: ${row.appointments_scheduled}\n`
    })

    fs.writeFileSync('debug_metrics_output.txt', output)
    console.log("Written to debug_metrics_output.txt")
}

main()
