import { requireInternalRole } from '@/lib/auth/permissions';
import type { TicketFilters } from './queries';

// In-memory storage for saved searches (could be moved to database later)
// Key: userId, Value: array of saved searches
const savedSearchesCache = new Map<
  string,
  Array<{ id: string; name: string; filters: TicketFilters }>
>();

export async function saveSearch(name: string, filters: TicketFilters) {
  const user = await requireInternalRole();
  const searches = savedSearchesCache.get(user.id) || [];
  const newSearch = {
    id: Math.random().toString(36).substring(7),
    name,
    filters,
  };
  searches.push(newSearch);
  savedSearchesCache.set(user.id, searches);
  return newSearch;
}

export async function getSavedSearches() {
  const user = await requireInternalRole();
  return savedSearchesCache.get(user.id) || [];
}

export async function deleteSavedSearch(searchId: string) {
  const user = await requireInternalRole();
  const searches = savedSearchesCache.get(user.id) || [];
  const filtered = searches.filter((s) => s.id !== searchId);
  savedSearchesCache.set(user.id, filtered);
}

