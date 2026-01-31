'use server';

import { saveSearch, getSavedSearches, deleteSavedSearch } from '@/lib/tickets/saved-searches';
import { revalidatePath } from 'next/cache';
import type { TicketFilters } from '@/lib/tickets/queries';

export async function saveSearchAction(name: string, filters: TicketFilters) {
  const search = await saveSearch(name, filters);
  revalidatePath('/app');
  return { search, error: null };
}

export async function getSavedSearchesAction() {
  return await getSavedSearches();
}

export async function deleteSavedSearchAction(searchId: string) {
  await deleteSavedSearch(searchId);
  revalidatePath('/app');
  return { error: null };
}

