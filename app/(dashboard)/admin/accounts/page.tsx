import { getAdAccounts } from './actions'
import { AccountsManager } from './client'

export default async function AccountsPage() {
    const { data: accounts, error } = await getAdAccounts()

    if (error) {
        return <div className="p-4 text-red-500">Erro ao carregar contas: {error}</div>
    }

    return (
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <AccountsManager accounts={accounts || []} />
        </div>
    )
}
