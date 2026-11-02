import React from 'react';

/**
 * Clean Academic Button component
 * Touch-friendly (>=44px), subtle transitions, accessible focus ring.
 */
export default function Button({
  children,
  type = 'button',
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  className = '',
  ...props
}) {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-all duration-150 cursor-pointer select-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]';

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs rounded-md gap-1.5 min-h-[36px]',
    md: 'px-4 py-2 text-sm rounded-lg gap-2 min-h-[44px]',
    lg: 'px-5 py-2.5 text-base rounded-lg gap-2.5 min-h-[48px]',
  };

  const variantStyles = {
    primary:
      'bg-brand text-white hover:opacity-95 focus:ring-2 focus:ring-brand/30 shadow-sm border border-brand/10',
    secondary:
      'bg-surface text-ink border border-line hover:bg-bg focus:ring-2 focus:ring-brand/20 shadow-sm',
    outline:
      'bg-transparent text-brand border border-brand/40 hover:bg-brand/5 focus:ring-2 focus:ring-brand/20',
    ghost:
      'bg-transparent text-muted hover:text-ink hover:bg-line/40 focus:ring-2 focus:ring-line',
    danger:
      'bg-red-50 text-absent border border-red-200 hover:bg-red-100 focus:ring-2 focus:ring-absent/20 dark:bg-red-950/40 dark:border-red-900/60 dark:text-red-400',
    success:
      'bg-green-50 text-present border border-green-200 hover:bg-green-100 focus:ring-2 focus:ring-present/20 dark:bg-green-950/40 dark:border-green-900/60 dark:text-green-400',
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${baseStyles} ${sizeStyles[size] || sizeStyles.md} ${variantStyles[variant] || variantStyles.primary} ${className}`}
      {...props}
    >
      {loading ? (
        <>
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Loading...</span>
        </>
      ) : (
        <>
          {Icon && <Icon className="w-4 h-4 shrink-0" />}
          {children}
        </>
      )}
    </button>
  );
}
