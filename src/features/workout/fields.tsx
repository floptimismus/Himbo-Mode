import { useEffect, useState } from 'react';
import { fmtClock, parseDuration, parseNumber } from '@/lib/format.ts';

interface NumProps {
  value: number | null;
  onChange: (v: number | null) => void;
  label: string;
  placeholder?: string;
  integer?: boolean;
  max?: number;
}

/** Numeric text input that tolerates partial typing ("62.", "7,5") and commits parsed values. */
export function NumField({ value, onChange, label, placeholder, integer, max }: NumProps) {
  const [text, setText] = useState(value == null ? '' : String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(value == null ? '' : String(value));
  }, [value, focused]);
  return (
    <input
      className="px-input num"
      inputMode={integer ? 'numeric' : 'decimal'}
      aria-label={label}
      placeholder={placeholder ?? '–'}
      value={text}
      onFocus={(e) => {
        setFocused(true);
        e.target.select();
      }}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const raw = e.target.value.replace(integer ? /[^0-9]/g : /[^0-9.,]/g, '');
        setText(raw);
        let n = parseNumber(raw);
        if (n != null && integer) n = Math.round(n);
        if (n != null && max != null) n = Math.min(n, max);
        onChange(n);
      }}
    />
  );
}

/** Duration input: plain numbers are minutes (cardio) or seconds (holds); "m:ss" always works. */
export function DurationField({ value, onChange, label, plainUnit, placeholder }: { value: number | null; onChange: (v: number | null) => void; label: string; plainUnit: 'min' | 'sec'; placeholder: string }) {
  const [text, setText] = useState(value == null ? '' : fmtClock(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(value == null ? '' : fmtClock(value));
  }, [value, focused]);
  return (
    <input
      className="px-input num"
      inputMode="text"
      aria-label={label}
      placeholder={placeholder}
      value={text}
      onFocus={(e) => {
        setFocused(true);
        e.target.select();
      }}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9:.,]/g, '');
        setText(raw);
        onChange(parseDuration(raw, plainUnit));
      }}
    />
  );
}
