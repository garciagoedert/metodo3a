import { createClient } from "@/lib/supabase/server"
import { ProfileForm } from "./profile-form"
import { redirect } from "next/navigation"

export default async function SettingsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    const userData = {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || "",
        avatar_url: user.user_metadata?.avatar_url || "",
    }

    return (
        <div className="flex flex-1 flex-col gap-4">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Perfil</h2>
            </div>
            <ProfileForm user={userData} />
        </div>
    )
}
