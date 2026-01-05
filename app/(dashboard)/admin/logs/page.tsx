import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { LogsClient } from "./client"
import { LogEntry } from "./columns"

export default async function LogsPage() {
    // Use Admin Client to bypass RLS policies so all authorized users (who can access this page)
    // can see the full system history.
    const adminClient = createAdminClient()
    const supabase = await createClient()

    // check current user role
    const { data: { user } } = await supabase.auth.getUser()
    let isAdmin = false

    if (user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        isAdmin = profile?.role === 'admin'
    }

    let query = adminClient
        .from("system_logs")
        .select("*")
        .order("created_at", { ascending: false })

    // If not admin, filter out user management actions
    if (!isAdmin) {
        query = query.not('action', 'in', '("Criação de Usuário","Atualização de Usuário","Exclusão de Usuário","Restauração de Usuário","Exclusão Permanente")')
    }

    const { data: logs, error } = await query

    if (error) {
        console.error("Error fetching logs:", error)
    }

    // Prepare data for client component
    // We map to ensure types match LogEntry interface exactly
    const safeLogs: LogEntry[] = (logs || []).map((log: any) => ({
        id: log.id,
        created_at: log.created_at,
        user_name: log.user_name,
        user_email: log.user_email,
        action: log.action,
        status: log.status,
        details: log.details,
    }))

    return (
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <h2 className="text-3xl font-bold tracking-tight">Histórico</h2>
            <LogsClient data={safeLogs} />
        </div>
    )
}
