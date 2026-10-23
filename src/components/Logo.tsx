import { useId } from 'react';

type LogoProps = {
  markOnly?: boolean;
  size?: number;
  subtitle?: string;
};

export default function Logo({ markOnly = false, size = 26, subtitle }: LogoProps) {
  const rawId = useId();
  const gradientId = `logo-${rawId.replace(/:/g, '')}`;

  return (
    <div className="flex items-center gap-2">
      <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
        <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#c4b5fd" />
              <stop offset="0.55" stopColor="#8b5cf6" />
              <stop offset="1" stopColor="#2dd4bf" />
            </linearGradient>
          </defs>
          <path
            d="M16 2.8 27.5 9.4v13.2L16 29.2 4.5 22.6V9.4L16 2.8Z"
            fill={`url(#${gradientId})`}
            opacity="0.13"
          />
          <path
            d="M16 2.8 27.5 9.4v13.2L16 29.2 4.5 22.6V9.4L16 2.8Z"
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="1.15"
            opacity="0.65"
          />
          <path
            d="m16 7.6 2.45 5.95L24.4 16l-5.95 2.45L16 24.4l-2.45-5.95L7.6 16l5.95-2.45L16 7.6Z"
            fill={`url(#${gradientId})`}
          />
        </svg>
        <span className="absolute inset-[25%] rounded-full bg-primary-400/30 blur-md" aria-hidden="true" />
      </span>
      {!markOnly && (
        <span className="flex flex-col justify-center leading-none">
          <span className="font-display text-[14.5px] font-semibold tracking-[-0.02em] text-white">
            Vertexon<span className="text-primary-300">.AI</span>
          </span>
          {subtitle && (
            <span className="mt-1 text-[6.5px] font-semibold uppercase tracking-[0.22em] text-white/30">
              {subtitle}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
