import { NextResponse } from "next/server";
import { createMetaService } from "@/lib/meta-api/service";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const adId = searchParams.get('ad_id');

        if (!adId) return NextResponse.json({ error: "No ad_id" });

        const admin = createAdminClient();
        const { data: accounts } = await admin.from('ad_accounts').select('provider_account_id').eq('status', 'active').limit(1);
        if (!accounts || accounts.length === 0) return NextResponse.json({ error: "No accounts" });

        const service = await createMetaService(accounts[0].provider_account_id);
        if (!service) return NextResponse.json({ error: "No service" });

        // Facebook Ad Previews endpoint: GET /{ad_id}/previews?ad_format=DESKTOP_FEED_STANDARD
        const previewParam = {
            ad_format: 'INSTAGRAM_STANDARD'
        };
        const rawData = await (service as any).fetch(`${adId}/previews`, previewParam, true);

        return NextResponse.json({
            success: true,
            rawData
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message, stack: e.stack });
    }
}
