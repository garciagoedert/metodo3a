import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'

// Cache the role fetch for the request duration
export const getUserRole = cache(async () => {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    return profile?.role
})
