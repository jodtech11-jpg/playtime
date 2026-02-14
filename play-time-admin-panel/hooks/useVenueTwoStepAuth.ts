import { useState, useCallback } from 'react';
import { useVenueTwoStepAuth } from '../contexts/VenueTwoStepAuthContext';

/**
 * Hook to trigger two-step authentication for venue operations
 * Returns a function that ensures user is verified before proceeding
 */
export const useRequireVenueAuth = () => {
  const { isVerified, clearVerification } = useVenueTwoStepAuth();
  const [showModal, setShowModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const requireAuth = useCallback((action: () => void, actionDescription: string = 'perform this action') => {
    if (isVerified) {
      // User is already verified, proceed with action
      action();
    } else {
      // User needs to verify, store action and show modal
      setPendingAction(() => action);
      setShowModal(true);
    }
  }, [isVerified]);

  const handleVerified = useCallback(() => {
    setShowModal(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  }, [pendingAction]);

  const handleCancel = useCallback(() => {
    setShowModal(false);
    setPendingAction(null);
  }, []);

  return {
    requireAuth,
    showModal,
    handleVerified,
    handleCancel,
    isVerified
  };
};

