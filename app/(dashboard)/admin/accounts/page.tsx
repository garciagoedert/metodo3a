import { getAdAccounts } from './actions'
import { AccountsManager } from './client'

export default async function AccountsPage() {
    const { data: accounts, error } = await getAdAccounts()

    if (error) {
        return <div className="p-4 text-red-500">Erro ao carregar contas: {error}</div>
    }

    return (
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Contas Vinculadas</h2>
            </div>
            <AccountsManager accounts={accounts || []} />
        </div>
    )
}
