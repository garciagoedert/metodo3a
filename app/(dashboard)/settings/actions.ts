'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ProfileSchema, PasswordSchema } from './schema'
import { z } from 'zod'

import { logActivity } from "@/lib/logger"

export async function updateProfile(data: z.infer<typeof ProfileSchema>) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Usuário não autenticado' }
    }

    const { error } = await supabase.auth.updateUser({
        data: {
            full_name: data.full_name,
            avatar_url: data.avatar_url
        }
    })

    if (error) {
        await logActivity("Atualização de Perfil", "error", `Erro: ${error.message}`, user.id, user.user_metadata?.full_name, user.email)
        return { error: error.message }
    }

    await logActivity("Atualização de Perfil", "success", "Usuário alterou nome/avatar", user.id, data.full_name, user.email)
    revalidatePath('/settings')
    return { success: 'Perfil atualizado com sucesso!' }
}

export async function updatePassword(data: z.infer<typeof PasswordSchema>) {
    const supabase = await createClient()

    const { error } = await supabase.auth.updateUser({
        password: data.password
    })

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/settings')
    return { success: 'Senha atualizada com sucesso!' }
}
