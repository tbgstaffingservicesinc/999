import { ImportEngine } from '@/modules/import';
import { createRepositoryContext } from '@/infrastructure/repositories/supabase';

export async function createImportEngine(): Promise<ImportEngine> {
  return new ImportEngine(await createRepositoryContext());
}

