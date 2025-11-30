'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type SelectOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

interface SelectProps<T extends string> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  triggerClassName?: string;
  listClassName?: string;
  optionClassName?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  placeholder,
  triggerClassName,
  listClassName,
  optionClassName,
  ariaLabel,
  disabled = false,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(() => options.find((option) => option.value === value), [options, value]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current) {
        return;
      }
      if (!containerRef.current.contains(event.target as Node)) {
        close();
      }
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, close]);

  const previousValueRef = useRef(value);
  useEffect(() => {
    if (previousValueRef.current !== value) {
      previousValueRef.current = value;
      setOpen(false);
    }
  }, [value]);

  useEffect(() => {
    if (disabled) {
      setOpen(false);
    }
  }, [disabled]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-disabled={disabled}
        disabled={disabled}
        className={`flex w-full items-center justify-between rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm font-medium text-white shadow-inner shadow-violet-500/20 transition focus:outline-none focus-visible:border-violet-300/70 focus-visible:shadow-violet-500/40 disabled:cursor-not-allowed disabled:opacity-60 ${
          triggerClassName ?? ''
        }`}
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
        }}
      >
        <span className="truncate whitespace-nowrap text-left text-white/90">
          {selected?.label ?? placeholder ?? ''}
        </span>
        <span className="text-xs text-white/60">▾</span>
      </button>
      {open && (
        <ul
          role="listbox"
          className={`absolute z-40 mt-2 min-w-full rounded-2xl border border-white/10 bg-slate-950/95 p-1 shadow-xl shadow-slate-900/60 backdrop-blur ${
            listClassName ?? ''
          }`}
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    close();
                    onChange(option.value);
                  }}
                  className={`flex w-full flex-col items-start gap-1 rounded-xl px-4 py-2 text-left text-sm transition ${
                    active
                      ? 'bg-violet-500/20 text-white shadow-inner shadow-violet-500/30'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  } ${optionClassName ?? ''}`}
                >
                  <span>{option.label}</span>
                  {option.description && (
                    <span className="text-xs text-white/60">{option.description}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
