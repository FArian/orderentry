"use client";

/**
 * useIdleTimeout — automatic session logout after inactivity.
 *
 * Fetches SESSION_IDLE_TIMEOUT_MINUTES from /api/idle-timeout once per mount.
 * Tracks user activity via DOM events. Shows a warning dialog 2 minutes before
 * the session expires, then calls POST /api/logout and redirects to /login.
 *
 * Only active when `isAuthenticated` is true.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** Seconds before timeout at which the warning modal appears. */
const WARNING_SECONDS = 120;

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "click",
  "scroll",
] as const;

export interface IdleTimeoutState {
  /** Whether the warning dialog should be visible. */
  showWarning:      boolean;
  /** Countdown seconds remaining until forced logout. */
  secondsRemaining: number;
  /** Reset the idle timer (user clicked "Weiterarbeiten"). */
  reset:            () => void;
}

export function useIdleTimeout(isAuthenticated: boolean): IdleTimeoutState {
  const router = useRouter();
  const [timeoutMinutes, setTimeoutMinutes] = useState(0);
  const [showWarning,      setShowWarning]      = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(WARNING_SECONDS);

  const warningTimerRef  = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const countdownRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const showWarningRef   = useRef(false); // ref copy avoids stale closures in listeners

  // ── Fetch config once ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isAuthenticated) return;
    fetch("/api/idle-timeout", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ minutes: number }>) : Promise.resolve({ minutes: 0 })))
      .then((data) => { if (data.minutes > 0) setTimeoutMinutes(data.minutes); })
      .catch(() => { /* silent — feature disabled on error */ });
  }, [isAuthenticated]);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const clearTimers = useCallback(() => {
    if (warningTimerRef.current) { clearTimeout(warningTimerRef.current);  warningTimerRef.current = null; }
    if (countdownRef.current)    { clearInterval(countdownRef.current);    countdownRef.current    = null; }
  }, []);

  const doLogout = useCallback(() => {
    clearTimers();
    fetch("/api/logout", { method: "POST" }).finally(() => {
      router.push("/login?reason=idle");
    });
  }, [clearTimers, router]);

  // ── Start/reset the idle timer ───────────────────────────────────────────────

  const reset = useCallback(() => {
    if (!timeoutMinutes || !isAuthenticated) return;

    clearTimers();
    showWarningRef.current = false;
    setShowWarning(false);

    const totalSeconds   = timeoutMinutes * 60;
    const warnSeconds    = Math.min(WARNING_SECONDS, totalSeconds);
    const waitBeforeWarn = Math.max((totalSeconds - warnSeconds) * 1000, 0);

    // After (timeout − warnSeconds): show warning + start countdown
    warningTimerRef.current = setTimeout(() => {
      showWarningRef.current = true;
      setShowWarning(true);

      let remaining = warnSeconds;
      setSecondsRemaining(remaining);

      countdownRef.current = setInterval(() => {
        remaining -= 1;
        setSecondsRemaining(remaining);
        if (remaining <= 0) {
          clearInterval(countdownRef.current!);
          countdownRef.current = null;
          doLogout();
        }
      }, 1_000);
    }, waitBeforeWarn);
  }, [timeoutMinutes, isAuthenticated, clearTimers, doLogout]);

  // ── Kick off when config is ready ───────────────────────────────────────────

  useEffect(() => {
    if (!timeoutMinutes || !isAuthenticated) return;
    reset();
    return clearTimers;
  }, [timeoutMinutes, isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Activity listeners — reset timer on any user action ─────────────────────

  useEffect(() => {
    if (!timeoutMinutes || !isAuthenticated) return;

    const handleActivity = () => {
      // Don't reset once the warning is shown — user must click "Weiterarbeiten"
      if (!showWarningRef.current) reset();
    };

    ACTIVITY_EVENTS.forEach((e) =>
      window.addEventListener(e, handleActivity, { passive: true }),
    );
    return () =>
      ACTIVITY_EVENTS.forEach((e) =>
        window.removeEventListener(e, handleActivity),
      );
  }, [timeoutMinutes, isAuthenticated, reset]);

  return { showWarning, secondsRemaining, reset };
}
