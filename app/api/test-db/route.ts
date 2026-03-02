import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
    const admin = createAdminClient();
    const { data: roteiros, error } = await admin.from('roteiros').select('id, roteiro_comments:roteiro_comments(count)').limit(5);
    return NextResponse.json({ roteiros, error });
}
