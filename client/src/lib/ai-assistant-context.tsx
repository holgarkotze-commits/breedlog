import { createContext, useContext, useState, useCallback } from "react";

export interface AIAssistantOptions {
  category?: string;
  prompt?: string;
  contextSection?: string;
  animalId?: number;
}

interface AIAssistantContextType {
  isOpen: boolean;
  initialOptions: AIAssistantOptions;
  openPanel: (opts?: AIAssistantOptions) => void;
  closePanel: () => void;
}

const AIAssistantContext = createContext<AIAssistantContextType>({
  isOpen: false,
  initialOptions: {},
  openPanel: () => {},
  closePanel: () => {},
});

export function AIAssistantProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialOptions, setInitialOptions] = useState<AIAssistantOptions>({});

  const openPanel = useCallback((opts?: AIAssistantOptions) => {
    setInitialOptions(opts || {});
    setIsOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <AIAssistantContext.Provider value={{ isOpen, initialOptions, openPanel, closePanel }}>
      {children}
    </AIAssistantContext.Provider>
  );
}

export function useAIAssistant() {
  return useContext(AIAssistantContext);
}
