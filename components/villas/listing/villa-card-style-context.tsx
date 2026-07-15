"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

import type { SiteVillaCardStyle } from "@/lib/site-web-styles/types";

const VillaCardStyleContext = createContext<SiteVillaCardStyle>("classic");

export function VillaCardStyleProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: SiteVillaCardStyle;
}) {
  return (
    <VillaCardStyleContext.Provider value={value}>
      {children}
    </VillaCardStyleContext.Provider>
  );
}

export function useVillaCardStyle() {
  return useContext(VillaCardStyleContext);
}
