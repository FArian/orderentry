"use client";

/**
 * SessionContext — single source of truth for the authenticated user.
 *
 * Fetches GET /api/me once on mount. Call refresh() explicitly after
 * login or logout. A single fetch is shared across the whole component
 * tree — UserMenu, AppSidebar, and permission-guarded UI stay in sync.
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

// ── Types ─────────────────────────────────────────────────────────────────────

export type SessionUser = {
  id:           string;
  username:     string;
  role:         "admin" | "user";
  orgGln?:      string;
  orgFhirId?:   string;
  orgName?:     string;
  hasOrgAccess: boolean;
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
        user?: {
          id: string; username: string; role: string;
          orgGln?: string; orgFhirId?: string; orgName?: string; hasOrgAccess?: boolean;
        };
      };
      if (data.authenticated && data.user) {
        setState({
          status: "authenticated",
          user: {
            id:           data.user.id,
            username:     data.user.username,
            role:         data.user.role === "admin" ? "admin" : "user",
            hasOrgAccess: data.user.hasOrgAccess ?? false,
            ...(data.user.orgGln    !== undefined && { orgGln:    data.user.orgGln }),
            ...(data.user.orgFhirId !== undefined && { orgFhirId: data.user.orgFhirId }),
            ...(data.user.orgName   !== undefined && { orgName:   data.user.orgName }),
          },
        });
      } else {
        setState({ status: "unauthenticated" });
      }
    } catch {
      setState({ status: "unauthenticated" });
    }
  }, []);

  // Fetch once on mount. Use refresh() explicitly after login/logout.
  // Re-fetching on every pathname change caused a /api/me round-trip per navigation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchSession(); }, []);

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
