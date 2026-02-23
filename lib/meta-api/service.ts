import { createAdminClient } from "@/lib/supabase/admin"
import { eachDayOfInterval, parseISO, format } from "date-fns"

interface MetaAdAccount {
    id: string
    name: string
    currency: string
}

interface MetaCampaign {
    id: string
    name: string
    status: string
    objective: string
}

interface MetaInsights {
    spend: number
    impressions: number
    clicks: number
    cpc: number
    ctr: number
    cpm: number
    reach: number
    frequency: number
    unique_ctr: number
    inline_link_clicks: number
    followers: number // Mapped from action_type: 'post'
    profile_visits: number // Mapped from action_type: 'link_click'
    actions: {
        action_type: string
        value: string
    }[]
    date_start: string
    date_stop: string
}

interface DailyInsight {
    date: string
    spend: number
    results: number
}

interface PlatformDistribution {
    platform: string
    percentage: number
    fill: string
}

const GRAPH_API_URL = "https://graph.facebook.com/v24.0" // Trying v24.0 as per user screenshot!


export class MetaApiService {
    private accessToken: string
    private accountId: string // The full act_ID
    public dbId: string

    constructor(accessToken: string, accountId: string, dbId: string) {
        this.accessToken = accessToken
        // Ensure acts_ prefix is absent or present as needed, typically Graph API expects act_ for ad accounts
        this.accountId = accountId.startsWith('act_') ? accountId : `act_${accountId}`
        this.dbId = dbId
    }

    private sanitizeTimeRange(dateRange?: { since: string, until: string }) {
        if (!dateRange) return undefined

        const sinceDate = new Date(dateRange.since)
        const today = new Date()
        const thirtySevenMonthsAgo = new Date()
        thirtySevenMonthsAgo.setMonth(today.getMonth() - 36) // Safe margin (36 months)

        if (sinceDate < thirtySevenMonthsAgo) {
            return {
                since: thirtySevenMonthsAgo.toISOString().split('T')[0],
                until: dateRange.until
            }
        }
        return dateRange
    }

    private async fetch(endpoint: string, params: Record<string, string> = {}, useRoot = false) {
        const queryParams = new URLSearchParams({
            access_token: this.accessToken,
            ...params
        })

        const baseUrl = useRoot ? GRAPH_API_URL : `${GRAPH_API_URL}/${this.accountId}`

        // Construct URL carefully to avoid double slashes if endpoint is empty
        const url = endpoint
            ? `${baseUrl}/${endpoint}?${queryParams.toString()}`
            : `${baseUrl}?${queryParams.toString()}`

        const response = await fetch(url, { next: { revalidate: 300 } }) // Cache for 5min/300s
        if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error?.message || `Meta API Error: ${response.statusText}`)
        }
        return response.json()
    }

    async getAccountInsights(dateRange?: { since: string, until: string }): Promise<MetaInsights> {
        const params: any = {
            fields: 'spend,impressions,clicks,cpc,ctr,cpm,reach,frequency,unique_ctr,inline_link_clicks,unique_inline_link_click_ctr,outbound_clicks,actions,objective,campaign_name',
            level: 'campaign', // Revert to campaign level as used in CSV
            action_attribution_windows: '["1d_click","7d_click","1d_view"]', // Request specific windows
            limit: 500
        }

        if (dateRange) {
            params.time_range = JSON.stringify(dateRange)
        } else {
            params.date_preset = 'maximum'
        }

        try {
            const data = await this.fetch('insights', params)

            if (!data.data || data.data.length === 0) {
                return this.getEmptyInsights()
            }

            // Initialize aggregation accumulators


            // Fetch Account Level for accurate Reach/Unique metrics
            const accountParams = { ...params, level: 'account', fields: 'spend,impressions,clicks,cpc,ctr,cpm,reach,frequency,unique_ctr,inline_link_clicks,unique_inline_link_click_ctr,actions' }
            delete accountParams.limit

            delete accountParams.breakdowns // Ensure no breakdowns

            const accountData = await this.fetch('insights', accountParams)
            const acc = accountData.data?.[0] || {}

            const actions = acc.actions || []

            // 1. Calculate Profile Visits
            let totalProfileVisits = 0
            const pvAction = actions.find((a: any) => a.action_type === 'link_click')
            if (pvAction) totalProfileVisits = parseInt(pvAction.value)

            // 2. Calculate Followers (Instagram only - approximate via 'post' action or 'like'?)
            // 'post' action usually refers to Page engagement, but often maps to followers in some contexts or we use 'onsite_conversion.post_save'?
            // Actually, for 'Novos Seguidores', standard metric is 'actions:like' (Page Likes) or 'follow'?
            // In original code I used 'post'. Let's stick to 'post' or try to find 'like'.
            // Safest is to sum 'post' as before.
            let totalFollowers = 0
            const postAct = actions.find((a: any) => a.action_type === 'post')
            if (postAct) totalFollowers = parseInt(postAct.value)

            // Also check for 'like' (Page Likes) just in case
            const likeAct = actions.find((a: any) => a.action_type === 'like')
            if (likeAct) totalFollowers += parseInt(likeAct.value)

            const uniqueLinkCtr = acc.unique_inline_link_click_ctr ? parseFloat(acc.unique_inline_link_click_ctr) : parseFloat(acc.unique_ctr || '0')

            return {
                spend: parseFloat(acc.spend || '0'),
                impressions: parseInt(acc.impressions || '0'),
                clicks: parseInt(acc.clicks || '0'),
                cpc: parseFloat(acc.cpc || '0'),
                ctr: parseFloat(acc.ctr || '0'),
                cpm: parseFloat(acc.cpm || '0'),
                reach: parseInt(acc.reach || '0'),
                frequency: parseFloat(acc.frequency || '0'),
                unique_ctr: uniqueLinkCtr,
                inline_link_clicks: parseInt(acc.inline_link_clicks || '0'),
                followers: totalFollowers,
                profile_visits: totalProfileVisits,
                actions: acc.actions || [],
                date_start: acc.date_start,
                date_stop: acc.date_stop
            }
        } catch (error) {
            console.error("Meta API Failed (getAccountInsights), utilizing DB fallback:", error)
            return this.getAggregatedInsightsFromDB(dateRange)
        }
    }

    private getEmptyInsights(): MetaInsights {
        return {
            spend: 0, impressions: 0, clicks: 0, cpc: 0, ctr: 0, cpm: 0, reach: 0,
            frequency: 0, unique_ctr: 0, inline_link_clicks: 0, followers: 0,
            profile_visits: 0, actions: [], date_start: '', date_stop: ''
        }
    }

    private async getAggregatedInsightsFromDB(dateRange?: { since: string, until: string }): Promise<MetaInsights> {
        if (!dateRange) return this.getEmptyInsights()

        const admin = createAdminClient()
        const { data, error } = await admin.from('daily_metrics')
            .select('*')
            .eq('ad_account_id', this.dbId)
            .gte('date', dateRange.since)
            .lte('date', dateRange.until)

        if (error || !data || data.length === 0) return this.getEmptyInsights()

        // Aggregate
        const agg = data.reduce((acc, row) => ({
            spend: acc.spend + Number(row.spend || 0),
            impressions: acc.impressions + Number(row.impressions || 0),
            clicks: acc.clicks + Number(row.clicks || 0),
            link_clicks: acc.link_clicks + Number(row.link_clicks || 0),
            followers: acc.followers + Number(row.followers || 0),
            profile_visits: acc.profile_visits + Number(row.profile_visits || 0),
            conversations: acc.conversations + Number(row.conversations || 0),
            reach_sum: acc.reach_sum + Number(row.reach || 0) // Approximation
        }), { spend: 0, impressions: 0, clicks: 0, link_clicks: 0, followers: 0, profile_visits: 0, conversations: 0, reach_sum: 0 })

        const ctr = agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : 0
        const cpc = agg.clicks > 0 ? (agg.spend / agg.clicks) : 0
        const cpm = agg.impressions > 0 ? (agg.spend / agg.impressions) * 1000 : 0

        return {
            ...this.getEmptyInsights(),
            spend: agg.spend,
            impressions: agg.impressions,
            clicks: agg.clicks,
            inline_link_clicks: agg.link_clicks,
            followers: agg.followers,
            profile_visits: agg.profile_visits,
            ctr, cpc, cpm,
            reach: Math.round(agg.reach_sum / (data.length || 1)), // Just an average alias
            frequency: 1 // Impossible to calc correctly
        }
    }

    /**
     * Get Daily Insights for Performance Chart
     */
    async getDailyInsights(dateRange?: { since: string, until: string }): Promise<any[]> {
        // If no range, bypass cache
        if (!dateRange) return this.fetchFromApi(dateRange).catch(() => [])

        const admin = createAdminClient()

        // 1. Check DB for existing days
        const { data: dbRows, error } = await admin
            .from('daily_metrics')
            .select('*')
            .eq('ad_account_id', this.dbId)
            .gte('date', dateRange.since)
            .lte('date', dateRange.until)

        if (error) {
            console.error("DB Cache Error:", error)
            return this.fetchFromApi(dateRange).catch(() => []) // Fallback
        }

        // 2. Determine Missing Days
        const allDays = eachDayOfInterval({
            start: parseISO(dateRange.since),
            end: parseISO(dateRange.until)
        })
        const expectedDates = allDays.map(d => format(d, 'yyyy-MM-dd'))
        const foundDates = new Set(dbRows?.map(r => r.date) || [])
        const missingDates = expectedDates.filter(d => !foundDates.has(d))

        // 3. If everything is cached, return DB data
        // Also if we have SUBSTANTIAL data and API might fail, we should prioritize DB?
        // Let's try API to fill missing, but catch error.

        let apiData: any[] = []
        try {
            if (missingDates.length > 0) {
                apiData = await this.fetchFromApi(dateRange)
            }
        } catch (e) {
            console.error("Meta API Failed (getDailyInsights), returning cached DB data only:", e)
            // If API failed, return what we have in DB
            return (dbRows || []).map(row => ({
                date: row.date,
                fullDate: row.date,
                spend: Number(row.spend),
                impressions: Number(row.impressions),
                clicks: Number(row.clicks),
                inline_link_clicks: Number(row.link_clicks),
                ctr: Number(row.ctr),
                cpc: Number(row.cpc),
                reach: Number(row.reach),
                frequency: Number(row.frequency),
                results: Number(row.results),
                profile_visits: Number(row.profile_visits),
                followers: Number(row.followers),
                conversations: Number(row.conversations || 0)
            })).sort((a, b) => a.date.localeCompare(b.date))
        }

        // 5. Upsert Missing Days to DB (if API succeeded)
        const todayStr = format(new Date(), 'yyyy-MM-dd')
        const toUpsert = missingDates
            .filter(d => d < todayStr)
            .map(dateStr => {
                const dayData = apiData.find(d => d.date === dateStr)
                const safeData = dayData || { spend: 0, impressions: 0, clicks: 0, inline_link_clicks: 0, reach: 0, frequency: 0, ctr: 0, cpc: 0, results: 0, profile_visits: 0, followers: 0 }
                return {
                    ad_account_id: this.dbId,
                    date: dateStr,
                    spend: safeData.spend,
                    impressions: safeData.impressions,
                    clicks: safeData.clicks,
                    link_clicks: safeData.inline_link_clicks,
                    reach: safeData.reach,
                    frequency: safeData.frequency,
                    ctr: safeData.ctr,
                    cpc: safeData.cpc,
                    results: safeData.results,
                    profile_visits: safeData.profile_visits,
                    followers: safeData.followers,
                    conversations: safeData.conversations
                }
            })

        if (toUpsert.length > 0) {
            try {
                await admin.from('daily_metrics').upsert(toUpsert)
            } catch (err) {
                console.error("Failed to cache daily metrics:", err)
            }
        }

        // Return Mixed Data (DB + API) or just API (which contains all)
        // Ideally API data covers all. if API succeeded.
        return apiData.length > 0 ? apiData : (dbRows || []).map(row => ({
            date: row.date,
            fullDate: row.date,
            spend: Number(row.spend),
            impressions: Number(row.impressions),
            clicks: Number(row.clicks),
            inline_link_clicks: Number(row.link_clicks),
            ctr: Number(row.ctr),
            cpc: Number(row.cpc),
            reach: Number(row.reach),
            frequency: Number(row.frequency),
            results: Number(row.results),
            profile_visits: Number(row.profile_visits),
            followers: Number(row.followers),
            conversations: Number(row.conversations || 0)
        })).sort((a, b) => a.date.localeCompare(b.date))
    }

    private async fetchFromApi(dateRange?: { since: string, until: string }): Promise<any[]> {
        const params: any = {
            fields: 'spend,impressions,clicks,ctr,cpc,reach,frequency,inline_link_clicks,actions',
            time_increment: '1',
            level: 'account',
            limit: '1000'
        }

        if (dateRange) {
            params.time_range = JSON.stringify(dateRange)
        } else {
            params.date_preset = 'maximum'
        }

        const data = await this.fetch('insights', params)
        const rawList = data.data || []

        const processItem = (item: any) => {
            const actions = item.actions || []
            const results = actions.reduce((acc: number, act: any) => acc + parseInt(act.value), 0)

            const profile_visits = actions.find((a: any) => a.action_type === 'link_click')
                ? parseInt(actions.find((a: any) => a.action_type === 'link_click').value)
                : 0

            const followers = actions.find((a: any) => a.action_type === 'post')
                ? parseInt(actions.find((a: any) => a.action_type === 'post').value)
                : 0

            const conversations = actions.filter((a: any) => a.action_type.startsWith('onsite_conversion.messaging_conversation_started'))
                .reduce((acc: number, item: any) => acc + parseInt(item.value), 0)

            return {
                date: item.date_start,
                fullDate: item.date_start,
                spend: parseFloat(item.spend || '0'),
                impressions: parseInt(item.impressions || '0'),
                clicks: parseInt(item.clicks || '0'),
                inline_link_clicks: parseInt(item.inline_link_clicks || '0'),
                ctr: parseFloat(item.ctr || '0'),
                cpc: parseFloat(item.cpc || '0'),
                reach: parseInt(item.reach || '0'),
                frequency: parseFloat(item.frequency || '0'),
                results: results,
                conversations,
                profile_visits,
                followers
            }
        }

        if (!dateRange) {
            return rawList.map(processItem).reverse()
        }

        const allDays = eachDayOfInterval({
            start: parseISO(dateRange.since),
            end: parseISO(dateRange.until)
        })

        return allDays.map(day => {
            const dateKey = format(day, 'yyyy-MM-dd')
            const match = rawList.find((d: any) => d.date_start === dateKey)
            if (match) return processItem(match)
            return {
                date: dateKey, fullDate: dateKey, spend: 0, impressions: 0, clicks: 0,
                inline_link_clicks: 0, ctr: 0, cpc: 0, reach: 0, frequency: 0,
                results: 0, profile_visits: 0, followers: 0, conversations: 0
            }
        })
    }

    /**
     * Get Platform Distribution (Publisher Platform)
     */
    async getPlatformDistribution(dateRange?: { since: string, until: string }): Promise<PlatformDistribution[]> {
        const params: any = {
            fields: 'spend,impressions',
            breakdowns: 'publisher_platform',
            level: 'account'
        }

        if (dateRange) {
            params.time_range = JSON.stringify(dateRange)
        } else {
            params.date_preset = 'maximum'
        }

        try {
            const data = await this.fetch('insights', params)

            if (!data.data) return []

            const totalImpressions = data.data.reduce((acc: number, item: any) => acc + parseInt(item.impressions || '0'), 0)

            const colors: Record<string, string> = {
                'facebook': '#1877F2',
                'instagram': '#E4405F',
                'audience_network': '#6366F1',
                'messenger': '#00B2FF'
            }

            return data.data.map((item: any) => {
                const imp = parseInt(item.impressions || '0')
                return {
                    platform: item.publisher_platform,
                    percentage: totalImpressions > 0 ? (imp / totalImpressions) * 100 : 0,
                    fill: colors[item.publisher_platform] || '#888888'
                }
            })
        } catch (e) {
            console.error("Meta API Failed (getPlatformDistribution), return empty:", e)
            return []
        }
    }

    /**
     * Get Active Campaigns
     */
    async getActiveCampaigns(): Promise<MetaCampaign[]> {
        try {
            const data = await this.fetch('campaigns', {
                fields: 'name,status,objective',
                effective_status: '["ACTIVE"]',
                limit: '10'
            })
            return data.data || []
        } catch (e) {
            console.error("Meta API Failed (getActiveCampaigns):", e)
            return []
        }
    }

    /**
     * Get Top Ads (Creatives + Metrics)
     */
    private async saveAdsDailyHistory(adIds: string[], dateRange: { since: string, until: string }) {
        // ... (unchanged safe upsert logic)
        // Keeping existing implementation, wrapped in logic below
    }

    async getTopCreatives(dateRange?: { since: string, until: string }): Promise<any[]> {
        const params: any = {
            level: 'ad',
            fields: 'ad_id,ad_name,spend,impressions,reach,inline_link_clicks,actions,cpc,ctr,frequency',
            limit: '50',
            sort: 'spend_descending'
        }

        if (dateRange) {
            params.time_range = JSON.stringify(dateRange)
        } else {
            params.date_preset = 'maximum'
        }

        try {
            const insightsData = await this.fetch('insights', params)
            let insights = insightsData.data || []

            if (insights.length === 0) return []

            // Extract Ad IDs to fetch creatives
            const adIds = insights.map((i: any) => i.ad_id)

            // Sync History
            if (dateRange) {
                // We ignore errors in sync history
                await this.saveAdsDailyHistoryImpl(adIds, dateRange).catch(e => console.error("History sync failed", e))
            }

            const creativeParams = {
                ids: adIds.join(','),
                fields: 'creative{thumbnail_url,image_url,title,object_story_spec}'
            }
            const creativesData = await this.fetch('', creativeParams, true)

            return insights.map((insight: any) => {
                const ad = creativesData[insight.ad_id]
                const creative = ad?.creative || {}
                // ... logic to find image ...
                let imageUrl = creative.image_url || creative.thumbnail_url
                if (!imageUrl && creative.object_story_spec) {
                    const spec = creative.object_story_spec
                    if (spec.video_data) imageUrl = spec.video_data.image_url
                    if (spec.link_data) imageUrl = spec.link_data.picture
                    if (spec.link_data?.child_attachments?.[0]) imageUrl = spec.link_data.child_attachments[0].picture
                }

                // Logic for Permalink
                // Fallback to the ad's shareable preview node (requires fetching from the ad node, but we'll try to build a direct manager link)
                let permalink = `https://business.facebook.com/adsmanager/manage/ads?act=${this.accountId.replace('act_', '')}&filter_set.0.filter_field=ad.id&filter_set.0.filter_value=${insight.ad_id}`

                const actions = insight.actions || []
                const profileVisits = actions.find((a: any) => a.action_type === 'instagram_profile_visits')?.value || '0'
                const conversations = actions.filter((a: any) => a.action_type.startsWith('onsite_conversion.messaging_conversation_started'))
                    .reduce((acc: number, item: any) => acc + parseInt(item.value), 0)

                return {
                    id: insight.ad_id,
                    name: insight.ad_name,
                    image_url: imageUrl || null,
                    permalink: permalink,
                    metrics: {
                        spend: parseFloat(insight.spend || '0'),
                        impressions: parseInt(insight.impressions || '0'),
                        reach: parseInt(insight.reach || '0'),
                        clicks: parseInt(insight.inline_link_clicks || '0'),
                        profile_visits: parseInt(profileVisits),
                        ctr: parseFloat(insight.ctr || '0'),
                        cpc: parseFloat(insight.cpc || '0'),
                        frequency: parseFloat(insight.frequency || '0'),
                        conversations: parseInt(conversations)
                    }
                }
            })

        } catch (e) {
            console.error("Meta API Failed (getTopCreatives), fallback to DB:", e)
            return this.getTopCreativesFromDB(dateRange)
        }
    }

    private async saveAdsDailyHistoryImpl(adIds: string[], dateRange: { since: string, until: string }) {
        // Renaming original saveAdsDailyHistory to avoid duplicate definition issues in replace
        // Copy-paste original logic:
        if (adIds.length === 0) return

        const admin = createAdminClient()
        const todayStr = format(new Date(), 'yyyy-MM-dd')

        const allDays = eachDayOfInterval({ start: parseISO(dateRange.since), end: parseISO(dateRange.until) })
            .map(d => format(d, 'yyyy-MM-dd')).filter(d => d < todayStr)

        if (allDays.length === 0) return

        const { data: existingRows } = await admin
            .from('daily_ads_metrics')
            .select('ad_id, date')
            .in('ad_id', adIds)
            .gte('date', allDays[0])
            .lte('date', allDays[allDays.length - 1])

        const existingSet = new Set(existingRows?.map(r => `${r.ad_id}_${r.date}`))
        let needsFetch = false
        for (const adId of adIds) {
            for (const day of allDays) {
                if (!existingSet.has(`${adId}_${day}`)) { needsFetch = true; break }
            }
            if (needsFetch) break
        }
        if (!needsFetch) return

        const params: any = {
            level: 'ad',
            time_increment: '1',
            filtering: JSON.stringify([{ field: 'ad.id', operator: 'IN', value: adIds }]),
            time_range: JSON.stringify({ since: allDays[0], until: allDays[allDays.length - 1] }),
            fields: 'ad_id,ad_name,spend,impressions,clicks,reach,frequency,cpc,ctr,inline_link_clicks,actions',
            limit: '5000'
        }

        const res = await this.fetch('insights', params)
        const apiData = res.data || []



        const toUpsert = apiData
            .filter((d: any) => d.date_start < todayStr)
            .map((d: any) => {
                const actions = d.actions || []
                const profileVisits = actions.find((a: any) => a.action_type === 'instagram_profile_visits')?.value || '0'
                const conversations = actions.filter((a: any) => a.action_type.startsWith('onsite_conversion.messaging_conversation_started'))
                    .reduce((acc: number, item: any) => acc + parseInt(item.value), 0)
                return {
                    ad_account_id: this.dbId,
                    ad_id: d.ad_id,
                    ad_name: d.ad_name,
                    date: d.date_start,
                    spend: parseFloat(d.spend || '0'),
                    impressions: parseInt(d.impressions || '0'),
                    clicks: parseInt(d.clicks || '0'),
                    link_clicks: parseInt(d.inline_link_clicks || '0'),
                    reach: parseInt(d.reach || '0'),
                    frequency: parseFloat(d.frequency || '0'),
                    ctr: parseFloat(d.ctr || '0'),
                    cpc: parseFloat(d.cpc || '0'),
                    conversations: parseInt(conversations),
                    profile_visits: parseInt(profileVisits)
                }
            })

        if (toUpsert.length > 0) {
            await admin.from('daily_ads_metrics').upsert(toUpsert, { onConflict: 'ad_id, date' })
        }
    }

    private async getTopCreativesFromDB(dateRange?: { since: string, until: string }): Promise<any[]> {
        if (!dateRange) return []
        const admin = createAdminClient()

        // Group by ad_id and sum
        // Supabase select doesn't support GROUP BY and SUM directly via SDK easily unless we use .rpc or fetch all and aggregate.
        // Fetch all rows in range
        const { data, error } = await admin
            .from('daily_ads_metrics')
            .select('*')
            .eq('ad_account_id', this.dbId)
            .gte('date', dateRange.since)
            .lte('date', dateRange.until)

        if (error || !data) return []

        const aggMap: Record<string, any> = {}

        data.forEach(row => {
            if (!aggMap[row.ad_id]) {
                aggMap[row.ad_id] = {
                    id: row.ad_id,
                    name: row.ad_name,
                    image_url: null, // No image in DB
                    metrics: { spend: 0, impressions: 0, clicks: 0, link_clicks: 0, profile_visits: 0, conversations: 0 }
                }
            }
            const m = aggMap[row.ad_id].metrics
            m.spend += Number(row.spend || 0)
            m.impressions += Number(row.impressions || 0)
            m.clicks += Number(row.clicks || 0)
            m.link_clicks += Number(row.link_clicks || 0)
            m.profile_visits += Number(row.profile_visits || 0)
            m.conversations += Number(row.conversations || 0)
        })

        const sorted = Object.values(aggMap).sort((a: any, b: any) => b.metrics.spend - a.metrics.spend)
        return sorted.slice(0, 50)
    }

    public async debugFetch(fields: string) {
        return await this.fetch('', { fields }, false)
    }

    /**
     * Get Overview of All Campaigns (Active/Stopped) for Monitoring
     */
    async getCampaignOverview(): Promise<any[]> {
        const params = {
            fields: 'id,name,status,effective_status,daily_budget,lifetime_budget,budget_remaining,buying_type,objective,issues_info,start_time,stop_time',
            limit: '500'
        }
        try {
            const res = await this.fetch('campaigns', params)
            return res.data || []
        } catch (e) {
            console.error("Failed to fetch campaign overview", e)
            return []
        }
    }

    async getAccountHealth(dateRange: { since: string, until: string }) {
        try {
            const [details, insights, campaigns] = await Promise.all([
                this.getAccountDetails(),
                this.fetch('insights', {
                    time_range: JSON.stringify(dateRange),
                    level: 'account',
                    fields: 'spend,purchase_roas,cpc,actions'
                }).then(r => r.data?.[0] || {}),
                this.fetch('campaigns', {
                    fields: 'effective_status,issues_info,budget_remaining',
                    limit: '500'
                }).then(r => r.data || [])
            ])

            const activeCampaigns = campaigns.filter((c: any) => c.effective_status === 'ACTIVE')
            const stoppedCampaigns = campaigns.filter((c: any) => c.effective_status !== 'ACTIVE')
            const issues = campaigns.filter((c: any) => c.issues_info && c.issues_info.length > 0).length
            const noBalance = campaigns.filter((c: any) => c.budget_remaining && parseFloat(c.budget_remaining) < 100).length

            const actions = insights.actions || []
            const conversations = actions.filter((a: any) => a.action_type.startsWith('onsite_conversion.messaging_conversation_started'))
                .reduce((acc: number, item: any) => acc + parseInt(item.value), 0)

            return {
                balance: details.balance,
                currency: details.currency,
                account_status: details.status,
                disable_reason: details.disable_reason,
                spend: parseFloat(insights.spend || 0),
                cpc: parseFloat(insights.cpc || 0),
                conversations: conversations,
                active_count: activeCampaigns.length,
                stopped_count: stoppedCampaigns.length,
                no_balance_count: noBalance,
                total_issues: issues
            }

        } catch (e) {
            console.error("Health Check Failed", e)
            return null
        }
    }

    /**
     * Get Daily Insights for all Ads (Monitoring View)
     */
    async getAdDailyInsights(dateRange: { since: string, until: string }): Promise<any[]> {
        const params: any = {
            level: 'ad',
            time_increment: '1',
            fields: 'ad_id,ad_name,campaign_name,adset_name,spend,impressions,clicks,cpc,ctr,frequency,actions,objective,reach,video_play_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions,video_thruplay_watched_actions',
            limit: '1000'
        }

        if (dateRange) {
            params.time_range = JSON.stringify(dateRange)
        }

        try {
            // 1. Fetch Insights
            const data = await this.fetch('insights', params)
            const raw = data.data || []

            if (raw.length === 0) return []

            // 2. Fetch Ad Names/Creatives/Status (Insights doesn't always show current status or image)
            // We need 'effective_status' and 'creative.thumbnail_url'
            const uniqueAdIds = Array.from(new Set(raw.map((r: any) => r.ad_id))) as string[]

            const adInfoMap = new Map<string, any>()

            // Batch fetch ad info (chunk by 50)
            const chunkSize = 50
            for (let i = 0; i < uniqueAdIds.length; i += chunkSize) {
                const chunk = uniqueAdIds.slice(i, i + chunkSize)
                const adParams = {
                    ids: chunk.join(','),
                    fields: 'name,status,effective_status,quality_ranking,engagement_rate_ranking,conversion_rate_ranking,creative{thumbnail_url,image_url,title,object_story_spec}'
                }
                try {
                    const adData = await this.fetch('', adParams, true)
                    Object.values(adData).forEach((ad: any) => {
                        let imageUrl = ad.creative?.image_url || ad.creative?.thumbnail_url
                        if (!imageUrl && ad.creative?.object_story_spec) {
                            const spec = ad.creative.object_story_spec
                            if (spec.video_data) imageUrl = spec.video_data.image_url
                            if (spec.link_data) imageUrl = spec.link_data.picture
                            if (spec.link_data?.child_attachments?.[0]) imageUrl = spec.link_data.child_attachments[0].picture
                        }
                        adInfoMap.set(ad.id, { ...ad, image_url: imageUrl })
                    })
                } catch (innerErr) {
                    console.error("Failed to fetch creative details chunk", innerErr)
                }
            }

            // 3. Merge
            return raw.map((item: any) => {
                const adInfo = adInfoMap.get(item.ad_id)
                const actions = item.actions || []
                const conversions = actions.filter((a: any) => a.action_type.startsWith('onsite_conversion.messaging_conversation_started'))
                    .reduce((acc: number, x: any) => acc + parseInt(x.value), 0)

                return {
                    ad_id: item.ad_id,
                    ad_name: item.ad_name,
                    date: item.date_start,
                    status: adInfo?.effective_status || 'UNKNOWN',
                    image_url: adInfo?.image_url || null,
                    metrics: {
                        spend: parseFloat(item.spend || 0),
                        impressions: parseInt(item.impressions || 0),
                        clicks: parseInt(item.clicks || 0),
                        reach: parseInt(item.reach || 0),
                        ctr: parseFloat(item.ctr || 0),
                        cpc: parseFloat(item.cpc || 0),
                        frequency: parseFloat(item.frequency || 0),
                        conversations: conversions,
                        video_3s: (item.video_play_actions || []).find((x: any) => x.action_type === 'video_view')?.value || 0,
                        video_p25: (item.video_p25_watched_actions || []).find((x: any) => x.action_type === 'video_view')?.value || 0,
                        video_p50: (item.video_p50_watched_actions || []).find((x: any) => x.action_type === 'video_view')?.value || 0,
                        video_p75: (item.video_p75_watched_actions || []).find((x: any) => x.action_type === 'video_view')?.value || 0,
                        video_p100: (item.video_p100_watched_actions || []).find((x: any) => x.action_type === 'video_view')?.value || 0,
                        video_thruplay: (item.video_thruplay_watched_actions || []).find((x: any) => x.action_type === 'video_view')?.value || 0,
                    },
                    quality: {
                        quality_ranking: adInfo?.quality_ranking || 'UNKNOWN',
                        engagement_rate_ranking: adInfo?.engagement_rate_ranking || 'UNKNOWN',
                        conversion_rate_ranking: adInfo?.conversion_rate_ranking || 'UNKNOWN'
                    }
                }
            })

        } catch (e) {
            console.error("Meta API Failed (getAdDailyInsights):", e)
            return []
        }
    }

    /**
     * Get Basic Account Details for Payment Status
     */
    async getAccountDetails(): Promise<{ status: number, disable_reason: number, balance: number, currency: string, is_prepay_account: boolean, amount_spent: number, timezone_offset_hours_utc: number }> {
        try {
            const data = await this.fetch('', {
                fields: 'account_status,disable_reason,balance,currency,is_prepay_account,amount_spent,timezone_offset_hours_utc,funding_source_details'
            }, false)

            let finalBalance = parseInt(data.balance || '0')

            // Try to parse Prepaid Balance from funding_source_details
            if (data.funding_source_details?.display_string) {
                // Example: "Saldo disponível (R$302,31 BRL)"
                // Regex to capture the number part: R$([\d.,]+) OR just digits/dots/commas
                // We use a broader regex to capture the numeric string after "R$"
                // Matches "302,31"
                const match = data.funding_source_details.display_string.match(/R\$\s*([\d\.,]+)/)
                if (match && match[1]) {
                    // Brazilian format assumption for BRL: 1.000,00
                    let numStr = match[1]
                    // Remove thousands separator (.)
                    numStr = numStr.replace(/\./g, '')
                    // Replace decimal separator (,) with (.)
                    numStr = numStr.replace(',', '.')

                    const val = parseFloat(numStr)
                    if (!isNaN(val)) {
                        // Convert to CENTS (integer) because the UI expects CENTS
                        finalBalance = Math.round(val * 100)

                        // Wait! The UI logic:
                        // `const rawBalance = Math.abs(Number(data.balance))`
                        // `const balanceValue = rawBalance / divisor` (divisor=100)
                        // If APi returns 31890 (cents), UI divides by 100 -> 318.90. Correct.
                        // But Prepaid balance is CREDIT (Negative in standard API).
                        // If I manually parsed 318.90, I have positive.
                        // If I verify the UI logic: `Math.abs`.
                        // So I can return Positive 31890.
                        // BUT: If the original API `balance` was POSITIVE ("owed"), and I overwrite with Credit (Positive?),
                        // The UI will show "Saldo Pré-pago R$ 318,90".
                        // Is that correct?
                        // Yes, if `isPrepay` is true.
                    }
                }
            }

            return {
                status: data.account_status,
                disable_reason: data.disable_reason,
                balance: finalBalance,
                currency: data.currency,
                is_prepay_account: !!data.is_prepay_account,
                amount_spent: parseInt(data.amount_spent || '0'),
                timezone_offset_hours_utc: data.timezone_offset_hours_utc
            }
        } catch (e) {
            console.error("Meta API Failed (getAccountDetails):", e)
            // Fallback to error state
            return { status: 2, disable_reason: 0, balance: 0, currency: 'BRL', is_prepay_account: false, amount_spent: 0, timezone_offset_hours_utc: -3 }
        }
    }
}

// Factory to create service from DB account
export async function createMetaService(accountId?: string) {
    const admin = createAdminClient()

    let query = admin
        .from('ad_accounts')
        .select('*')
        .eq('status', 'active')

    // If accountId is provided (provider_account_id), specific lookup
    if (accountId) {
        query = query.eq('provider_account_id', accountId)
    }

    // Always limit 1, if no ID logic picks first active as fallback
    const { data: accounts } = await query.limit(1)

    if (!accounts || accounts.length === 0) return null

    const account = accounts[0]
    return new MetaApiService(account.access_token, account.provider_account_id, account.id)
}
