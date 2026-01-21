
import { getConnectedAccounts } from "@/app/(dashboard)/actions"
import { Header } from "@/components/dashboard/header"
import { MonitoringView } from "@/components/dashboard/monitoring/monitoring-view"

export default async function MonitorPage(props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const searchParams = await props.searchParams
    const accountIdParam = searchParams.account as string | undefined
    const viewParam = searchParams.view as string | undefined
    const currentView = viewParam || 'overview'

    let dateRange = (searchParams.from && searchParams.to)
        ? { from: new Date(searchParams.from as string), to: new Date(searchParams.to as string) }
        : undefined

    // For Overview, default to Today if not specified (or always? Reg says "Default Date Range should be 1 day")
    // If I force it, the URL params 'from'/'to' might be ignored.
    // Let's enforce it if it's overview.
    if (currentView === 'overview') {
        const today = new Date()
        dateRange = { from: today, to: today }
    }

    const accounts = await getConnectedAccounts()

    // Active account is only relevant for deep_dive, but we can resolve it anyway
    const activeAccount = accountIdParam
        ? accounts.find((a: any) => a.provider_account_id === accountIdParam)
        : accounts[0]

    const activeAccountId = activeAccount?.provider_account_id

    return (
        <div className="flex flex-1 flex-col w-full">
            <Header
                accounts={accounts}
                currentAccountId={accountIdParam}
                dateRange={dateRange}
                currentView={currentView}
            />
            <main className="flex flex-1 flex-col gap-6 p-6 max-w-[1600px] mx-auto w-full">
                <MonitoringView
                    accountId={activeAccountId}
                    dateRange={dateRange}
                    currentView={currentView}
                />
            </main>
        </div>
    )
}
