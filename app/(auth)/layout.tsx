export default function AuthLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-200/40 via-purple-100/40 to-white dark:from-indigo-950/40 dark:via-purple-950/40 dark:to-slate-950">
            {children}
        </div>
    )
}
