/**
 * Vendor (venue_manager) data scoping helpers.
 * Vendors are scoped by Firebase Auth UID stored as `vendorId` on documents.
 */

export type FirestoreFilter = {
  field: string;
  operator: string;
  value: unknown;
};

/** Build the vendorId equality filter for Firestore queries. */
export const vendorIdFilter = (uid: string): FirestoreFilter => ({
  field: 'vendorId',
  operator: '==',
  value: uid,
});

/** Stamp vendorId onto a create/update payload when the actor is a vendor. */
export const withVendorId = <T extends Record<string, unknown>>(
  data: T,
  uid: string | undefined
): T & { vendorId?: string } => {
  if (!uid) return data;
  return { ...data, vendorId: uid };
};
