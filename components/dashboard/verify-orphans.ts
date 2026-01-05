'use server'
import { createAdminClient } from "@/lib/supabase/admin"

export async function verifyAndCleanOrphans() {
    const admin = createAdminClient()
    const logs: string[] = []

    // 1. Get all profiles
    const { data: profiles } = await admin.from('profiles').select('*').is('deleted_at', null)
    if (!profiles) return ["No profiles found"]

    // 2. Get all auth users
    const { data: { users }, error } = await admin.auth.admin.listUsers()
    if (error) return [`Auth Error: ${error.message}`]

    const authIds = new Set(users.map(u => u.id))
    const orphans = profiles.filter(p => !authIds.has(p.id))

    logs.push(`Total Profiles: ${profiles.length}`)
    logs.push(`Total Auth Users: ${users.length}`)
    logs.push(`Orphans Found: ${orphans.length}`)

    orphans.forEach(o => {
        logs.push(`Orphan: ${o.full_name} (${o.role}) - ID: ${o.id}`)
    })

    // 3. Mark orphans as deleted
    if (orphans.length > 0) {
        const orphanIds = orphans.map(o => o.id)
        const { error: updateError } = await admin
            .from('profiles')
            .update({ deleted_at: new Date().toISOString() })
            .in('id', orphanIds)

        if (updateError) {
            logs.push(`Error cleaning orphans: ${updateError.message}`)
        } else {
            logs.push(`Successfully soft-deleted ${orphans.length} orphans.`)
        }
    }

    return logs
}
