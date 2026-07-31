import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientId = url.pathname.split('/').pop();
  return NextResponse.json({ clientId });
}

export async function PUT(request: Request) {
  const url = new URL(request.url);
  const clientId = url.pathname.split('/').pop();
  const body = await request.json();
  const supabase = createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const { data, error } = await supabase
    .from('clients')
    .update(body)
    .eq('id', clientId)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const clientId = url.pathname.split('/').pop();
  const supabase = createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const { error } = await supabase.from('clients').delete().eq('id', clientId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}
