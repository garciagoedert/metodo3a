'use server'

import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath, unstable_noStore as noStore } from "next/cache"

export async function getMonthlyReport(accountId: string, month: string) {
    noStore() // Force fresh data
    if (!accountId || !month) return { error: "Missing parameters" }

    const admin = createAdminClient()

    // 1. Get Analysis (Month Specific)
    const { data: report, error: reportError } = await admin
        .from('monthly_reports')
        .select('analysis_text')
        .eq('ad_account_id', accountId)
        .eq('month', month)
        .single()

    // Ignore Not Found (PGRST116)
    if (reportError && reportError.code !== 'PGRST116') {
        console.error("Error fetching report:", reportError)
        // Continue to fetch client name anyway as it's separate
    }

    // 2. Get Client Name (Account Global)
    const { data: account, error: accountError } = await admin
        .from('ad_accounts')
        .select('client_name')
        .eq('id', accountId)
        .single()

    if (accountError && accountError.code !== 'PGRST116') {
        console.error("Error fetching account:", accountError)
    }

    return {
        client_name: account?.client_name || "",
        analysis_text: report?.analysis_text || ""
    }
}

export async function upsertMonthlyReport(accountId: string, month: string, data: { client_name: string, analysis_text: string }) {
    const admin = createAdminClient()

    // 1. Update Account Global Name
    const { data: updatedAccount, error: accountError } = await admin
        .from('ad_accounts')
        .update({ client_name: data.client_name })
        .eq('id', accountId)
        .select()

    if (accountError) {
        console.error("Error saving account name:", accountError)
        return { error: `Erro ao salvar nome do cliente: ${accountError.message}` }
    }

    if (!updatedAccount || updatedAccount.length === 0) {
        return { error: `Erro: Conta não encontrada (ID inválido?)` }
    }

    // 2. Update Month Analysis
    const { error: reportError } = await admin
        .from('monthly_reports')
        .upsert({
            ad_account_id: accountId,
            month: month,
            analysis_text: data.analysis_text,
            updated_at: new Date().toISOString()
        }, { onConflict: 'ad_account_id, month' })

    if (reportError) {
        console.error("Error saving report:", reportError)
        return { error: `Erro ao salvar análise: ${reportError.message}` }
    }

    revalidatePath('/share')
    return { success: true }
}
