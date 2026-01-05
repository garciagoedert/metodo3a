'use server'
import { createAdminClient } from "@/lib/supabase/admin"

export async function syncAvatars() {
    const admin = createAdminClient()
    const logs: string[] = []

    // 1. Get all profiles
    const { data: profiles } = await admin.from('profiles').select('*')
    // 2. Get all auth users
    const { data: { users } } = await admin.auth.admin.listUsers()

    if (!profiles || !users) return ["Error fetching data"]

    logs.push(`Found ${profiles.length} profiles and ${users.length} auth users.`)

    let updatedCount = 0

    for (const user of users) {
        const profile = profiles.find(p => p.id === user.id)
        if (profile) {
            // Check if profile avatar is missing but metadata has it
            const metadataAvatar = user.user_metadata?.avatar_url
            if (!profile.avatar_url && metadataAvatar) {
                // Update profile
                const { error } = await admin
                    .from('profiles')
                    .update({ avatar_url: metadataAvatar })
                    .eq('id', user.id)

                if (error) {
                    logs.push(`Failed to update ${user.email}: ${error.message}`)
                } else {
                    logs.push(`Updated avatar for ${user.email}`)
                    updatedCount++
                }
            }
        }
    }

    logs.push(`Sync complete. Updated ${updatedCount} profiles.`)
    return logs
}
