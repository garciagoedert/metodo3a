'use server'

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath, unstable_noStore as noStore } from "next/cache"

export async function getMonthlyComments(accountId: string, month: string) {
    const admin = createAdminClient()

    // Using admin client to ensure we get profile data (avoid RLS issues on join)
    // We can't use RLS for profiles join if profiles are private/restricted?
    // Actually, profiles usually readable by authenticated.
    // Use admin for safety if needed, but RLS on comments should hold.
    // Sticking to client for comments to respect policies, but admin for profile join could be tricky in one query.
    // Let's use current method but fix mapping.

    const { data } = await admin
        .from('monthly_comments')
        .select(`
            id,
            content,
            headline,
            created_at,
            author_id,
            profiles (
                full_name,
                avatar_url,
                role
            )
        `)
        .eq('ad_account_id', accountId)
        .eq('month', month)
        .order('created_at', { ascending: false })

    if (!data) return []

    return data.map(item => {
        const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles
        return {
            id: item.id,
            content: item.content,
            headline: item.headline,
            created_at: item.created_at,
            author: profile ? {
                full_name: profile.full_name,
                avatar_url: profile.avatar_url,
                role: profile.role
            } : null
        }
    })
}

export async function getTeamMembers() {
    const admin = createAdminClient()
    const { data } = await admin
        .from('profiles')
        .select('*')
        .is('deleted_at', null)
        .order('full_name')

    // JS filter as backup
    return (data || []).filter(p => !p.deleted_at)
}

export async function addComment(accountId: string, month: string, content: string, headline?: string, authorId?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: "Unauthorized" }

    const admin = createAdminClient()

    const { error } = await admin
        .from('monthly_comments')
        .insert({
            ad_account_id: accountId,
            month: month,
            author_id: authorId || user.id,
            content: content,
            headline: headline || null
        })

    if (error) {
        console.error("Error adding comment:", error)
        return { error: error.message }
    }

    revalidatePath('/share')
    return { success: true }
}

export async function deleteComment(commentId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Unauthorized" }

    const admin = createAdminClient()

    const { error } = await admin
        .from('monthly_comments')
        .delete()
        .eq('id', commentId)

    if (error) return { error: error.message }

    revalidatePath('/share')
    return { success: true }
}

export async function updateComment(commentId: string, content: string, headline?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: "Unauthorized" }

    const admin = createAdminClient()

    const { error } = await admin
        .from('monthly_comments')
        .update({
            content: content,
            headline: headline || null
        })
        .eq('id', commentId)

    if (error) {
        console.error("Error updating comment:", error)
        return { error: error.message }
    }

    revalidatePath('/share')
    return { success: true }
}
