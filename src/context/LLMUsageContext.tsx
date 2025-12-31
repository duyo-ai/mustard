"use client";

/* LLM Usage Context - Global state for tracking LLM calls */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type {
  LLMUsageLog,
  LLMUsageSession,
  LLMOperation,
} from "@/lib/core/types";

interface LLMUsageContextValue {
  /* State */
  session: LLMUsageSession;
  isLoading: boolean;
  activeOperation: LLMOperation | null;

  /* Actions */
  addLog: (log: LLMUsageLog) => void;
  setLoading: (operation: LLMOperation | null) => void;
  clearLogs: () => void;

  /* Computed */
  getLogsByOperation: (operation: LLMOperation) => LLMUsageLog[];
  exportAsJSON: () => string;
}

const LLMUsageContext = createContext<LLMUsageContextValue | null>(null);

function createEmptySession(): LLMUsageSession {
  return {
    startedAt: new Date().toISOString(),
    logs: [],
    totals: {
      tokens: 0,
      cost: 0,
      calls: 0,
    },
  };
}

export function LLMUsageProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<LLMUsageSession>(createEmptySession);
  const [isLoading, setIsLoading] = useState(false);
  const [activeOperation, setActiveOperation] = useState<LLMOperation | null>(
    null
  );

  const addLog = useCallback((log: LLMUsageLog) => {
    setSession((prev) => {
      const newLogs = [...prev.logs, log];
      const newTotals = {
        tokens: prev.totals.tokens + log.tokens.total,
        cost: prev.totals.cost + log.cost.total,
        calls: prev.totals.calls + 1,
      };

      return {
        ...prev,
        logs: newLogs,
        totals: newTotals,
      };
    });
  }, []);

  const setLoading = useCallback((operation: LLMOperation | null) => {
    setIsLoading(operation !== null);
    setActiveOperation(operation);
  }, []);

  const clearLogs = useCallback(() => {
    setSession(createEmptySession());
  }, []);

  const getLogsByOperation = useCallback(
    (operation: LLMOperation) => {
      return session.logs.filter((log) => log.operation === operation);
    },
    [session.logs]
  );

  const exportAsJSON = useCallback(() => {
    const exportData = {
      session: {
        startedAt: session.startedAt,
        exportedAt: new Date().toISOString(),
        totalTokens: session.totals.tokens,
        totalCost: session.totals.cost,
        callCount: session.totals.calls,
      },
      logs: session.logs,
    };
    return JSON.stringify(exportData, null, 2);
  }, [session]);

  const value = useMemo(
    () => ({
      session,
      isLoading,
      activeOperation,
      addLog,
      setLoading,
      clearLogs,
      getLogsByOperation,
      exportAsJSON,
    }),
    [
      session,
      isLoading,
      activeOperation,
      addLog,
      setLoading,
      clearLogs,
      getLogsByOperation,
      exportAsJSON,
    ]
  );

  return (
    <LLMUsageContext.Provider value={value}>
      {children}
    </LLMUsageContext.Provider>
  );
}

export function useLLMUsage() {
  const context = useContext(LLMUsageContext);
  if (!context) {
    throw new Error("useLLMUsage must be used within LLMUsageProvider");
  }
  return context;
}

/**
 * Generate a unique log ID.
 */
export function generateLogId(): string {
  return `log_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
