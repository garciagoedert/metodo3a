'use server'

import { createAdminClient } from "@/lib/supabase/admin"
import { headers } from "next/headers"
import { DEMO_ACCOUNT_ID, DEMO_PUBLIC_TOKEN, DEMO_DB_ID } from "@/lib/demo-data"

export async function getPublicLink(providerAccountId: string) {
    // Intercept Demo Account
    if (providerAccountId === DEMO_ACCOUNT_ID) {
        const headersList = await headers()
        const host = headersList.get("host") || "localhost:3000"
        const protocol = process.env.NODE_ENV === "development" ? "http" : "https"
        return { url: `${protocol}://${host}/share/${DEMO_PUBLIC_TOKEN}` }
    }

    if (!providerAccountId) return { error: "Account ID not provided" }

    const admin = createAdminClient()

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(providerAccountId)

    const query = admin
        .from('ad_accounts')
        .select('public_token')

    if (isUUID) {
        query.eq('id', providerAccountId)
    } else {
        query.eq('provider_account_id', providerAccountId)
    }

    // 1. Fetch existing token
    const { data: account, error } = await query.single()

    if (error) {
        console.error("Error fetching public token:", error)
        return { error: "Failed to fetch account settings" }
    }

    let token = account.public_token

    // NOTE: We assume 'public_token' was created by default gen_random_uuid().
    // If null (old row + no migration?), we might need to generate one. 
    // But user ran SQL with Default.

    // Fallback if null (Paranoia check or manual insert without default)
    if (!token) {
        // ... (Skipping generation logic for now, assuming DB handled it. 
        // If really needed, we'd update here, but let's trust the schema first)
        return { error: "Public token not found. Please contact support." }
    }

    // 2. Construct URL
    const headersList = await headers()
    const host = headersList.get("host") || "localhost:3000"
    const protocol = process.env.NODE_ENV === "development" ? "http" : "https"

    const url = `${protocol}://${host}/share/${token}`

    return { url }
}

export async function getAccountByToken(token: string) {
    // Intercept Demo Token
    if (token === DEMO_PUBLIC_TOKEN) {
        return {
            account: {
                provider_account_id: DEMO_ACCOUNT_ID,
                name: 'Conta Demo Institucional',
                id: DEMO_DB_ID,
                public_token: DEMO_PUBLIC_TOKEN,
                roteiros_notice: null
            }
        }
    }

    if (!token) return { error: "Token not provided" }

    const admin = createAdminClient()
    const { data, error } = await admin
        .from('ad_accounts')
        .select('provider_account_id, name, id, roteiros_notice, status')
        .eq('public_token', token)
        .single()

    if (error || !data) return { error: "Invalid or expired link" }

    return { account: data }
}

export async function getAllPublicRoteiros(token: string) {
    // Intercept Demo Token
    let accountId = null;

    if (token === DEMO_PUBLIC_TOKEN) {
        accountId = DEMO_DB_ID;
    } else {
        const admin = createAdminClient()
        const { data, error } = await admin
            .from('ad_accounts')
            .select('id')
            .eq('public_token', token)
            .single()

        if (error || !data) return []
        accountId = data.id
    }

    if (!accountId) return []

    const admin = createAdminClient()
    const { data, error } = await admin
        .from('roteiros')
        .select(`
            *,
            roteiro_comments:roteiro_comments(count)
        `)
        .eq('account_id', accountId)
        // Public view only sees roteiros that are sent for approval or already approved
        .neq('status', 'criacao')
        .order('created_at', { ascending: false })

    if (error) {
        console.error("Error fetching public roteiros:", error)
        return []
    }
    return data as any[]
}

export async function submitRoteiroApproval(token: string, roteiroId: string, action: 'approve' | 'request_changes', comment?: string) {
    if (!token || !roteiroId) return { error: "Invalid request" }

    const admin = createAdminClient()

    // 1. Validate Token owns this Roteiro
    const { data: account, error: accountError } = await admin
        .from('ad_accounts')
        .select('id')
        .eq('public_token', token)
        .single()

    if (accountError || !account) return { error: "Invalid token" }

    const { data: roteiro, error: roteiroError } = await admin
        .from('roteiros')
        .select('id')
        .eq('id', roteiroId)
        .eq('account_id', account.id)
        .single()

    if (roteiroError || !roteiro) return { error: "Roteiro not found or access denied" }

    // 2. Perform the action
    const newStatus = action === 'approve' ? 'aprovado' : 'criacao' // If change requested, it goes back to creation phase

    const { error: updateError } = await admin
        .from('roteiros')
        .update({ status: newStatus })
        .eq('id', roteiroId)

    if (updateError) return { error: "Failed to update roteiro" }

    // 3. (Optional) Could insert a comment into reteiro_comments if comment provided

    return { success: true, newStatus }
}

export async function getPublicRoteiroCommentCount(token: string, roteiroId: string) {
    if (!token || !roteiroId) return { count: 0 }

    const admin = createAdminClient()
    const { data: account } = await admin
        .from('ad_accounts')
        .select('id')
        .eq('public_token', token)
        .single()

    if (!account) return { count: 0 }

    // Verify roteiro belongs to account
    const { data: route } = await admin
        .from('roteiros')
        .select('id')
        .eq('id', roteiroId)
        .eq('account_id', account.id)
        .single()

    if (!route) return { count: 0 }

    const { count, error } = await admin
        .from('roteiro_comments')
        .select('id', { count: 'exact', head: true })
        .eq('roteiro_id', roteiroId)

    if (error) {
        console.error("Error fetching comment count:", error)
        return { count: 0 }
    }

    return { count: count || 0 }
}

export async function getAccountMonthNotes(token: string) {
    if (!token) return []

    const admin = createAdminClient()

    // Validate Token
    const { data: account, error: accountError } = await admin
        .from('ad_accounts')
        .select('id')
        .eq('public_token', token)
        .single()

    if (accountError || !account) return []

    const { data, error } = await admin
        .from('account_month_notes')
        .select(`
            *,
            profiles (
                full_name,
                avatar_url
            )
        `)
        .eq('account_id', account.id)

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

export async function saveAccountMonthNote(token: string, monthYear: string, content: string, authorId: string = "") {
    if (!token || !monthYear) return { error: "Parâmetros inválidos" }

    const admin = createAdminClient()

    // Validate Token owns the account
    const { data: account, error: accountError } = await admin
        .from('ad_accounts')
        .select('id')
        .eq('public_token', token)
        .single()

    if (accountError || !account) return { error: "Acesso Inválido" }

    // Check if exists
    const { data: existing } = await admin
        .from('account_month_notes')
        .select('id')
        .eq('account_id', account.id)
        .eq('month_year', monthYear)
        .single()

    if (existing) {
        if (!content.trim()) {
            // Delete if empty
            await admin.from('account_month_notes').delete().eq('id', existing.id)
            return { success: true, deleted: true }
        } else {
            // Update
            const { error } = await admin
                .from('account_month_notes')
                .update({ content, author_id: authorId || null, updated_at: new Date().toISOString() })
                .eq('id', existing.id)
            if (error) return { error: "Erro ao atualizar comentário" }
        }
    } else if (content.trim()) {
        // Insert
        const { error } = await admin
            .from('account_month_notes')
            .insert({
                account_id: account.id,
                month_year: monthYear,
                content,
                author_id: authorId || null
            })
        if (error) return { error: "Erro ao salvar comentário" }
    }

    return { success: true }
}

export async function getPublicRoteiroComments(token: string, roteiroId: string) {
    if (!token || !roteiroId) return []

    const admin = createAdminClient()

    // Validate Account Access
    const { data: account, error: accountError } = await admin
        .from('ad_accounts')
        .select('id')
        .eq('public_token', token)
        .single()

    if (accountError || !account) return []

    // Verify roteiro belongs to account
    const { data: roteiro } = await admin
        .from('roteiros')
        .select('id')
        .eq('id', roteiroId)
        .eq('account_id', account.id)
        .single()

    if (!roteiro) return []

    const { data: comments, error } = await admin
        .from('roteiro_comments')
        .select('*')
        .eq('roteiro_id', roteiroId)
        .order('created_at', { ascending: true })

    if (error) {
        console.error("Error fetching roteiro comments:", error)
        return []
    }

    // Enhance with user data, client comments get a generic UI
    const enhancedComments = await Promise.all(
        comments.map(async (comment) => {
            if (comment.is_from_client) {
                return {
                    ...comment,
                    user: { name: 'Cliente', avatar_url: '' }
                }
            }
            if (comment.user_id) {
                const { data: userData } = await admin.auth.admin.getUserById(comment.user_id)
                return {
                    ...comment,
                    user: {
                        name: userData?.user?.user_metadata?.full_name || userData?.user?.email?.split('@')[0] || 'Admin',
                        avatar_url: userData?.user?.user_metadata?.avatar_url || ''
                    }
                }
            }
            return {
                ...comment,
                user: { name: 'Usuário', avatar_url: '' }
            }
        })
    )

    return enhancedComments
}

export async function addPublicRoteiroComment(token: string, roteiroId: string, content: string) {
    if (!token || !roteiroId || !content) return { error: "Parâmetros inválidos" }

    const admin = createAdminClient()

    // Validate Account
    const { data: account, error: accountError } = await admin
        .from('ad_accounts')
        .select('id')
        .eq('public_token', token)
        .single()

    if (accountError || !account) return { error: "Acesso Inválido" }

    // Verify roteiro belongs to account
    const { data: roteiro } = await admin
        .from('roteiros')
        .select('id')
        .eq('id', roteiroId)
        .eq('account_id', account.id)
        .single()

    if (!roteiro) return { error: "Roteiro não encontrado" }

    const { data, error } = await admin
        .from('roteiro_comments')
        .insert({
            roteiro_id: roteiroId,
            content,
            is_from_client: true,
            user_id: null
        })
        .select('*')
        .single()

    if (error) {
        console.error("Save Note Error:", error)
        return { error: error.message }
    }

    return { success: true, data }
}
