"use client";

import { useEffect, useRef, useState } from "react";

interface SearchBarProps {
  placeholder?: string;
  value?: string;
  onChange: (value: string) => void;
  /** Debounce delay in ms (default: 350) */
  debounce?: number;
  className?: string;
  icon?: string;
}

/**
 * Controlled search input with built-in debounce.
 * Calls `onChange` after the user stops typing for `debounce` ms.
 */
export function SearchBar({
  placeholder = "Suchen…",
  value: externalValue = "",
  onChange,
  debounce = 350,
  className = "",
  icon = "🔍",
}: SearchBarProps) {
  const [local, setLocal] = useState(externalValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external value changes (e.g. reset from parent).
  useEffect(() => {
    setLocal(externalValue);
  }, [externalValue]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setLocal(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(v), debounce);
  }

  return (
    <div className={`relative flex items-center ${className}`}>
      <span className="pointer-events-none absolute left-2.5 text-zt-text-tertiary select-none">
        {icon}
      </span>
      <input
        type="search"
        value={local}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full rounded border border-zt-border bg-zt-bg-card py-1.5 pl-8 pr-3 text-sm text-zt-text-primary placeholder:text-zt-text-tertiary focus:border-zt-primary focus:outline-none focus:ring-1 focus:ring-zt-primary/20"
      />
    </div>
  );
}
