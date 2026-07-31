import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigurationErrorResponse } from '@/lib/http-configuration';

export async function POST(request: Request) {
  const configurationError = supabaseConfigurationErrorResponse();
  if (configurationError) return configurationError;
  const body = await request.json();
  const supabase = await createClient();

  const { data, error } = await supabase.from('clients').insert(body).select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}



