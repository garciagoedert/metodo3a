import { Metadata } from 'next'
import LoginForm from './login-form'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata: Metadata = {
    title: 'Login - Método 3A',
    description: 'Acesse o sistema de gestão de tráfego.',
}

export default async function LoginPage() {
    const admin = createAdminClient()

    // 1. Fetch Auth Users
    const { data: { users } } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000
    })

    // 2. Fetch Profiles to check for deleted status
    // Use admin client to bypass RLS if necessary, though public.profiles might be readable.
    // Using admin is safer for a system page.
    const { data: profiles } = await admin.from('profiles').select('id, full_name, avatar_url, deleted_at')

    // 3. Merge and Filter
    const validUsers = users?.map(u => {
        const profile = profiles?.find(p => p.id === u.id)
        if (profile?.deleted_at) return null // Skip deleted users

        return {
            id: u.id,
            email: u.email,
            full_name: profile?.full_name || u.user_metadata.full_name || u.email?.split('@')[0] || 'Usuário',
            avatar_url: profile?.avatar_url || u.user_metadata.avatar_url
        }
    })
        .filter((u): u is NonNullable<typeof u> => u !== null)
        .sort((a, b) => a.full_name.localeCompare(b.full_name))
        || []

    return <LoginForm users={validUsers} />
}
