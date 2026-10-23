import { useId } from 'react';

type ProgressRingProps = {
  value: number;
  size?: number;
  stroke?: number;
  caption?: string;
};

export default function ProgressRing({ value, size = 48, stroke = 4, caption = 'Weekly' }: ProgressRingProps) {
  const rawId = useId();
  const gradientId = `ring-${rawId.replace(/:/g, '')}`;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#c4b5fd" />
            <stop offset="0.5" stopColor="#8b5cf6" />
            <stop offset="1" stopColor="#2dd4bf" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-none">
        <div>
          <p className="font-display font-bold text-white" style={{ fontSize: Math.max(10, Math.round(size * 0.18)) }}>
            {value}%
          </p>
          {caption && (
            <p className="mt-0.5 uppercase tracking-[0.1em] text-white/35" style={{ fontSize: Math.max(5.5, size * 0.095) }}>
              {caption}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
