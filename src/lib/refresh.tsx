"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

/** Available auto-refresh intervals in seconds. 0 = off. */
export const REFRESH_INTERVALS = [0, 5, 10, 20, 30, 60] as const;
export type RefreshInterval = (typeof REFRESH_INTERVALS)[number];

type RefreshContextValue = {
  /** Increments on every refresh (manual or auto). Add to useEffect deps to re-fetch data. */
  refreshCount: number;
  /** Trigger a manual refresh */
  refresh: () => void;
  /** Current auto-refresh interval in seconds. 0 = off. */
  autoRefreshInterval: RefreshInterval;
  setAutoRefreshInterval: (seconds: RefreshInterval) => void;
};

const RefreshContext = createContext<RefreshContextValue>({
  refreshCount: 0,
  refresh: () => {},
  autoRefreshInterval: 0,
  setAutoRefreshInterval: () => {},
});

export function RefreshProvider({ children }: { children: React.ReactNode }) {
  const [refreshCount, setRefreshCount] = useState(0);
  const [autoRefreshInterval, setAutoRefreshIntervalState] = useState<RefreshInterval>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const refresh = () => setRefreshCount((c) => c + 1);

  const setAutoRefreshInterval = (seconds: RefreshInterval) => {
    clearInterval(intervalRef.current);
    setAutoRefreshIntervalState(seconds);
    if (seconds > 0) {
      intervalRef.current = setInterval(
        () => setRefreshCount((c) => c + 1),
        seconds * 1000
      );
    }
  };

  useEffect(() => () => clearInterval(intervalRef.current), []);

  return (
    <RefreshContext.Provider value={{ refreshCount, refresh, autoRefreshInterval, setAutoRefreshInterval }}>
      {children}
    </RefreshContext.Provider>
  );
}

export function useRefresh() {
  return useContext(RefreshContext);
}
