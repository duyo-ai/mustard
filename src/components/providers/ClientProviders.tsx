"use client";

/* Client-side providers wrapper */

import { LLMUsageProvider } from "@/context/LLMUsageContext";
import type { ReactNode } from "react";

export function ClientProviders({ children }: { children: ReactNode }) {
  return <LLMUsageProvider>{children}</LLMUsageProvider>;
}
