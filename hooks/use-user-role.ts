'use client'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export function useUserRole() {
    const [role, setRole] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        async function fetchRole() {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (user) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('role')
                        .eq('id', user.id)
                        .single()
                    setRole(profile?.role ?? null)
                }
            } catch (error) {
                console.error('Error fetching role:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchRole()
    }, [supabase])

    return { role, loading }
}
