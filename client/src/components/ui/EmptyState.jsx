import React from 'react';
import { Inbox } from 'lucide-react';

/**
 * Clean Academic Empty State Component
 */
export default function EmptyState({
  icon: Icon = Inbox,
  title = 'No records found',
  description = 'There are no items to display right now.',
  action,
  className = '',
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-xl border border-dashed border-line bg-surface/50 ${className}`}
    >
      <div className="w-12 h-12 rounded-xl bg-bg border border-line flex items-center justify-center text-muted mb-3.5">
        <Icon className="w-6 h-6 stroke-[1.5]" />
      </div>
      <h4 className="text-sm font-semibold font-display text-ink mb-1">
        {title}
      </h4>
      <p className="text-xs text-muted max-w-sm mb-4">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
