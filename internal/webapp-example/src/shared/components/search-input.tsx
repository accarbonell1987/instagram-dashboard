'use client';

import { Input } from '@core/ui';
import { SearchIcon } from 'lucide-react';
import type { ChangeEvent } from 'react';

export interface SearchInputProps {
  /** Current search value */
  value: string;
  /** Callback when search value changes */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Additional class name */
  className?: string;
  /** Accessible label for the input */
  label?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
  label = 'Search',
}: SearchInputProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <div className={`relative max-w-sm flex-1 ${className}`}>
      <SearchIcon
        className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
        aria-hidden="true"
      />
      <Input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        className="pl-9"
        aria-label={label}
      />
    </div>
  );
}
