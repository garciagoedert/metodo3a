'use server'

import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

export async function saveFunnelConfig(accountId: string, funnelSteps: any[]) {
    try {
        const admin = createAdminClient()

        const { error } = await admin
            .from('ad_accounts')
            .update({ dashboard_config: { funnel_steps: funnelSteps } })
            .eq('provider_account_id', accountId) // Check if accountId is provider or db id?
        // The Board passes `accountId` which is `provider_account_id` usually.
        // Wait, in `page.tsx` we use `provider_account_id`.
        // But `service.dbId` is UUID.
        // Check `dashboard/actions.ts`: `getDashboardData` uses `service.dbId`.
        // User passes `accountId` (provider ID) to `FunnelMetricsDialog`.
        // So I should use `provider_account_id`.

        if (error) throw error

        revalidatePath('/dashboard')
        return { success: true }
    } catch (error: any) {
        console.error("Error saving config:", error)
        return { error: error.message }
    }
}
