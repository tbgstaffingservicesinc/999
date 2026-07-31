import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';

export async function POST(request: Request) {
  const body = await request.json();
  const supabase = createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const { data, error } = await supabase.from('clients').insert(body).select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
