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
      <span className="pointer-events-none absolute left-2.5 text-gray-400 select-none">
        {icon}
      </span>
      <input
        type="search"
        value={local}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full rounded border border-gray-300 bg-white py-1.5 pl-8 pr-3 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
      />
    </div>
  );
}
