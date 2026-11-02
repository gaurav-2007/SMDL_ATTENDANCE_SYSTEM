import React, { forwardRef } from 'react';

/**
 * Clean Academic Input component with Label, Error, and Icon support
 */
const Input = forwardRef(function Input(
  {
    label,
    error,
    helperText,
    icon: Icon,
    rightElement,
    type = 'text',
    className = '',
    required = false,
    id,
    ...props
  },
  ref
) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1.5 text-left">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold uppercase tracking-wider text-muted"
        >
          {label} {required && <span className="text-absent">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        {Icon && (
          <div className="absolute left-3.5 pointer-events-none text-muted">
            <Icon className="w-4 h-4" />
          </div>
        )}

        <input
          id={inputId}
          ref={ref}
          type={type}
          required={required}
          className={`w-full bg-surface text-ink placeholder:text-muted/60 border rounded-lg px-3.5 py-2.5 text-sm transition-colors duration-150 min-h-[44px] focus:outline-none ${
            error
              ? 'border-absent focus:border-absent focus:ring-2 focus:ring-absent/20'
              : 'border-line focus:border-brand focus:ring-2 focus:ring-brand/20'
          } ${Icon ? 'pl-10' : ''} ${rightElement ? 'pr-11' : ''} ${className}`}
          {...props}
        />

        {rightElement && (
          <div className="absolute right-3 flex items-center">
            {rightElement}
          </div>
        )}
      </div>

      {error ? (
        <p className="text-xs text-absent mt-1 font-medium">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-muted mt-1">{helperText}</p>
      ) : null}
    </div>
  );
});

export default Input;
