import React from 'react';

/**
 * Clean Academic Card Component
 * Flat surface with subtle border and small shadow
 */
export default function Card({
  children,
  className = '',
  onClick,
  hoverable = false,
  ...props
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-surface border border-line rounded-xl shadow-sm overflow-hidden text-ink ${
        hoverable ? 'hover:border-line/80 hover:shadow transition-all duration-150 cursor-pointer' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '', ...props }) {
  return (
    <div className={`p-4 sm:p-5 border-b border-line flex flex-col gap-1 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '', ...props }) {
  return (
    <h3 className={`text-base font-semibold font-display text-ink tracking-tight ${className}`} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className = '', ...props }) {
  return (
    <p className={`text-xs text-muted ${className}`} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ children, className = '', ...props }) {
  return (
    <div className={`p-4 sm:p-5 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '', ...props }) {
  return (
    <div className={`p-4 sm:p-5 bg-bg/50 border-t border-line flex items-center justify-between gap-3 ${className}`} {...props}>
      {children}
    </div>
  );
}
