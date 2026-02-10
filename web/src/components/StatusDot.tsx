import { StatusColor } from '@/lib/types';

const colorMap: Record<StatusColor, string> = {
  green: 'bg-success',
  yellow: 'bg-warning',
  red: 'bg-error',
  gray: 'bg-text-tertiary',
};

export default function StatusDot({ color, size = 'md' }: { color: StatusColor; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3';
  return (
    <span
      className={`inline-block rounded-full ${sizeClass} ${colorMap[color]}`}
      title={color}
    />
  );
}
