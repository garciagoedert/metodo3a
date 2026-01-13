import { startOfMonth, subDays, format } from "date-fns"

export const DEMO_ACCOUNT_ID = 'act_demo_123'
export const DEMO_DB_ID = 'demo-db-uuid'
export const DEMO_PUBLIC_TOKEN = 'demo-share-token'

export function getDemoData(dateRange?: { from: string, to: string }) {
    // Generate realistic daily data for the chart
    const daily = []
    const now = new Date()
    const days = 30

    // Base values
    let spendAcc = 0
    let impressionsAcc = 0
    let clicksAcc = 0
    let conversionsAcc = 0

    for (let i = days; i >= 0; i--) {
        const d = subDays(now, i)
        const dateStr = format(d, 'yyyy-MM-dd')

        // Random variance
        const dailySpend = 150 + Math.random() * 50
        const dailyImpressions = 5000 + Math.random() * 2000
        const dailyClicks = 80 + Math.random() * 30
        const dailyConversions = 3 + Math.random() * 4

        spendAcc += dailySpend
        impressionsAcc += dailyImpressions
        clicksAcc += dailyClicks
        conversionsAcc += dailyConversions

        daily.push({
            date: dateStr,
            spend: dailySpend,
            impressions: Math.round(dailyImpressions),
            clicks: Math.round(dailyClicks),
            inline_link_clicks: Math.round(dailyClicks * 0.85),
            cpc: dailySpend / dailyClicks,
            ctr: (dailyClicks / dailyImpressions) * 100,
            conversations: Math.round(dailyConversions),
            reach: Math.round(dailyImpressions * 0.8),
            frequency: 1.2,
            items: [{ action_type: 'onsite_conversion.messaging_conversation_started_7d', value: Math.round(dailyConversions) }]
        })
    }

    // Totals
    const insights = {
        spend: spendAcc,
        impressions: Math.round(impressionsAcc),
        clicks: Math.round(clicksAcc),
        inline_link_clicks: Math.round(clicksAcc * 0.85),
        cpc: spendAcc / clicksAcc,
        ctr: (clicksAcc / impressionsAcc) * 100,
        reach: Math.round(impressionsAcc * 0.8),
        frequency: 1.25,
        actions: [
            { action_type: 'onsite_conversion.messaging_conversation_started_7d', value: Math.round(conversionsAcc) }
        ],
        // Helpers for direct access
        conversations: Math.round(conversionsAcc),
        followers: 120,
        profile_visits: 450
    }

    const distribution = [
        { platform: 'facebook', percentage: 45, fill: '#1877F2' },
        { platform: 'instagram', percentage: 55, fill: '#E1306C' }
    ]

    const campaigns = [
        { id: '1', name: 'Alinhadores - Captação', status: 'ACTIVE', objective: 'OUTCOME_LEADS' },
        { id: '2', name: 'Implantes - Google Display', status: 'ACTIVE', objective: 'OUTCOME_LEADS' },
        { id: '3', name: 'Branding - Institucional', status: 'ACTIVE', objective: 'BRAND_AWARENESS' }
    ]

    const topCreatives = [
        {
            id: 'c1',
            name: 'Criativo Mulher Sorrindo',
            image_url: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=500&auto=format&fit=crop&q=60',
            metrics: {
                impressions: 15420,
                clicks: 230,
                spend: 450.50,
                ctr: 1.49,
                cpc: 1.95,
                reach: 12000,
                profile_visits: 45,
                frequency: 1.2,
                conversations: 5
            }
        },
        {
            id: 'c2',
            name: 'Antes e Depois - Caso 04',
            image_url: 'https://images.unsplash.com/photo-1606811971618-4486d14f3f72?w=500&auto=format&fit=crop&q=60',
            metrics: {
                impressions: 12100,
                clicks: 180,
                spend: 320.20,
                ctr: 1.48,
                cpc: 1.77,
                reach: 10500,
                profile_visits: 30,
                frequency: 1.15,
                conversations: 3
            }
        },
        {
            id: 'c3',
            name: 'Vídeo Depoimento',
            image_url: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=500&auto=format&fit=crop&q=60',
            metrics: {
                impressions: 9800,
                clicks: 150,
                spend: 280.00,
                ctr: 1.53,
                cpc: 1.86,
                reach: 8000,
                profile_visits: 25,
                frequency: 1.22,
                conversations: 4
            }
        },
        {
            id: 'c4',
            name: 'Promoção Clareamento',
            image_url: 'https://images.unsplash.com/photo-1598256989800-fe5f95da9787?w=500&auto=format&fit=crop&q=60',
            metrics: {
                impressions: 8500,
                clicks: 120,
                spend: 210.00,
                ctr: 1.41,
                cpc: 1.75,
                reach: 7000,
                profile_visits: 15,
                frequency: 1.1,
                conversations: 2
            }
        },
        {
            id: 'c5',
            name: 'Consultório Tour',
            image_url: 'https://images.unsplash.com/photo-1629909615184-74f495363b63?w=500&auto=format&fit=crop&q=60',
            metrics: {
                impressions: 5400,
                clicks: 90,
                spend: 150.00,
                ctr: 1.66,
                cpc: 1.66,
                reach: 4500,
                profile_visits: 20,
                frequency: 1.1,
                conversations: 1
            }
        }
    ]

    const funnel = {
        impressions: insights.impressions,
        reach: insights.reach,
        profileViews: 450,
        newFollowers: 120,
        scheduled: 45,
        showed: 38
    }

    return {
        insights,
        daily,
        distribution,
        campaigns,
        funnel,
        topCreatives,
        dashboardConfig: null
    }
}

export function getDemoPaymentStatus() {
    return {
        account_id: DEMO_ACCOUNT_ID,
        account_status: 1, // Active
        disable_reason: 0,
        balance: 0,
        currency: 'BRL',
        is_prepay_account: false, // Automatic
        amount_spent: 15430.50,
        timezone_offset_hours_utc: -3
    }
}

export function getDemoGoalsProgress() {
    return [
        {
            id: 'goal_1',
            metric: 'followers',
            target: 10000,
            current: 7560,
            period: 'total',
            start_date: '2025-12-15T12:00:00.000Z',
            archived: false,
            completed_at: null
        },
        {
            id: 'goal_2',
            metric: 'conversations',
            target: 100,
            current: 156,
            period: 'monthly',
            start_date: '2025-12-15T12:00:00.000Z',
            archived: false,
            completed_at: '2025-12-25T10:00:00.000Z'
        }
    ]
}
