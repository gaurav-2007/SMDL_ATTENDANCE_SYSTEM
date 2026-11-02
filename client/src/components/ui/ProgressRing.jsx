import React from 'react';

/**
 * Clean SVG Circular Attendance Progress Gauge
 */
export default function ProgressRing({
  percentage = 0,
  size = 88,
  strokeWidth = 8,
  label = '',
  className = '',
}) {
  const cleanPercent = Math.min(100, Math.max(0, Math.round(percentage)));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (cleanPercent / 100) * circumference;

  // Academic color thresholding
  let strokeColor = 'text-present'; // >= 75%
  if (cleanPercent < 60) {
    strokeColor = 'text-absent';
  } else if (cleanPercent < 75) {
    strokeColor = 'text-grace';
  }

  return (
    <div className={`relative inline-flex flex-col items-center justify-center ${className}`}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
        aria-hidden="true"
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-line/80"
          fill="transparent"
        />
        {/* Fill */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={`${strokeColor} transition-all duration-500 ease-out`}
          fill="transparent"
        />
      </svg>

      {/* Centered Percentage Display */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base sm:text-lg font-bold font-display text-ink tabular-nums tracking-tight">
          {cleanPercent}%
        </span>
        {label && (
          <span className="text-[10px] text-muted uppercase font-semibold">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
