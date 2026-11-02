import React, { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Clean Academic Select component
 */
const Select = forwardRef(function Select(
  {
    label,
    error,
    helperText,
    children,
    className = '',
    required = false,
    id,
    ...props
  },
  ref
) {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1.5 text-left">
      {label && (
        <label
          htmlFor={selectId}
          className="block text-xs font-semibold uppercase tracking-wider text-muted"
        >
          {label} {required && <span className="text-absent">*</span>}
        </label>
      )}

      <div className="relative">
        <select
          id={selectId}
          ref={ref}
          required={required}
          className={`w-full appearance-none bg-surface text-ink border rounded-lg px-3.5 py-2.5 pr-10 text-sm transition-colors duration-150 min-h-[44px] cursor-pointer focus:outline-none ${
            error
              ? 'border-absent focus:border-absent focus:ring-2 focus:ring-absent/20'
              : 'border-line focus:border-brand focus:ring-2 focus:ring-brand/20'
          } ${className}`}
          {...props}
        >
          {children}
        </select>

        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>

      {error ? (
        <p className="text-xs text-absent mt-1 font-medium">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-muted mt-1">{helperText}</p>
      ) : null}
    </div>
  );
});

export default Select;
