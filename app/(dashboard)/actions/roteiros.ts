'use server'

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

async function getAdAccountUUID(providerForId: string, adminClient: any) {
    if (!providerForId) {
        return null
    }

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(providerForId)

    const query = adminClient
        .from('ad_accounts')
        .select('id, provider_account_id')

    if (isUUID) {
        query.eq('id', providerForId)
    } else {
        query.eq('provider_account_id', providerForId)
    }

    const { data, error } = await query.single()

    if (error || !data) {
        return null
    }
    return data.id
}

export type Roteiro = {
    id: string
    account_id: string
    month_year: string
    title: string
    focus: string
    funnel_stage: string
    status: 'criacao' | 'aprovacao' | 'aprovado'
    content: string
    created_at: string
    updated_at: string
}

export async function getRoteiros(providerAccountId: string, months: string[]) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const admin = createAdminClient()
    const uuid = await getAdAccountUUID(providerAccountId, admin)
    if (!uuid) return []

    const { data, error } = await admin
        .from('roteiros')
        .select('*')
        .eq('account_id', uuid)
        .in('month_year', months)
        .order('created_at', { ascending: false })

    if (error) {
        console.error("Error fetching roteiros:", error)
        return []
    }
    return data as Roteiro[]
}

export async function getRoteiroById(id: string) {
    const admin = createAdminClient()
    const { data, error } = await admin
        .from('roteiros')
        .select('*')
        .eq('id', id)
        .single()

    if (error) {
        console.error("Error fetching roteiro details:", error)
        return null
    }
    return data as Roteiro
}

export async function saveRoteiro(providerAccountId: string, payload: Partial<Roteiro>) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Unauthorized" }

    const admin = createAdminClient()
    const uuid = await getAdAccountUUID(providerAccountId, admin)
    if (!uuid) return { error: "Account not found" }

    let error;
    let newId = payload.id;

    if (payload.id) {
        // Update existing
        const { error: updateError } = await admin
            .from('roteiros')
            .update({
                title: payload.title,
                focus: payload.focus,
                funnel_stage: payload.funnel_stage,
                status: payload.status,
                content: payload.content,
                month_year: payload.month_year,
                updated_at: new Date().toISOString()
            })
            .eq('id', payload.id)
            .eq('account_id', uuid)

        error = updateError
    } else {
        // Create new
        const { data: insertData, error: insertError } = await admin
            .from('roteiros')
            .insert({
                account_id: uuid,
                title: payload.title,
                focus: payload.focus,
                funnel_stage: payload.funnel_stage,
                status: payload.status || 'criacao',
                content: payload.content || '',
                month_year: payload.month_year
            })
            .select('id')
            .single()

        error = insertError
        if (insertData) newId = insertData.id
    }

    if (error) {
        console.error("Save Roteiro Error:", error)
        return { error: error.message }
    }

    revalidatePath('/roteiros')
    return { success: true, id: newId }
}

export async function moveRoteiro(id: string, newMonthYear: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Unauthorized" }

    const admin = createAdminClient()

    const { error } = await admin
        .from('roteiros')
        .update({
            month_year: newMonthYear,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)

    if (error) {
        console.error("Move Roteiro Error:", error)
        return { error: error.message }
    }

    revalidatePath('/roteiros')
    return { success: true }
}

export async function deleteRoteiro(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Unauthorized" }

    const admin = createAdminClient()

    const { error } = await admin
        .from('roteiros')
        .delete()
        .eq('id', id)

    if (error) {
        console.error("Delete Roteiro Error:", error)
        return { error: error.message }
    }

    revalidatePath('/roteiros')
    return { success: true }
}

export type RoteiroComment = {
    id: string
    roteiro_id: string
    user_id: string
    content: string
    created_at: string
    user?: {
        name: string
        avatar_url: string
    }
}

export async function getRoteiroComments(roteiroId: string) {
    const admin = createAdminClient()
    const { data: comments, error } = await admin
        .from('roteiro_comments')
        .select('*')
        .eq('roteiro_id', roteiroId)
        .order('created_at', { ascending: true })

    if (error) {
        console.error("Error fetching roteiro comments:", error)
        return []
    }

    // Enhance with user data
    const enhancedComments = await Promise.all(
        comments.map(async (comment) => {
            const { data: userData } = await admin.auth.admin.getUserById(comment.user_id)
            return {
                ...comment,
                user: {
                    name: userData?.user?.user_metadata?.full_name || userData?.user?.email?.split('@')[0] || 'Unknown User',
                    avatar_url: userData?.user?.user_metadata?.avatar_url || ''
                }
            }
        })
    )

    return enhancedComments as RoteiroComment[]
}

export async function addRoteiroComment(roteiroId: string, content: string, authorId?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Unauthorized" }

    const admin = createAdminClient()

    const { data, error } = await admin
        .from('roteiro_comments')
        .insert({
            roteiro_id: roteiroId,
            user_id: authorId || user.id,
            content
        })
        .select('*')
        .single()

    if (error) {
        console.error("Save Note Error:", error)
        return { error: error.message }
    }

    return { success: true, data }
}

export async function deleteRoteiroComment(commentId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Unauthorized" }

    const admin = createAdminClient()

    const { error } = await admin
        .from('roteiro_comments')
        .delete()
        .eq('id', commentId)
    // Let's remove the restriction that only the author can delete it, since admins/other selected authors might need to delete it.
    // Or keep it but allow admins. For now, we just delete by ID.

    if (error) {
        console.error("Delete comment error:", error)
        return { error: error.message }
    }

    return { success: true }
}

export async function getAdminAccountMonthNotes(providerAccountId: string, months: string[]) {
    const admin = createAdminClient()
    const uuid = await getAdAccountUUID(providerAccountId, admin)
    if (!uuid) return []

    const { data, error } = await admin
        .from('account_month_notes')
        .select(`
            *,
            profiles (
                full_name,
                avatar_url
            )
        `)
        .eq('account_id', uuid)
        .in('month_year', months)

    if (error) {
        console.error('Failed to get account month notes:', error)
        return []
    }

    return (data || []).map((note: any) => {
        const profile = Array.isArray(note.profiles) ? note.profiles[0] : note.profiles
        return {
            ...note,
            author_name: profile?.full_name || note.author_name,
            author_avatar_url: profile?.avatar_url || null
        }
    })
}

export async function saveAdminAccountMonthNote(providerAccountId: string, monthYear: string, content: string, authorId: string = "") {
    if (!providerAccountId || !monthYear) return { error: "Parâmetros inválidos" }

    const admin = createAdminClient()
    const uuid = await getAdAccountUUID(providerAccountId, admin)
    if (!uuid) return { error: "Account not found" }

    // Check if exists
    const { data: existing } = await admin
        .from('account_month_notes')
        .select('id')
        .eq('account_id', uuid)
        .eq('month_year', monthYear)
        .single()

    if (existing) {
        if (!content.trim()) {
            const { error } = await admin.from('account_month_notes').delete().eq('id', existing.id)
            if (error) return { error: "Erro ao remover comentário" }
        } else {
            const { error } = await admin
                .from('account_month_notes')
                .update({ content, author_id: authorId || null, updated_at: new Date().toISOString() })
                .eq('id', existing.id)
            if (error) return { error: "Erro ao atualizar comentário" }
        }
    } else if (content.trim()) {
        const { error } = await admin
            .from('account_month_notes')
            .insert({
                account_id: uuid,
                month_year: monthYear,
                content,
                author_id: authorId || null
            })
        if (error) return { error: "Erro ao salvar comentário" }
    }

    revalidatePath('/(dashboard)/roteiros', 'page')
    return { success: true }
}

export async function saveRoteirosNotice(providerAccountId: string, notice: string | null) {
    if (!providerAccountId) return { error: "Conta inválida" }

    const admin = createAdminClient()
    const uuid = await getAdAccountUUID(providerAccountId, admin)
    if (!uuid) return { error: "Account not found" }

    const { error } = await admin
        .from('ad_accounts')
        .update({ roteiros_notice: notice })
        .eq('id', uuid)

    if (error) return { error: "Erro ao salvar aviso" }

    revalidatePath('/(dashboard)/roteiros', 'page')
    return { success: true }
}
