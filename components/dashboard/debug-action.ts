'use server'
import { createAdminClient } from "@/lib/supabase/admin"

export async function debugTeamData() {
    const admin = createAdminClient()
    const logs: string[] = []

    logs.push("--- DEBUG TEAM MEMBERS ---")
    const { data: profiles } = await admin.from('profiles').select('*')
    logs.push(`All Profiles Count: ${profiles?.length}`)
    profiles?.forEach(p => {
        logs.push(`User: ${p.full_name}, ID: ${p.id}, Role: ${p.role}, Avatar: ${p.avatar_url?.substring(0, 20)}..., DeletedAt: ${p.deleted_at}`)
    })

    logs.push("--- DEBUG QUERY RESULT (filtered) ---")
    const { data: filtered } = await admin.from('profiles').select('*').is('deleted_at', null)
    logs.push(`Filtered Profiles Count: ${filtered?.length}`)
    filtered?.forEach(p => {
        logs.push(`Filtered User: ${p.full_name}`)
    })

    return logs
}
