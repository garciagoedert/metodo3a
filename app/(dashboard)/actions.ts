'use server'

import { createMetaService } from "@/lib/meta-api/service"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { differenceInDays, getDaysInMonth, startOfMonth, endOfMonth, max, min, parseISO, isSameMonth } from "date-fns"

// Helper to get all connected accounts for the selector
export async function getConnectedAccounts() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const admin = createAdminClient()
    const { data } = await admin
        .from('ad_accounts')
        .select('provider_account_id, name, id')
        .eq('status', 'active')

    return data || []
}

// Core Internal Fetch Logic
async function fetchDashboardData(accountId: string | undefined, dateRange?: { from: string, to: string }) {
    try {
        const service = await createMetaService(accountId)

        if (!service) {
            return {
                warning: "Nenhuma conta de anúncios conectada.",
                insights: null,
                daily: [],
                distribution: [],
                campaigns: []
            }
        }

        // Convert strict date range if provided and sanitize
        let timeRange = undefined
        if (dateRange) {
            const sinceDate = new Date(dateRange.from)
            const today = new Date()
            const thirySevenMonthsAgo = new Date()
            thirySevenMonthsAgo.setDate(today.getDate() - 1095) // Approx 36.5 months safe margin

            if (sinceDate < thirySevenMonthsAgo) {
                timeRange = {
                    since: thirySevenMonthsAgo.toISOString().split('T')[0],
                    until: dateRange.to
                }
            } else {
                timeRange = { since: dateRange.from, until: dateRange.to }
            }
        } else {
            // Default 30 days if no range provided
            const doc = new Date()
            const since = new Date(doc.setDate(doc.getDate() - 30)).toISOString().split('T')[0]
            const until = new Date().toISOString().split('T')[0]
            timeRange = { since, until }
        }

        const [insights, daily, distribution, campaigns, topCreatives] = await Promise.all([
            service.getAccountInsights(timeRange),
            service.getDailyInsights(timeRange),
            service.getPlatformDistribution(timeRange),
            service.getActiveCampaigns(),
            service.getTopCreatives(timeRange)
        ])

        // Fetch Funnel Metrics
        const admin = createAdminClient()
        let funnel = null

        if (timeRange?.since) {
            const rangeStart = parseISO(timeRange.since)
            const rangeEnd = timeRange.until ? parseISO(timeRange.until) : new Date()

            const startMonth = timeRange.since.substring(0, 7) + '-01'
            const endMonth = timeRange.until ? timeRange.until.substring(0, 7) + '-01' : startMonth

            console.log("DEBUG Funnel Query:", { startMonth, endMonth, dbId: service.dbId })

            // Fetch all monthly records within the range
            const { data: metricsList, error: funnelError } = await admin
                .from('monthly_funnel_metrics')
                .select('*')
                .eq('ad_account_id', service.dbId)
            // Removed date filters to rely on JS overlap logic (Robustness fix)

            if (funnelError) console.error("Funnel DB Error:", funnelError)
            console.log("DEBUG Funnel Rows:", metricsList?.length)

            // Aggregate values with Proportional Logic
            let manualFollowers = 0
            let hasManualFollowers = false
            let totalScheduled = 0
            let totalShowed = 0

            if (metricsList) {
                metricsList.forEach((metric: any) => {
                    const monthDate = parseISO(metric.month_start)
                    const monthStart = startOfMonth(monthDate)
                    const monthEnd = endOfMonth(monthDate)
                    const totalDaysInMonth = getDaysInMonth(monthDate)

                    // Calculate overlap
                    const overlapStart = max([rangeStart, monthStart])
                    const overlapEnd = min([rangeEnd, monthEnd])

                    // Add 1 day because differenceInDays is exclusive of end date effectively for inclusive ranges
                    // e.g. Oct 5 to Oct 5 is 1 day. diff(Oct 5, Oct 5) is 0.
                    let overlapDays = differenceInDays(overlapEnd, overlapStart) + 1

                    if (overlapDays < 0) overlapDays = 0

                    const proportion = overlapDays / totalDaysInMonth

                    console.log("DEBUG Month calc:", {
                        month: metric.month_start,
                        overlapDays,
                        totalDaysInMonth,
                        proportion,
                        scheduled: metric.appointments_scheduled,
                        addToTotal: (metric.appointments_scheduled || 0) * proportion
                    })

                    if (typeof metric.new_followers === 'number') {
                        hasManualFollowers = true
                        manualFollowers += metric.new_followers * proportion
                    }
                    totalScheduled += (metric.appointments_scheduled || 0) * proportion
                    totalShowed += (metric.appointments_showed || 0) * proportion
                })
            }

            funnel = {
                impressions: typeof insights.impressions === 'number' ? insights.impressions : parseInt(insights.impressions || '0'),
                reach: typeof insights.reach === 'number' ? insights.reach : parseInt(insights.reach || '0'),
                profile_visits: insights.profile_visits || 0, // Using API data
                followers: hasManualFollowers ? Math.round(manualFollowers) : (insights.followers || 0),
                scheduled: Math.round(totalScheduled),
                showed: Math.round(totalShowed),
            }
            console.log("FINAL DEBUG FUNNEL:", funnel)
        }

        // Fetch Dashboard Config
        const { data: configRow } = await admin
            .from('ad_accounts')
            .select('dashboard_config')
            .eq('id', service.dbId)
            .single()

        // Update last_synced_at
        await admin.from('ad_accounts')
            .update({ last_synced_at: new Date().toISOString() })
            .eq('id', service.dbId)

        return {
            insights,
            daily,
            distribution,
            campaigns,
            funnel, // Return combined funnel data
            topCreatives,
            dashboardConfig: configRow?.dashboard_config || null
        }
    } catch (error: any) {
        console.error("Dashboard Error:", error)

        // Auto-detect expired tokens and update status
        const errorMsg = error.message || ""
        if (
            errorMsg.includes("Session has expired") ||
            errorMsg.includes("Error validating access token") ||
            errorMsg.includes("The access token could not be decrypted")
        ) {
            try {
                const admin = createAdminClient()
                if (accountId) {
                    await admin.from('ad_accounts')
                        .update({ status: 'error' })
                        .eq('provider_account_id', accountId)
                }
            } catch (dbError) {
                console.error("Failed to update account status:", dbError)
            }
        }

        return { error: errorMsg || "Erro ao carregar dados do dashboard." }
    }
}

// Authenticated Access
export async function getDashboardData(dateRange?: { from: string, to: string }, accountId?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: "Unauthorized" }

    return fetchDashboardData(accountId, dateRange)
}

// Public Access (via Token)
export async function getPublicDashboardData(publicToken: string, dateRange?: { from: string, to: string }) {
    if (!publicToken) return { error: "Token inválido" }

    const admin = createAdminClient()
    const { data: account } = await admin
        .from('ad_accounts')
        .select('provider_account_id')
        .eq('public_token', publicToken)
        .single()

    if (!account) return { error: "Link inválido ou expirado" }

    return fetchDashboardData(account.provider_account_id, dateRange)
}
