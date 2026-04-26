import React, { useMemo } from 'react';
import { TextField } from './TextField';

interface Props {
  label?: string;
  /** Integer in the smallest currency unit (đồng for VND). */
  value: number;
  onChange: (next: number) => void;
  currency?: 'VND' | 'USD';
  error?: string | null;
  placeholder?: string;
}

function formatGrouped(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '';
  return value.toLocaleString('vi-VN');
}

export function MoneyInput({
  label,
  value,
  onChange,
  currency = 'VND',
  error,
  placeholder,
}: Props) {
  const display = useMemo(() => formatGrouped(value), [value]);

  return (
    <TextField
      label={label ?? currency}
      value={display}
      onChangeText={(raw) => {
        const digits = raw.replace(/\D/g, '');
        onChange(digits ? parseInt(digits, 10) : 0);
      }}
      keyboardType="numeric"
      placeholder={placeholder ?? '0'}
      error={error}
      autoCorrect={false}
    />
  );
}
