"use client";

import React, { createContext, useContext, useState } from "react";

type ActiveGroupContextValue = {
  activeGroupId: string | null;
  setActiveGroupId: (id: string | null) => void;
};

const ActiveGroupContext = createContext<ActiveGroupContextValue | undefined>(
  undefined,
);

export function ActiveGroupProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  return (
    <ActiveGroupContext.Provider value={{ activeGroupId, setActiveGroupId }}>
      {children}
    </ActiveGroupContext.Provider>
  );
}

export function useActiveGroup() {
  const ctx = useContext(ActiveGroupContext);
  if (!ctx) {
    throw new Error("useActiveGroup must be used within ActiveGroupProvider");
  }
  return ctx;
}

export function canViewToolsFor(
  groupId?: string | null,
  activeGroupId?: string | null,
) {
  if (!groupId) return true;
  if (!activeGroupId) return true;
  return groupId === activeGroupId;
}
