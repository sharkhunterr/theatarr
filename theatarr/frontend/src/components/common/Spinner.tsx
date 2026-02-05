import { type HTMLAttributes } from 'react';

export interface SpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
};

export const Spinner = ({ size = 'md', className = '', ...props }: SpinnerProps) => {
  return (
    <div
      className={`
        ${sizeClasses[size]}
        border-2 border-gray-600 border-t-primary-500
        rounded-full animate-spin
        ${className}
      `}
      role="status"
      aria-label="Loading"
      {...props}
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};
