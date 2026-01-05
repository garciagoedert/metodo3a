'use server'

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

import { logActivity } from "@/lib/logger"

export async function getUsers() {
    // ... existing code ...
    const supabase = await createClient()
    const admin = createAdminClient()

    // ... (rest of getUsers is fine, we don't log "view" usually)
    // 1. Check if current user is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Unauthorized" }

    const { data: currentUserProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (currentUserProfile?.role !== 'admin') {
        return { error: "Forbidden" }
    }

    // 2. Fetch all profiles
    const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

    if (profilesError) return { error: profilesError.message }

    // 3. Fetch all auth users (to get emails)
    const { data: { users }, error: authError } = await admin.auth.admin.listUsers()

    if (authError) return { error: authError.message }

    // 4. Merge data
    const usersWithProfiles = users.map(u => {
        const profile = profiles.find(p => p.id === u.id)
        return {
            id: u.id,
            email: u.email,
            full_name: profile?.full_name || u.user_metadata?.full_name || 'N/A',
            role: profile?.role || 'cs_agent', // Default fallback
            avatar_url: profile?.avatar_url || u.user_metadata?.avatar_url || null,
            created_at: profile?.created_at || u.created_at,
            deleted_at: profile?.deleted_at || null
        }
    }).filter(user => !user.deleted_at) // Filter out soft-deleted users
        .sort((a, b) => a.full_name.localeCompare(b.full_name, 'pt-BR', { sensitivity: 'base' }))

    return { data: usersWithProfiles }
}

export async function createUser(formData: FormData) {
    const admin = createAdminClient()
    const supabase = await createClient()

    // Get current admin info for logging
    const { data: { user: currentUser } } = await supabase.auth.getUser()

    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const fullName = formData.get('full_name') as string
    const role = formData.get('role') as string
    const avatarUrl = formData.get('avatar_url') as string

    // 1. Create Auth User
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, avatar_url: avatarUrl || null }
    })

    if (authError) {
        if (currentUser) {
            await logActivity("Criação de Usuário", "error", `Erro ao criar user ${email}: ${authError.message}`, currentUser.id, currentUser.user_metadata?.full_name, currentUser.email)
        }
        return { error: authError.message }
    }

    if (!authData.user) return { error: "Failed to create user" }

    // 2. Update Profile Role (Trigger creates profile, we update role)
    // Wait a bit for trigger? Or force upsert. Upsert is safer.
    const { error: profileError } = await admin
        .from('profiles')
        .upsert({
            id: authData.user.id,
            full_name: fullName,
            role: role,
            avatar_url: avatarUrl || null
        })

    if (profileError) {
        if (currentUser) {
            await logActivity("Criação de Usuário", "warning", `User criado mas falha no perfil: ${profileError.message}`, currentUser.id, currentUser.user_metadata?.full_name, currentUser.email)
        }
        return { error: profileError.message }
    }

    if (currentUser) {
        await logActivity("Criação de Usuário", "success", `Criou usuário: ${email} (${role})`, currentUser.id, currentUser.user_metadata?.full_name, currentUser.email)
    }

    revalidatePath('/admin/team')
    return { success: true }
}

export async function updateUser(formData: FormData) {
    const admin = createAdminClient()
    const supabase = await createClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()

    const id = formData.get('id') as string
    // Access individual fields directly instead of reading the whole object
    const role = formData.get('role') as string

    // Check if password is listed to be updated
    const password = formData.get('password') as string

    if (password) {
        const { error: pwError } = await admin.auth.admin.updateUserById(id, { password })
        if (pwError) {
            if (currentUser) await logActivity("Atualização de Usuário", "error", `Erro ao alterar senha ID ${id}: ${pwError.message}`, currentUser.id, currentUser.user_metadata?.full_name, currentUser.email)
            return { error: pwError.message }
        }
    }

    const avatarUrl = formData.get('avatar_url') as string

    // Update role and avatar in profiles
    const updates: { role: string; avatar_url?: string } = { role }
    if (avatarUrl) updates.avatar_url = avatarUrl

    const { error: profileError } = await admin
        .from('profiles')
        .update(updates)
        .eq('id', id)

    if (profileError) {
        if (currentUser) await logActivity("Atualização de Usuário", "error", `Erro ao atualizar role ID ${id}: ${profileError.message}`, currentUser.id, currentUser.user_metadata?.full_name, currentUser.email)
        return { error: profileError.message }
    }

    if (currentUser) {
        await logActivity("Atualização de Usuário", "success", `Atualizou usuário ID ${id} (Role: ${role})`, currentUser.id, currentUser.user_metadata?.full_name, currentUser.email)
    }

    revalidatePath('/admin/team')
    return { success: true }
}

export async function deleteUser(id: string) {
    const admin = createAdminClient()
    const supabase = await createClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()

    // Soft Delete: Update profile deleted_at
    const { error: profileError } = await admin
        .from('profiles')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)

    if (profileError) {
        if (currentUser) await logActivity("Exclusão de Usuário", "error", `Erro ao desativar ID ${id}: ${profileError.message}`, currentUser.id, currentUser.user_metadata?.full_name, currentUser.email)
        return { error: profileError.message }
    }

    // Optional: Ban user in Auth to prevent login? 
    // For now we rely on profile check, but let's strictly ban them if we want to be secure
    const { error: banError } = await admin.auth.admin.updateUserById(id, { ban_duration: "876000h" }) // ~100 years

    if (banError) {
        console.error("Failed to ban user in Auth:", banError)
    }

    if (currentUser) {
        await logActivity("Exclusão de Usuário", "success", `Desativou usuário ID ${id}`, currentUser.id, currentUser.user_metadata?.full_name, currentUser.email)
    }

    revalidatePath('/admin/team')
    return { success: true }
}

export async function restoreUser(id: string) {
    const admin = createAdminClient()
    const supabase = await createClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()

    // Restore: Clear deleted_at
    const { error: profileError } = await admin
        .from('profiles')
        .update({ deleted_at: null })
        .eq('id', id)

    if (profileError) {
        if (currentUser) await logActivity("Restauração de Usuário", "error", `Erro ao restaurar ID ${id}: ${profileError.message}`, currentUser.id, currentUser.user_metadata?.full_name, currentUser.email)
        return { error: profileError.message }
    }

    // Unban user in Auth
    const { error: unbanError } = await admin.auth.admin.updateUserById(id, { ban_duration: "0" })

    if (unbanError) {
        console.error("Failed to unban user:", unbanError)
    }

    if (currentUser) {
        await logActivity("Restauração de Usuário", "success", `Restaurou usuário ID ${id}`, currentUser.id, currentUser.user_metadata?.full_name, currentUser.email)
    }

    revalidatePath('/admin/team')
    return { success: true }
}

export async function permanentDeleteUser(id: string) {
    const admin = createAdminClient()
    const supabase = await createClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()

    // Permanent Delete: Remove from Auth (cascades to profile usually)
    const { error } = await admin.auth.admin.deleteUser(id)

    if (error) {
        if (currentUser) await logActivity("Exclusão Permanente", "error", `Erro ao excluir permanentemente ID ${id}: ${error.message}`, currentUser.id, currentUser.user_metadata?.full_name, currentUser.email)
        return { error: error.message }
    }

    if (currentUser) {
        // Also ensure profile is gone if not cascaded (safeguard)
        await admin.from('profiles').delete().eq('id', id)

        await logActivity("Exclusão Permanente", "success", `Excluiu permanentemente usuário ID ${id}`, currentUser.id, currentUser.user_metadata?.full_name, currentUser.email)
    }

    revalidatePath('/admin/team')
    return { success: true }
}
