import { deleteField, serverTimestamp } from 'firebase/firestore';
import { venuesCollection } from '../services/firebase';

/**
 * Keep venues/{id}.managerId in sync with users/{id}.managedVenues.
 * Call after creating/updating a venue manager's assigned venues.
 */
export async function syncVenueManagersForUser(
  userId: string,
  nextManagedVenues: string[] = [],
  previousManagedVenues: string[] = []
): Promise<void> {
  if (!userId) return;

  const next = new Set(nextManagedVenues.filter(Boolean));
  const prev = new Set(previousManagedVenues.filter(Boolean));

  const added = [...next].filter((id) => !prev.has(id));
  const removed = [...prev].filter((id) => !next.has(id));

  await Promise.all([
    ...added.map((venueId) =>
      venuesCollection.update(venueId, {
        managerId: userId,
        updatedAt: serverTimestamp(),
      })
    ),
    ...removed.map(async (venueId) => {
      const venue = (await venuesCollection.get(venueId)) as { managerId?: string } | null;
      if (venue?.managerId === userId) {
        await venuesCollection.update(venueId, {
          managerId: deleteField(),
          updatedAt: serverTimestamp(),
        });
      }
    }),
  ]);
}
