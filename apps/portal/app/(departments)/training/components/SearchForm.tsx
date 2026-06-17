"use client";

import { Search } from "lucide-react";

interface SearchFormProps {
  value?: string;
  placeholder?: string;
  hiddenParams?: Record<string, string>;
}

export function SearchForm({
  value = "",
  placeholder = "Search...",
  hiddenParams = {},
}: SearchFormProps) {
  return (
    <form method="GET" className="relative w-full sm:w-80">
      <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text-muted)]" />
      <input
        type="text"
        name="q"
        placeholder={placeholder}
        defaultValue={value}
        className="pl-9 w-full h-9 bg-[var(--overlay-dim)] border border-[var(--border-default)] rounded-lg text-sm text-[var(--text-heading)] focus:outline-none focus:border-[var(--accent-blue)]"
      />
      {Object.entries(hiddenParams).map(([key, val]) => (
        <input key={key} type="hidden" name={key} value={val} />
      ))}
    </form>
  );
}
