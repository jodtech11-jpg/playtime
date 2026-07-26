import { Membership, MembershipPlan } from '../types';

/** Play Time Pro / player membership plan (not a vendor venue subscription). */
export const isPlatformPlan = (plan: Pick<MembershipPlan, 'venueId' | 'scope'>): boolean => {
  if (plan.scope === 'platform') return true;
  if (plan.scope === 'venue') return false;
  const venueId = (plan.venueId || '').trim();
  return !venueId || venueId === 'platform';
};

/** Vendor venue subscription plan. */
export const isVenueSubscriptionPlan = (
  plan: Pick<MembershipPlan, 'venueId' | 'scope'>
): boolean => !isPlatformPlan(plan);

/** Purchased Play Time Pro membership. */
export const isPlatformMembership = (
  membership: Pick<Membership, 'venueId'>
): boolean => {
  const venueId = (membership.venueId || '').trim();
  return !venueId || venueId === 'platform';
};

/** Purchased vendor venue subscription. */
export const isVenueSubscriptionMembership = (
  membership: Pick<Membership, 'venueId'>
): boolean => !isPlatformMembership(membership);
