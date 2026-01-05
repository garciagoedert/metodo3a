'use server'

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

async function getAdAccountUUID(providerForId: string, adminClient: any) {
    if (!providerForId) {
        console.error("getAdAccountUUID called with empty providerForId")
        return null
    }

    const { data, error } = await adminClient
        .from('ad_accounts')
        .select('id, provider_account_id')
        .eq('provider_account_id', providerForId)
        .single()

    if (error) console.error("Error resolving UUID for:", providerForId, error)
    if (!data) console.error("No account found for provider ID:", providerForId)

    return data?.id
}

export async function getFunnelMetrics(providerAccountId: string, monthStart: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    const admin = createAdminClient()

    // Resolve UUID
    const uuid = await getAdAccountUUID(providerAccountId, admin)
    if (!uuid) return null

    const { data } = await admin
        .from('monthly_funnel_metrics')
        .select('*')
        .eq('ad_account_id', uuid)
        .eq('month_start', monthStart)
        .single()

    return data
}

export async function updateFunnelMetric(
    providerAccountId: string,
    monthStart: string,
    field: 'appointments_scheduled' | 'appointments_showed' | 'new_followers',
    value: number | null
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: "Unauthorized" }

    const admin = createAdminClient()

    // Resolve UUID
    const uuid = await getAdAccountUUID(providerAccountId, admin)
    if (!uuid) return { error: "Account not found" }

    // Check if record exists using UUID
    const { data: existing } = await admin
        .from('monthly_funnel_metrics')
        .select('*')
        .eq('ad_account_id', uuid)
        .eq('month_start', monthStart)
        .single()

    let error

    if (existing) {
        const { error: updateError } = await admin
            .from('monthly_funnel_metrics')
            .update({ [field]: value, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
        error = updateError
    } else {
        const { error: insertError } = await admin
            .from('monthly_funnel_metrics')
            .insert({
                ad_account_id: uuid,
                month_start: monthStart,
                [field]: value
            })
        error = insertError
    }

    if (error) {
        console.error("Funnel Update Error:", error)
        return { error: error.message || "Failed to update metric" }
    }

    revalidatePath('/')
    return { success: true }
}
