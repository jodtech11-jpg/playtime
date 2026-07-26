import { auth } from './firebase';
import { getCloudFunctionsBaseUrl } from './userAccountService';
import { getFirebaseErrorMessage } from '../utils/errorUtils';
import { IntegrationHealth, TournamentMatch } from '../types';

export class AdminApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'AdminApiError';
  }
}

export async function callTrustedAdminApi<T>(
  endpoint: string,
  body: Record<string, unknown> = {}
): Promise<T> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new AdminApiError('You must be signed in to perform this action.', 401);

  const response = await fetch(`${getCloudFunctionsBaseUrl()}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await currentUser.getIdToken()}`,
    },
    body: JSON.stringify(body),
  });

  const rawBody = await response.text();
  let parsed: any = {};
  try {
    parsed = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    parsed = { error: rawBody };
  }

  if (!response.ok) {
    const fallback = response.status === 404
      ? `Admin endpoint "${endpoint}" is not deployed.`
      : `Admin request failed (${response.status}).`;
    throw new AdminApiError(
      getFirebaseErrorMessage({ message: parsed.error || parsed.message }, fallback),
      response.status
    );
  }
  return parsed as T;
}

export interface MarketplaceRefundResult {
  refundId: string;
  status: string;
  amountPaise: number;
}

export const requestMarketplaceRefund = (paymentId: string, amount: number, reason: string) =>
  callTrustedAdminApi<MarketplaceRefundResult>('createRazorpayRefund', {
    paymentId,
    amountPaise: Math.round(amount * 100),
    reason,
  });

export interface WalletAdjustmentResult {
  transactionId: string;
}

export const adjustUserWallet = (
  userId: string,
  type: 'Credit' | 'Debit',
  amount: number,
  reason: string
) => callTrustedAdminApi<WalletAdjustmentResult>('adjustWallet', {
  userId,
  amountPaise: Math.round(amount * 100) * (type === 'Debit' ? -1 : 1),
  reason,
  idempotencyKey: crypto.randomUUID(),
});

export const banUserAccount = (userId: string, reason: string, venueId?: string) =>
  callTrustedAdminApi<{ success: true; userId: string }>('banUser', {
    userId,
    reason,
    ...(venueId ? { venueId } : {}),
  });

export const getIntegrationHealth = (integration: 'razorpay' | 'whatsapp') =>
  callTrustedAdminApi<IntegrationHealth>('integrationHealth', { integration });

export const sendTrustedWhatsAppMessage = (phone: string, message: string) =>
  callTrustedAdminApi<{ success: true }>('sendWhatsAppMessage', { phone, message });

export const generateTournamentBracket = (
  tournamentId: string,
  teamIds: string[]
) => callTrustedAdminApi<{ tournamentId: string; matches: TournamentMatch[] }>(
  'generateTournamentBracket',
  { tournamentId, teamIds, format: 'Single Elimination' }
);
