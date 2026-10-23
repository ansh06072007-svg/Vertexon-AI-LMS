type AvatarProps = {
  name: string;
  size?: number;
  ring?: boolean;
  className?: string;
  online?: boolean;
};

const gradients = [
  ['#f0abfc', '#8b5cf6', '#312e81'],
  ['#5eead4', '#0ea5e9', '#172554'],
  ['#fda4af', '#f43f5e', '#4c0519'],
  ['#fde68a', '#f59e0b', '#451a03'],
  ['#a7f3d0', '#10b981', '#022c22'],
];

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export default function Avatar({ name, size = 34, ring = false, className = '', online = false }: AvatarProps) {
  const index = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % gradients.length;
  const [a, b, c] = gradients[index];

  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center overflow-visible rounded-full ${ring ? 'ring-1 ring-white/15' : ''} ${className}`}
      style={{ width: size, height: size }}
      title={name}
      aria-label={name}
    >
      <span
        className="grid h-full w-full place-items-center overflow-hidden rounded-full font-display font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
        style={{
          fontSize: Math.max(8, size * 0.3),
          backgroundImage: `radial-gradient(circle at 30% 20%, ${a} 0%, ${b} 48%, ${c} 100%)`,
        }}
      >
        {initials(name)}
      </span>
      <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/20" />
      {online && (
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#08070d] bg-emerald-400" />
      )}
    </span>
  );
}
