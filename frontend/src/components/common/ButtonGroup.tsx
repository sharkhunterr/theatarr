/**
 * Segmented control / pill-style tab component for filters and tabs.
 * Ghostarr style: bg-muted rounded-lg p-1, active has bg-background shadow-sm.
 */

import clsx from 'clsx';

interface ButtonGroupOption<T extends string> {
  key: T;
  label: string;
  count?: number;
}

interface ButtonGroupProps<T extends string> {
  options: ButtonGroupOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
}

export function ButtonGroup<T extends string>({
  options,
  value,
  onChange,
  size = 'sm',
}: ButtonGroupProps<T>) {
  return (
    <div className="inline-flex gap-1 p-1 bg-dark-surface border border-dark-border rounded-lg">
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={clsx(
            'font-medium rounded-md transition-all whitespace-nowrap',
            size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-1.5 text-sm',
            value === opt.key
              ? 'bg-theatarr-500 text-white shadow-sm'
              : 'text-dark-muted hover:text-dark-text'
          )}
        >
          {opt.label}
          {opt.count !== undefined && (
            <span
              className={clsx(
                'ml-1.5 text-[10px]',
                value === opt.key ? 'text-white/70' : 'text-dark-muted/60'
              )}
            >
              {opt.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
