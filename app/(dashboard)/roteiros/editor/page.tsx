import { RoteiroEditorView } from "@/components/dashboard/roteiros/roteiro-editor-view"

export default function RoteiroEditorPage() {
    return (
        <div className="flex flex-1 flex-col w-full bg-slate-50/50 dark:bg-slate-900/50 min-h-screen">
            <main className="flex-1 overflow-x-hidden p-6">
                <RoteiroEditorView />
            </main>
        </div>
    )
}
