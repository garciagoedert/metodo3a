import { getUsers } from './actions'
import { TeamManager } from './client'

export default async function TeamPage() {
    const { data: users, error } = await getUsers()

    if (error) {
        return (
            <div className="p-4 text-red-500">
                Erro ao carregar usuários: {error}
            </div>
        )
    }

    return (
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <TeamManager users={users || []} />
        </div>
    )
}
