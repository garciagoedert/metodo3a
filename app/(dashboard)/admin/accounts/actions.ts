'use server'

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { logActivity } from "@/lib/logger"

export interface AdAccount {
    id: string
    provider: 'meta_ads' | 'google_ads'
    provider_account_id: string
    name: string
    status: 'active' | 'error' | 'expired'
    last_synced_at: string | null
    created_at: string
}

export async function getAdAccounts() {
    const supabase = await createClient()

    // Check auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Unauthorized" }

    const { data, error } = await supabase
        .from('ad_accounts')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) return { error: error.message }
    return { data: data as AdAccount[] }
}

export async function connectMetaAccount(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Unauthorized" }

    const name = formData.get('name') as string
    const accountId = formData.get('account_id') as string
    const accessToken = formData.get('access_token') as string

    if (!name || !accountId || !accessToken) {
        return { error: "Todos os campos são obrigatórios." }
    }

    // 1. Validate Token with Meta API (Simple check)
    try {
        const response = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${accessToken}`)
        const data = await response.json()

        if (data.error) {
            return { error: `Erro na validação do Token: ${data.error.message}` }
        }
    } catch (err) {
        return { error: "Falha ao conectar com a API do Facebook." }
    }

    // 2. Save to DB
    const admin = createAdminClient()

    const { error } = await admin.from('ad_accounts').insert({
        provider: 'meta_ads',
        provider_account_id: accountId,
        name: name,
        access_token: accessToken,
        status: 'active',
        user_id: user.id
    })

    if (error) {
        if (error.code === '23505') { // Unique violation
            return { error: "Esta conta já está conectada." }
        }
        await logActivity("Conexão de Conta", "error", `Erro ao conectar Meta Ads: ${error.message}`, user.id, user.user_metadata.full_name, user.email)
        return { error: error.message }
    }

    await logActivity("Conexão de Conta", "success", `Conectou conta Meta Ads: ${name} (${accountId})`, user.id, user.user_metadata.full_name, user.email)

    revalidatePath('/admin/accounts')
    return { success: true }
}

export async function updateMetaAccount(id: string, formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Unauthorized" }

    const name = formData.get('name') as string
    const accessToken = formData.get('access_token') as string

    // Note: Provider Account ID is usually constant, avoiding editing it to prevent mismatches

    if (!name || !accessToken) {
        return { error: "Nome e Token são obrigatórios." }
    }

    // 1. Validate New Token with Meta API
    try {
        const response = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${accessToken}`)
        const data = await response.json()

        if (data.error) {
            return { error: `Erro na validação do Token: ${data.error.message}` }
        }
    } catch (err) {
        return { error: "Falha ao validar com a API do Facebook." }
    }

    // 2. Update DB
    const admin = createAdminClient()

    const { error } = await admin.from('ad_accounts')
        .update({
            name: name,
            access_token: accessToken,
            status: 'active', // Reset status to active on update
            updated_at: new Date().toISOString()
        })
        .eq('id', id)

    if (error) {
        await logActivity("Edição de Conta", "error", `Erro ao atualizar conta ID ${id}: ${error.message}`, user.id, user.user_metadata.full_name, user.email)
        return { error: error.message }
    }

    await logActivity("Edição de Conta", "success", `Atualizou conta Meta Ads ID ${id}`, user.id, user.user_metadata.full_name, user.email)

    revalidatePath('/admin/accounts')
    return { success: true }
}


export async function disconnectAccount(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Unauthorized" }

    const admin = createAdminClient()

    const { error } = await admin.from('ad_accounts').delete().eq('id', id)

    if (error) {
        await logActivity("Desconexão de Conta", "error", `Erro ao desconectar ID ${id}: ${error.message}`, user.id, user.user_metadata.full_name, user.email)
        return { error: error.message }
    }

    await logActivity("Desconexão de Conta", "success", `Desconectou conta ID ${id}`, user.id, user.user_metadata.full_name, user.email)

    revalidatePath('/admin/accounts')
    return { success: true }
}
