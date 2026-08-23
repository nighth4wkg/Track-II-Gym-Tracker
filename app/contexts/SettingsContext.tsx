"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SettingsViewContentProps } from "../components/SettingsViewContent";

const SettingsContext = createContext<SettingsViewContentProps | null>(null);

export function SettingsProvider({ value, children }: { value: SettingsViewContentProps; children: ReactNode }) {
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettingsContext() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettingsContext must be used inside SettingsProvider");
  return context;
}
