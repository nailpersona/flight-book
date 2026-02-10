import Link from 'next/link';
import { PilotSummary, StatusColor } from '@/lib/types';
import StatusDot from './StatusDot';

const borderColorMap: Record<StatusColor, string> = {
  green: 'border-l-success',
  yellow: 'border-l-warning',
  red: 'border-l-error',
  gray: 'border-l-text-tertiary',
};

interface Props {
  pilot: PilotSummary;
}

export default function PilotCard({ pilot }: Props) {
  const { user, aircraftNames, muStatuses, lpStatuses, commissionStatuses, annualStatuses, overallStatus } = pilot;

  return (
    <Link href={`/dashboard/${user.id}`} className="block no-underline">
      <div className={`bg-bg-primary rounded-xl p-4 border border-border border-l-4 ${borderColorMap[overallStatus]} hover:shadow-md transition-shadow`}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-text-primary text-base">{user.name}</div>
            <div className="text-text-secondary text-sm">
              {user.rank && `${user.rank} · `}
              Класність: {user.military_class || '—'}
            </div>
          </div>
          <StatusDot color={overallStatus} />
        </div>

        {aircraftNames.length > 0 && (
          <div className="text-text-tertiary text-xs mb-3">
            ТПС: {aircraftNames.join(', ')}
          </div>
        )}

        <div className="flex flex-col gap-1.5 text-xs">
          <StatusRow label="МУ" statuses={muStatuses} />
          <StatusRow label="ЛП" statuses={lpStatuses} />
          <StatusRow label="Ком" statuses={commissionStatuses} />
          <StatusRow label="Перев" statuses={annualStatuses} />
        </div>

        <div className="mt-3 text-right">
          <span className="text-accent text-sm">Детальніше →</span>
        </div>
      </div>
    </Link>
  );
}

function StatusRow({ label, statuses }: { label: string; statuses: StatusColor[] }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-text-secondary w-10">{label}:</span>
      <div className="flex gap-1">
        {statuses.map((color, i) => (
          <StatusDot key={i} color={color} size="sm" />
        ))}
      </div>
    </div>
  );
}
