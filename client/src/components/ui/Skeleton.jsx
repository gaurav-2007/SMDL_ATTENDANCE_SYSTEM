import React from 'react';

/**
 * Clean Academic Skeleton Loader
 * Subtle pulsing placeholder to replace spinners
 */
export default function Skeleton({
  variant = 'text',
  className = '',
  count = 1,
}) {
  const variantStyles = {
    text: 'h-4 w-full rounded',
    title: 'h-6 w-3/4 rounded',
    avatar: 'w-10 h-10 rounded-full shrink-0',
    card: 'h-28 w-full rounded-xl',
    button: 'h-10 w-28 rounded-lg',
  };

  const items = Array.from({ length: count });

  return (
    <>
      {items.map((_, i) => (
        <div
          key={i}
          className={`bg-line/70 animate-pulse ${variantStyles[variant] || variantStyles.text} ${className}`}
        />
      ))}
    </>
  );
}

export function TableRowSkeleton({ columns = 5 }) {
  return (
    <tr className="border-b border-line animate-pulse">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="py-3.5 px-4">
          <div className="h-4 bg-line/70 rounded w-full max-w-[120px]" />
        </td>
      ))}
    </tr>
  );
}
