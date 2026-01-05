
import { createAdminClient } from "@/lib/supabase/admin"

async function run() {
    console.log("Running fix...")
    const admin = createAdminClient()
    const { error } = await admin
        .from('monthly_funnel_metrics')
        .update({ new_followers: null })
        .eq('new_followers', 0)

    if (error) {
        console.error("Error:", error)
    } else {
        console.log("Success: Reset 0 values to NULL")
    }
}

run()
