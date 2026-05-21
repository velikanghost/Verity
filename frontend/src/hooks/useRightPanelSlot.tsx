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

export function useRightPanelSlot() {
  return useContext(RightPanelSlotContext).slotContent;
}

export function useSetRightPanelSlot(content: ReactNode, slotKey = "default") {
  const { setSlotContent, clearSlotContent } = useContext(RightPanelSlotContext);

  useEffect(() => {
    setSlotContent(content);
  }, [setSlotContent, slotKey]);

  useEffect(() => clearSlotContent, [clearSlotContent]);
}
