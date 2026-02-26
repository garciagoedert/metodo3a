'use server'

import { createMetaService } from "@/lib/meta-api/service"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { differenceInDays, getDaysInMonth, startOfMonth, endOfMonth, max, min, parseISO, isSameMonth, format, addMonths, isBefore, isAfter, subDays, subWeeks, subMonths } from "date-fns"
import { getDemoData, getDemoPaymentStatus, getDemoGoalsProgress, DEMO_ACCOUNT_ID, DEMO_DB_ID, DEMO_PUBLIC_TOKEN } from "@/lib/demo-data"

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

    const accounts = data || []

    // Inject Demo Account for Video/Testing
    accounts.push({
        provider_account_id: DEMO_ACCOUNT_ID,
        name: 'Conta Demo Institucional',
        id: DEMO_DB_ID
    })

    return accounts
}

// Core Internal Fetch Logic
async function fetchDashboardData(accountId: string | undefined, dateRange?: { from: string, to: string }) {
    // INTERCEPT FOR DEMO ACCOUNT
    if (accountId === DEMO_ACCOUNT_ID) {
        return getDemoData(dateRange)
    }

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

        console.log("DEBUG: ACTIONS.TS LOADED VERSION 101 - DEBUG DATES")

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
            let hasManualScheduled = false
            let hasManualShowed = false

            if (metricsList) {

                metricsList.forEach((metric: any) => {
                    const monthDate = parseISO(metric.month_start)
                    const monthStart = startOfMonth(monthDate)
                    const monthEnd = endOfMonth(monthDate)
                    const totalDaysInMonth = getDaysInMonth(monthDate)

                    const monthEndStr = format(endOfMonth(monthDate), 'yyyy-MM-dd')
                    const rangeStartStr = timeRange.since
                    const rangeEndStr = timeRange.until || new Date().toISOString().split('T')[0]

                    // Normalized date strings for comparison
                    const mStart = metric.month_start.substring(0, 7) // 2025-11
                    const rStart = timeRange.since.substring(0, 7) // 2025-12
                    const rEnd = timeRange.until ? timeRange.until.substring(0, 7) : rStart

                    let overlapDays = 0

                    // 1. Strict exclusion check
                    if (monthEndStr < rangeStartStr || metric.month_start > rangeEndStr) {
                        overlapDays = 0
                    } else {
                        // 2. Overlap calculation
                        const safeRangeStart = new Date(rangeStart); safeRangeStart.setUTCHours(12, 0, 0, 0)
                        const safeRangeEnd = new Date(rangeEnd); safeRangeEnd.setUTCHours(12, 0, 0, 0)
                        const safeMonthStart = new Date(monthStart); safeMonthStart.setUTCHours(12, 0, 0, 0)
                        const safeMonthEnd = new Date(monthEnd); safeMonthEnd.setUTCHours(12, 0, 0, 0)

                        const overlapStart = max([safeRangeStart, safeMonthStart])
                        const overlapEnd = min([safeRangeEnd, safeMonthEnd])

                        if (overlapStart <= overlapEnd) {
                            overlapDays = differenceInDays(overlapEnd, overlapStart) + 1
                        } else {
                            overlapDays = 0
                        }
                    }

                    if (overlapDays < 0) overlapDays = 0

                    if (metric.month_start === '2025-11-01' && overlapDays > 0) {
                        // This should theoretically never happen if ranges are clean, but if it does, FORCE 0 for adjacent month 
                        // if we are strictly looking at Dec 1st onward.
                        if (rangeStartStr >= '2025-12-01') {
                            // console.log("FORCE FIX: Nov overlap overlap detected despite guard. Resetting.")
                            overlapDays = 0
                        }
                    }

                    const proportion = overlapDays / totalDaysInMonth

                    // DEBUG LOGGING
                    try {
                        const debugLog = `[${new Date().toISOString()}] Metric: ${metric.month_start} | Range: ${timeRange.since}-${timeRange.until} | OverlapDays: ${overlapDays} | TotalDays: ${totalDaysInMonth} | Prop: ${proportion.toFixed(4)} | NewFoll: ${metric.new_followers} -> Added: ${metric.new_followers * proportion}\n`
                        // eslint-disable-next-line @typescript-eslint/no-var-requires
                        const fs = require('fs')
                        fs.appendFileSync('debug_calc.txt', debugLog)
                    } catch (e) { /* ignore */ }

                    console.log("DEBUG Month calc:", {
                        month: metric.month_start,
                        overlapDays,
                        totalDaysInMonth,
                        proportion,
                        scheduled: metric.appointments_scheduled,
                    })

                    if (metric.month_start.startsWith('2025-12')) {
                        console.log("DEBUG DEC 2025 METRIC:", {
                            month: metric.month_start,
                            new_followers: metric.new_followers,
                            type: typeof metric.new_followers,
                            overlapDays,
                            proportion
                        })
                    }

                    if (typeof metric.new_followers === 'number' && proportion > 0) {
                        manualFollowers += (metric.new_followers * proportion)
                        hasManualFollowers = true
                    }

                    if (typeof metric.appointments_scheduled === 'number' && proportion > 0) {
                        totalScheduled += (metric.appointments_scheduled || 0) * proportion
                        hasManualScheduled = true
                    }
                    if (typeof metric.appointments_showed === 'number' && proportion > 0) {
                        totalShowed += (metric.appointments_showed || 0) * proportion
                        hasManualShowed = true
                    }
                })
            }

            // If hasManualFollowers is false, we should return null or 0, NOT fall back to API.
            // But the UI expects a number or null.
            const finalNewFollowers = hasManualFollowers ? Math.round(manualFollowers) : null

            funnel = {
                impressions: (insights?.impressions || 0),
                reach: (insights?.reach || 0),
                profileViews: (insights?.profile_visits || 0),
                newFollowers: finalNewFollowers, // STRICT MANUAL
                scheduled: hasManualScheduled ? Math.round(totalScheduled) : null,
                showed: hasManualShowed ? Math.round(totalShowed) : null,
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

    // Intercept Demo Token
    if (publicToken === DEMO_PUBLIC_TOKEN) {
        return fetchDashboardData(DEMO_ACCOUNT_ID, dateRange)
    }

    const admin = createAdminClient()
    const { data: account } = await admin
        .from('ad_accounts')
        .select('provider_account_id')
        .eq('public_token', publicToken)
        .single()

    if (!account) return { error: "Link inválido ou expirado" }

    return fetchDashboardData(account.provider_account_id, dateRange)
}

// --- GOALS ACTIONS ---

export async function getAccountGoals(accountId: string) {
    if (accountId === DEMO_ACCOUNT_ID) {
        return getDemoGoalsProgress()
    }

    const supabase = await createClient()
    const { data } = await supabase
        .from('goals')
        .select('*')
        .eq('ad_account_id', accountId)
        .order('created_at', { ascending: true })
    return data || []
}

export async function saveAccountGoal(accountId: string, data: { id?: string, metric: string, target: number, period: 'monthly' | 'total', start_date?: string }) {
    if (accountId === DEMO_ACCOUNT_ID) return // Fake success

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const payload: any = {
        ad_account_id: accountId,
        metric: data.metric,
        target: data.target,
        period: data.period,
        start_date: data.start_date || new Date().toISOString(),
        updated_at: new Date().toISOString()
    }

    // If ID provided, use it for UPSERT (Update)
    if (data.id) {
        payload.id = data.id
    }

    const { error } = await supabase
        .from('goals')
        .upsert(payload)

    if (error) {
        console.error("Error saving goal:", error)
        throw new Error("Failed to save goal")
    }
}

export async function toggleGoalStatus(goalId: string, archived: boolean) {
    if (goalId.startsWith('goal_')) return // Fake success for Demo

    const supabase = await createClient()
    const { error } = await supabase
        .from('goals')
        .update({ archived })
        .eq('id', goalId)

    if (error) throw new Error("Failed to update goal status")
}

export async function deleteAccountGoal(goalId: string) {
    if (goalId.startsWith('goal_')) return // Fake success for Demo

    const supabase = await createClient()
    const { error } = await supabase.from('goals').delete().eq('id', goalId)
    if (error) throw error
}

export async function getGoalsProgress(accountId: string) {
    // Demo Account Intercept
    if (accountId === DEMO_ACCOUNT_ID) {
        return getDemoGoalsProgress()
    }

    const goals = await getAccountGoals(accountId)
    if (!goals || goals.length === 0) return []

    const admin = createAdminClient()
    const service = await createMetaService(accountId)

    // Pre-fetch all manual metrics for the account to avoid N+1 queries
    const { data: allManualMetrics } = await admin
        .from('monthly_funnel_metrics')
        .select('*')
        .eq('ad_account_id', accountId)
        .order('month', { ascending: true })

    const results = await Promise.all(goals.map(async (goal: any) => {
        // 1. If goal is already completed/frozen, return stored values
        if (goal.completed_at && goal.final_value != null) {
            return {
                id: goal.id,
                current: Number(goal.final_value),
                target: goal.target,
                metric: goal.metric,
                period: goal.period,
                start_date: goal.start_date,
                archived: goal.archived,
                completed_at: goal.completed_at
            }
        }

        // 2. Calculate Progress
        let currentTotal = 0
        let completionDate: Date | null = null
        let finalValue = 0

        if (goal.period === 'monthly') {
            const today = new Date()
            const refDate = goal.start_date ? new Date(goal.start_date) : today
            const startDateStr = format(startOfMonth(refDate), 'yyyy-MM-dd')
            const endDateStr = format(endOfMonth(refDate), 'yyyy-MM-dd')

            // Calculate for this specific month
            const manualVal = calculateManualSum(allManualMetrics || [], goal.metric, startDateStr, endDateStr)
            const metaVal = await fetchMetaSum(service, goal.metric, startDateStr, endDateStr)

            currentTotal = manualVal + metaVal

            // Check completion for monthly goal (if month has passed or target reached)
            if (currentTotal >= goal.target) {
                completionDate = endOfMonth(refDate) // Completed in that month
                finalValue = currentTotal
            }

        } else {
            // TOTAL GOAL - Iterative Calculation
            const start = goal.start_date ? new Date(goal.start_date) : new Date('2024-01-01')
            const now = new Date()
            let iterDate = startOfMonth(start)

            // Iterate month by month to find when it was crossed
            while (isBefore(iterDate, now) || isSameMonth(iterDate, now)) {
                const monthStart = format(iterDate, 'yyyy-MM-dd')
                const monthEnd = format(endOfMonth(iterDate), 'yyyy-MM-dd')

                const monthManual = calculateManualSum(allManualMetrics || [], goal.metric, monthStart, monthEnd)
                const monthMeta = await fetchMetaSum(service, goal.metric, monthStart, monthEnd)

                currentTotal += (monthManual + monthMeta)

                if (currentTotal >= goal.target) {
                    completionDate = endOfMonth(iterDate)
                    finalValue = currentTotal
                    break; // Stop counting!
                }

                iterDate = addMonths(iterDate, 1)
            }
        }

        // 3. Update DB if newly completed
        if (completionDate) {
            await admin.from('goals').update({
                completed_at: completionDate.toISOString(),
                final_value: finalValue
            }).eq('id', goal.id)

            return {
                id: goal.id,
                current: Number(finalValue),
                target: goal.target,
                metric: goal.metric,
                period: goal.period,
                start_date: goal.start_date,
                archived: goal.archived,
                completed_at: completionDate.toISOString()
            }
        }

        return {
            id: goal.id,
            current: currentTotal,
            target: goal.target,
            metric: goal.metric,
            period: goal.period,
            start_date: goal.start_date,
            archived: goal.archived,
            completed_at: null
        }
    }))

    return results
}

function calculateManualSum(metrics: any[], metricName: string, startStr: string, endStr: string) {
    if (!metrics) return 0
    return metrics.reduce((acc, m) => {
        // Safe robust comparison of YYYY-MM
        const mMonth = m.month.substring(0, 7)
        const sMonth = startStr.substring(0, 7)
        const eMonth = endStr.substring(0, 7)

        if (mMonth >= sMonth && mMonth <= eMonth) {
            if (metricName === 'followers') return acc + (m.new_followers || 0)
            if (metricName === 'appointments_scheduled') return acc + (m.appointments_scheduled || 0)
            if (metricName === 'appointments_showed') return acc + (m.appointments_showed || 0)
        }
        return acc
    }, 0)
}

async function fetchMetaSum(service: any, metricName: string, startStr: string, endStr: string) {
    if (!service) return 0
    if (!['followers', 'conversations', 'impressions', 'reach', 'spend'].includes(metricName)) return 0

    try {
        const insights = await service.getAccountInsights({ since: startStr, until: endStr })
        if (metricName === 'followers') return insights.followers || 0
        if (metricName === 'conversations') {
            const conv = insights.actions?.filter((a: any) => a.action_type.startsWith('onsite_conversion.messaging_conversation_started'))
            return conv?.reduce((acc: number, curr: any) => acc + parseInt(curr.value), 0) || 0
        }
        if (metricName === 'impressions') return insights.impressions || 0
        if (metricName === 'reach') return insights.reach || 0
        if (metricName === 'spend') return insights.spend || 0
    } catch (e) {
        console.error("Meta Fetch Error", e)
        return 0
    }
    return 0
}

export async function getAccountPaymentStatus(accountId: string): Promise<any> {
    // Intercept Demo
    if (accountId === DEMO_ACCOUNT_ID) {
        return getDemoPaymentStatus()
    }

    const service = await createMetaService(accountId)
    if (!service) return null
    return await service.getAccountDetails()
}

export async function getAdMonitoringData(accountId: string, from: string, to: string) {
    const service = await createMetaService(accountId)
    if (!service) return { error: "Conta não conectada" }

    const range = { since: from, until: to }
    const data = await service.getAdDailyInsights(range)
    return { data, range }
}

export async function getMonitoringOverviewAction(accountId: string) {
    const service = await createMetaService(accountId)
    if (!service) return { error: "Conta não conectada" }

    const campaigns = await service.getCampaignOverview()
    return { campaigns }
}

export async function getGlobalMonitoringAction(dateRange: { from: string, to: string }) {
    const accounts = await getConnectedAccounts()

    // Fetch health for all accounts
    const healths = await Promise.all(accounts.map(async (acc) => {
        const service = await createMetaService(acc.provider_account_id)
        if (!service) return { id: acc.provider_account_id, name: acc.name, error: "Connection Lost" }

        const health = await service.getAccountHealth({ since: dateRange.from, until: dateRange.to })

        return {
            id: acc.provider_account_id,
            name: acc.name,
            avatar: null, // Could fetch avatar
            provider_account_id: acc.provider_account_id, // keep ID
            ...health
        }
    }))

    return healths
}

export async function getAdPreviewAction(accountId: string, adId: string) {
    const service = await createMetaService(accountId)
    if (!service) return { error: "Conta não conectada", html: null, rawVideoUrl: null }

    const html = await service.getAdPreviewHTML(adId)

    // Attempt to extract a direct external Post URL (Instagram or Facebook)
    let postUrl = null
    const creative = await service.getAdCreativeDetails(adId)

    if (creative) {
        // Try to get object_story_id (e.g., "12345_67890" -> pageId_postId)
        let storyId = creative.effective_object_story_id || creative.object_story_id
        let instagramActorId = creative.instagram_actor_id
        let instagramPermalinkId = creative.instagram_permalink_url

        if (instagramPermalinkId) {
            postUrl = instagramPermalinkId
        } else if (storyId) {
            const parts = storyId.split('_')
            const pageId = parts[0]
            const postId = parts[1] || parts[0]

            // If we have an instagram actor id, this was likely an insta-only placement, but without permalink we guess the FB post format.
            // Usually, FB posts are: https://facebook.com/{page_id}/posts/{post_id}
            postUrl = `https://www.facebook.com/${pageId}/posts/${postId}`
        }
    }

    return { html, postUrl }
}
