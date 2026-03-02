import { getConnectedAccounts } from "@/app/(dashboard)/actions"
import { ClientSelector } from "@/components/dashboard/client-selector"
import { RoteirosView } from "@/components/dashboard/roteiros/roteiros-view"
import { RoteirosHeaderActions } from "@/components/dashboard/roteiros/roteiros-header-actions"

export default async function RoteirosPage(props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const searchParams = await props.searchParams
    const accountIdParam = searchParams.account as string | undefined

    const accounts = await getConnectedAccounts()

    // Resolve active account
    const activeAccount = accountIdParam
        ? accounts.find((a: any) => a.provider_account_id === accountIdParam || a.id === accountIdParam)
        : accounts[0]

    const activeAccountId = activeAccount?.provider_account_id || activeAccount?.id

    return (
        <div className="flex flex-1 flex-col w-full">
            {/* Custom Header for Roteiros */}
            <header className="sticky top-0 z-40 w-full flex flex-col md:flex-row h-auto md:h-16 items-start md:items-center justify-between border-b bg-background px-6 py-4 md:py-0 gap-4 md:gap-0 shadow-sm">
                <div className="flex w-full md:w-auto items-center justify-between gap-4">
                    <ClientSelector className="w-auto flex-1 md:w-[400px]" accounts={accounts} currentAccountId={activeAccountId} />
                </div>
                {activeAccountId && (
                    <div className="flex w-full md:w-auto items-center gap-2">
                        <RoteirosHeaderActions accountId={activeAccountId} />
                    </div>
                )}
            </header>

            <main className="flex-1 overflow-x-hidden bg-slate-50/50 dark:bg-slate-900/50">
                <div className="w-full h-full p-6">
                    {activeAccountId ? (
                        <RoteirosView accountId={activeAccountId} />
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-500">
                            Selecione uma conta para visualizar os roteiros.
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
