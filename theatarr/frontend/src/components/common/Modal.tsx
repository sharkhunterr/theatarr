import { Fragment, ReactNode } from 'react';
import { clsx } from 'clsx';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  showHeader?: boolean;
}

export function Modal({ isOpen, onClose, title, children, size = 'md', showHeader = true }: ModalProps) {
  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-5xl',
    '2xl': 'max-w-6xl',
    full: 'max-w-[95vw]',
  };

  return (
    <Fragment>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
        <div
          className={clsx(
            'bg-dark-surface border border-dark-border rounded-xl w-full shadow-xl animate-slide-up flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)]',
            sizes[size]
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header - Fixed */}
          {showHeader && title && (
            <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border flex-shrink-0">
              <h2 className="text-lg font-semibold text-dark-text truncate pr-2">{title}</h2>
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-dark-muted hover:text-dark-text hover:bg-dark-border transition-colors flex-shrink-0"
              >
                <X size={20} />
              </button>
            </div>
          )}

          {/* Content - Scrollable */}
          <div className={clsx(
            'overflow-y-auto flex-1 min-h-0',
            showHeader ? 'p-4' : 'p-0'
          )}>{children}</div>
        </div>
      </div>
    </Fragment>
  );
}

export interface ModalFooterProps {
  children: ReactNode;
  className?: string;
}

export function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div
      className={clsx(
        'flex items-center justify-end gap-2 mt-4 pt-4 border-t border-dark-border',
        className
      )}
    >
      {children}
    </div>
  );
}
