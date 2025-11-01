"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

type HeaderAction = {
  label?: string;
  onClick?: () => void;
  component?: React.ReactNode;
} | null;

type HeaderContextType = {
  headerAction: HeaderAction;
  setHeaderAction: (action: HeaderAction) => void;
};

const HeaderContext = createContext<HeaderContextType | undefined>(undefined);

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [headerAction, setHeaderAction] = useState<HeaderAction>(null);

  return (
    <HeaderContext.Provider value={{ headerAction, setHeaderAction }}>
      {children}
    </HeaderContext.Provider>
  );
}

export function useHeaderAction() {
  const context = useContext(HeaderContext);
  if (context === undefined) {
    throw new Error("useHeaderAction must be used within a HeaderProvider");
  }
  return context;
}
