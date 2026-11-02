import React from 'react';

/**
 * Clean Academic Badge
 * Soft pastel backgrounds with deep readable text (not solid harsh fills)
 */
export default function Badge({
  children,
  variant = 'neutral',
  size = 'sm',
  dot = false,
  pulseDot = false,
  className = '',
  ...props
}) {
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
  };

  const variantStyles = {
    present:
      'bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800/60',
    grace:
      'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
    absent:
      'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/60',
    brand:
      'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60',
    neutral:
      'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    live:
      'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60 font-semibold',
  };

  const dotColors = {
    present: 'bg-green-500',
    grace: 'bg-amber-500',
    absent: 'bg-red-500',
    brand: 'bg-indigo-500',
    neutral: 'bg-slate-400',
    live: 'bg-emerald-500',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full ${sizeStyles[size] || sizeStyles.sm} ${
        variantStyles[variant] || variantStyles.neutral
      } ${className}`}
      {...props}
    >
      {(dot || pulseDot) && (
        <span className="relative flex h-2 w-2">
          {pulseDot && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                dotColors[variant] || dotColors.neutral
              }`}
            />
          )}
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              dotColors[variant] || dotColors.neutral
            }`}
          />
        </span>
      )}
      {children}
    </span>
  );
}
