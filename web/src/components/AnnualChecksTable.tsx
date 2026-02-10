import { StatusColor } from '@/lib/types';
import StatusDot from './StatusDot';

interface CheckItem {
  check_type: string;
  date: string;
  color: StatusColor;
}

export default function AnnualChecksTable({ checks }: { checks: CheckItem[] }) {
  if (checks.length === 0) return null;

  return (
    <div className="bg-bg-primary rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border-light">
        <h2 className="text-base text-text-primary">Річні перевірки</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg-tertiary">
              <th className="text-left px-4 py-2 text-text-secondary">Перевірка</th>
              <th className="text-left px-4 py-2 text-text-secondary">Дата</th>
              <th className="text-left px-4 py-2 text-text-secondary">Стан</th>
            </tr>
          </thead>
          <tbody>
            {checks.map(check => (
              <tr key={check.check_type} className="border-t border-border-light">
                <td className="px-4 py-2 text-text-primary">{check.check_type}</td>
                <td className="px-4 py-2 text-text-primary">{check.date}</td>
                <td className="px-4 py-2">
                  <StatusDot color={check.color} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
