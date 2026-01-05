'use server'

import { createAdminClient } from "@/lib/supabase/admin"
import { headers } from "next/headers"

export async function getPublicLink(providerAccountId: string) {
    if (!providerAccountId) return { error: "Account ID not provided" }

    const admin = createAdminClient()

    // 1. Fetch existing token
    const { data: account, error } = await admin
        .from('ad_accounts')
        .select('public_token')
        .eq('provider_account_id', providerAccountId)
        .single()

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
    if (!token) return { error: "Token not provided" }

    const admin = createAdminClient()
    const { data, error } = await admin
        .from('ad_accounts')
        .select('provider_account_id, name, id')
        .eq('public_token', token)
        .single()

    if (error || !data) return { error: "Invalid or expired link" }

    return { account: data }
}
