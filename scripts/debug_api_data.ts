
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Manually load env
try {
    const envPath = path.resolve(process.cwd(), '.env.local')
    if (fs.existsSync(envPath)) {
        const envFile = fs.readFileSync(envPath, 'utf8')
        envFile.split('\n').forEach((line: string) => {
            const [key, ...values] = line.split('=')
            if (key && values.length > 0) {
                const val = values.join('=').trim().replace(/^["']|["']$/g, '')
                process.env[key.trim()] = val
            }
        })
    }
} catch (e) { }

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl) return

    const admin = createClient(supabaseUrl, supabaseKey)

    const { data: { users }, error } = await admin.auth.admin.listUsers()

    if (error) {
        console.error("Error listing users:", error)
        return
    }

    console.log("Found Users:")
    users.forEach((u: any) => console.log(`- ${u.email}`))
}

run()
