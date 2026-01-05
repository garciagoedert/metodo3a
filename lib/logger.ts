import { createClient } from "@supabase/supabase-js"

type LogStatus = "success" | "warning" | "error"

/**
 * Logs an activity to the system_logs table.
 * Uses a direct Supabase Service Role client to bypass RLS, ensuring integrity.
 */
export async function logActivity(
    action: string,
    status: LogStatus,
    details: string,
    userId?: string | null,
    userName?: string | null,
    userEmail?: string | null
) {
    try {
        // We use a fresh client here with service role to ensure we can always write logs
        // regardless of the current user's RLS permissions.
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        const { error } = await supabase.from("system_logs").insert({
            user_id: userId || null,
            user_name: userName || "System",
            user_email: userEmail || "system@bot",
            action,
            status,
            details,
        })

        if (error) {
            console.error("Failed to log activity:", error)
        }
    } catch (e) {
        console.error("Exception logging activity:", e)
    }
}
