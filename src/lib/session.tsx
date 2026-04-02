"use client";

/**
 * SessionContext — single source of truth for the authenticated user.
 *
 * Fetches GET /api/me once per pathname change and makes the result
 * available to any component via useSession().  A single fetch is shared
 * across the whole component tree, so UserMenu, AppSidebar, and any
 * permission-guarded UI all stay in sync without duplicate requests.
 *
 * Usage:
 *   const { status, user, isAdmin } = useSession();
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SessionUser = {
  id:       string;
  username: string;
  role:     "admin" | "user";
};

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

export interface SessionState {
  status: SessionStatus;
  user?:  SessionUser;
}

export interface SessionContextValue extends SessionState {
  /** Convenience flag — true only when role is "admin". */
  isAdmin: boolean;
  /** Force a fresh fetch (e.g. after login / role change). */
  refresh: () => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const SessionContext = createContext<SessionContextValue>({
  status:  "loading",
  isAdmin: false,
  refresh: () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────

export function SessionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<SessionState>({ status: "loading" });

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      if (!res.ok) {
        setState({ status: "unauthenticated" });
        return;
      }
      const data = await res.json() as {
        authenticated: boolean;
        user?: { id: string; username: string; role: string };
      };
      if (data.authenticated && data.user) {
        setState({
          status: "authenticated",
          user: {
            id:       data.user.id,
            username: data.user.username,
            role:     data.user.role === "admin" ? "admin" : "user",
          },
        });
      } else {
        setState({ status: "unauthenticated" });
      }
    } catch {
      setState({ status: "unauthenticated" });
    }
  }, []);

  // Re-fetch on every client-side navigation so stale state is impossible.
  useEffect(() => { fetchSession(); }, [fetchSession, pathname]);

  const value: SessionContextValue = {
    ...state,
    isAdmin: state.user?.role === "admin",
    refresh: fetchSession,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSession(): SessionContextValue {
  return useContext(SessionContext);
}
