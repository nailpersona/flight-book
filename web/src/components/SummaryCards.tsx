import { PilotSummary } from '@/lib/types';

interface Props {
  pilots: PilotSummary[];
}

export default function SummaryCards({ pilots }: Props) {
  const total = pilots.length;
  const ready = pilots.filter(p => p.overallStatus === 'green').length;
  const attention = pilots.filter(p => p.overallStatus === 'yellow').length;
  const expired = pilots.filter(p => p.overallStatus === 'red').length;

  const cards = [
    { label: 'Пілотів', value: total, bg: 'bg-bg-tertiary', text: 'text-text-primary' },
    { label: 'Готові', value: ready, bg: 'bg-success/10', text: 'text-success' },
    { label: 'Увага', value: attention, bg: 'bg-warning/10', text: 'text-warning' },
    { label: 'Прострочені', value: expired, bg: 'bg-error/10', text: 'text-error' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map(card => (
        <div key={card.label} className={`${card.bg} rounded-xl p-4`}>
          <div className={`text-2xl ${card.text}`}>{card.value}</div>
          <div className="text-sm text-text-secondary mt-1">{card.label}</div>
        </div>
      ))}
    </div>
  );
}
