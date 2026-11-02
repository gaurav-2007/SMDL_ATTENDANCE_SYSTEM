import React from 'react';

/**
 * Clean Academic Segmented Tab / Filter Switch
 */
export default function Tabs({
  tabs = [],
  activeTab,
  onChange,
  className = '',
  fullWidth = false,
}) {
  return (
    <div
      className={`inline-flex items-center p-1 bg-bg border border-line rounded-lg text-xs font-medium text-muted select-none ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md transition-all duration-150 cursor-pointer min-h-[36px] ${
              fullWidth ? 'flex-1' : ''
            } ${
              isActive
                ? 'bg-surface text-ink font-semibold shadow-xs border border-line/60'
                : 'hover:text-ink'
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
                  isActive ? 'bg-bg text-muted' : 'bg-surface/50 text-muted'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
