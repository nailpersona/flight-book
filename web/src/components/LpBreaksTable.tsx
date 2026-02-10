import { StatusItem } from '@/lib/types';
import StatusDot from './StatusDot';

interface Props {
  lp: Record<string, StatusItem[]>;
  lpTypes: string[];
}

export default function LpBreaksTable({ lp, lpTypes }: Props) {
  return (
    <div className="bg-bg-primary rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border-light">
        <h2 className="text-base text-text-primary">Перерви за видами ЛП</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg-tertiary">
              <th className="text-left px-4 py-2 text-text-secondary">Вид ЛП</th>
              <th className="text-left px-4 py-2 text-text-secondary">Остання дата</th>
              <th className="text-left px-4 py-2 text-text-secondary">Діє до</th>
            </tr>
          </thead>
          <tbody>
            {lpTypes.map(lpType => {
              const items = lp[lpType] || [];
              const item = items[0];
              return (
                <tr key={lpType} className="border-t border-border-light">
                  <td className="px-4 py-2 text-text-primary">{lpType}</td>
                  <td className="px-4 py-2">
                    {item ? (
                      <div className="flex items-center gap-2">
                        <StatusDot color={item.color} />
                        <span className="text-text-primary">{item.date || '—'}</span>
                      </div>
                    ) : (
                      <span className="text-text-tertiary">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-text-secondary">
                    {item?.expiryDate || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
