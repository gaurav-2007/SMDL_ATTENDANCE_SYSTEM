import React from 'react';

/**
 * Metric / Stat Card Component
 * Clean layout for dashboard numbers (Students, Teachers, Attendance %)
 */
export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  badge,
  trend,
  className = '',
  onClick,
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-surface border border-line rounded-xl p-4 sm:p-5 shadow-sm text-left flex flex-col justify-between gap-3 ${
        onClick ? 'hover:border-line/80 hover:shadow transition-all cursor-pointer' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">
          {title}
        </span>
        {Icon && (
          <div className="w-8 h-8 rounded-lg bg-bg border border-line flex items-center justify-center text-muted shrink-0">
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl sm:text-3xl font-bold font-display text-ink tabular-nums tracking-tight">
          {value}
        </span>
        {badge}
      </div>

      {(subtitle || trend) && (
        <div className="text-xs text-muted flex items-center gap-1.5 pt-1 border-t border-line/60">
          {trend && (
            <span
              className={`font-semibold ${
                trend > 0 ? 'text-present' : trend < 0 ? 'text-absent' : 'text-muted'
              }`}
            >
              {trend > 0 ? `+${trend}%` : `${trend}%`}
            </span>
          )}
          <span>{subtitle}</span>
        </div>
      )}
    </div>
  );
}
