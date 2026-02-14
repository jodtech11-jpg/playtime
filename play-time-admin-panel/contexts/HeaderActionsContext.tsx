import React, { createContext, useContext, useState, useCallback } from 'react';

interface HeaderActionsContextType {
  onNewEntry: () => void;
  hasHandler: boolean;
  setNewEntryHandler: (handler: () => void) => void;
  unsetNewEntryHandler: () => void;
}

const HeaderActionsContext = createContext<HeaderActionsContextType | undefined>(undefined);

export const HeaderActionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [newEntryHandler, setNewEntryHandlerState] = useState<(() => void) | null>(null);

  const setNewEntryHandler = useCallback((handler: () => void) => {
    setNewEntryHandlerState(() => handler);
  }, []);

  const unsetNewEntryHandler = useCallback(() => {
    setNewEntryHandlerState(null);
  }, []);

  const onNewEntry = useCallback(() => {
    if (newEntryHandler) {
      try {
        newEntryHandler();
      } catch (error) {
        console.error('Error executing new entry handler:', error);
        throw error;
      }
    } else {
      console.warn('No new entry handler registered for current page');
      // Don't throw error, just log warning
    }
  }, [newEntryHandler]);

  return (
    <HeaderActionsContext.Provider
      value={{
        onNewEntry,
        hasHandler: newEntryHandler !== null,
        setNewEntryHandler,
        unsetNewEntryHandler,
      }}
    >
      {children}
    </HeaderActionsContext.Provider>
  );
};

export const useHeaderActions = () => {
  const context = useContext(HeaderActionsContext);
  if (!context) {
    throw new Error('useHeaderActions must be used within HeaderActionsProvider');
  }
  return context;
};

