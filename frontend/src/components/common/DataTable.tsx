/**
 * Responsive data table with loading skeleton and empty state.
 * Ghostarr style: rounded-lg border shadow-sm, h-12 headers, p-4 cells.
 */

import { ReactNode } from 'react';
import clsx from 'clsx';
import { type LucideIcon } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyIcon?: LucideIcon;
  emptyMessage?: string;
  isLoading?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyIcon: EmptyIcon,
  emptyMessage = 'Aucun element',
  isLoading,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-dark-border bg-dark-surface shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dark-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={clsx(
                    'h-12 px-4 text-left align-middle font-medium text-dark-muted text-xs',
                    col.headerClassName,
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-dark-border last:border-0">
                {columns.map((col) => (
                  <td key={col.key} className={clsx('p-4', col.className)}>
                    <div className="h-4 bg-dark-border/50 rounded animate-pulse" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-dark-border bg-dark-surface shadow-sm p-6 text-center">
        {EmptyIcon && <EmptyIcon size={32} className="mx-auto text-dark-muted mb-2" />}
        <p className="text-sm text-dark-muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dark-border bg-dark-surface shadow-sm overflow-hidden">
      <div className="w-full overflow-x-auto">
        <table className="w-full text-sm caption-bottom">
          <thead>
            <tr className="border-b border-dark-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={clsx(
                    'h-12 px-4 text-left align-middle font-medium text-dark-muted text-xs',
                    col.headerClassName,
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr
                key={keyExtractor(item)}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
                className={clsx(
                  'border-b border-dark-border last:border-0 transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-dark-border/30'
                )}
              >
                {columns.map((col) => (
                  <td key={col.key} className={clsx('p-4 align-middle', col.className)}>
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
