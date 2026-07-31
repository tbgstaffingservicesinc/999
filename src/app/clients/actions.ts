import { createClient } from '@/lib/supabase/client';

export async function getClients() {
  const supabase = createClient();
  const { data, error } = await supabase.from('clients').select('*');

  if (error) {
    console.error('Error fetching clients:', error);
    return [];
  }

  return data;
}
