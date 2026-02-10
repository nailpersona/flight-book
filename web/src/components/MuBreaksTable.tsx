import { StatusItem } from '@/lib/types';
import StatusDot from './StatusDot';

interface Props {
  mu: Record<string, StatusItem[]>;
  aircraftNames: string[];
}

const MU_ORDER = ['ДПМУ', 'ДСМУ', 'ДВМП', 'НПМУ', 'НСМУ', 'НВМП'];

export default function MuBreaksTable({ mu, aircraftNames }: Props) {
  if (aircraftNames.length === 0) return null;

  return (
    <div className="bg-bg-primary rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border-light">
        <h2 className="text-base text-text-primary">Перерви за МУ</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg-tertiary">
              <th className="text-left px-4 py-2 text-text-secondary">МУ</th>
              {aircraftNames.map(ac => (
                <th key={ac} className="text-left px-4 py-2 text-text-secondary">{ac}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MU_ORDER.map(muType => {
              const items = mu[muType] || [];
              return (
                <tr key={muType} className="border-t border-border-light">
                  <td className="px-4 py-2 text-text-primary">{muType}</td>
                  {aircraftNames.map(ac => {
                    const item = items.find(i => i.aircraft === ac);
                    return (
                      <td key={ac} className="px-4 py-2">
                        {item ? (
                          <div className="flex items-center gap-2">
                            <StatusDot color={item.color} />
                            <div>
                              <div className="text-text-primary">{item.date || '—'}</div>
                              {item.expiryDate && (
                                <div className="text-text-tertiary text-xs">до {item.expiryDate}</div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-text-tertiary">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
