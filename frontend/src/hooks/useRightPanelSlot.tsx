"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

interface RightPanelSlotContextValue {
  slotContent: ReactNode;
  setSlotContent: (content: ReactNode) => void;
  clearSlotContent: () => void;
}

const RightPanelSlotContext = createContext<RightPanelSlotContextValue>({
  slotContent: null,
  setSlotContent: () => {},
  clearSlotContent: () => {},
});

export function RightPanelSlotProvider({ children }: { children: ReactNode }) {
  const [slotContent, setSlotContent] = useState<ReactNode>(null);
  const clearSlotContent = useCallback(() => setSlotContent(null), []);
  const setStableSlotContent = useCallback((content: ReactNode) => setSlotContent(content), []);

  return (
    <RightPanelSlotContext.Provider value={{ slotContent, setSlotContent: setStableSlotContent, clearSlotContent }}>
      {children}
    </RightPanelSlotContext.Provider>
  );
}

/** Read the current slot content (used by RightPanel). */
export function useRightPanelSlot() {
  return useContext(RightPanelSlotContext).slotContent;
}

/**
 * Inject ReactNode content into the right panel slot.
 * Automatically clears on unmount.
 */
export function useSetRightPanelSlot(content: ReactNode, slotKey = "default") {
  const { setSlotContent, clearSlotContent } = useContext(RightPanelSlotContext);

  useEffect(() => {
    setSlotContent(content);
    // The slot is intentionally keyed by caller-provided state instead of raw JSX identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setSlotContent, slotKey]);

  useEffect(() => clearSlotContent, [clearSlotContent]);
}
