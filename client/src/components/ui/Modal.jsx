import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const SIZE_MAP = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  '2xl': 'max-w-4xl',
  full: 'max-w-5xl',
};

/**
 * Adaptive Modal / Bottom-Sheet Component
 * On desktop (>=768px): Centered modal dialog
 * On mobile (<768px): Native bottom sheet
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'max-w-lg',
  size,
  showClose = true,
}) {
  const effectiveMaxWidth = size ? (SIZE_MAP[size] || size) : maxWidth;

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 overflow-x-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet / Dialog Container */}
      <div
        className={`relative z-10 w-full ${effectiveMaxWidth} max-w-full sm:mx-auto bg-surface border border-line rounded-t-2xl md:rounded-xl shadow-xl max-h-[90vh] md:max-h-[85vh] flex flex-col overflow-hidden animate-slide-up md:animate-fade-in pb-[env(safe-area-inset-bottom)]`}
        role="dialog"
        aria-modal="true"
      >
        {/* Mobile Pull Handle Indicator */}
        <div className="md:hidden flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 bg-muted/30 rounded-full" />
        </div>

        {/* Header */}
        {(title || showClose) && (
          <div className="flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-line shrink-0 min-w-0">
            <div className="min-w-0 flex-1">
              {title && (
                <h2 className="text-base font-semibold font-display text-ink tracking-tight break-words">
                  {title}
                </h2>
              )}
              {description && (
                <p className="text-xs text-muted mt-0.5 break-words">{description}</p>
              )}
            </div>

            {showClose && (
              <button
                type="button"
                onClick={onClose}
                className="text-muted hover:text-ink p-1.5 rounded-md hover:bg-line/40 transition-colors cursor-pointer shrink-0"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto overflow-x-hidden min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
