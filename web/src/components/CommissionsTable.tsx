import { CommissionLlkUmo, StatusItem } from '@/lib/types';
import StatusDot from './StatusDot';

interface Props {
  commission: Record<string, CommissionLlkUmo | StatusItem[]>;
}

function isLlkUmo(val: CommissionLlkUmo | StatusItem[]): val is CommissionLlkUmo {
  return !Array.isArray(val) && 'nextType' in val;
}

export default function CommissionsTable({ commission }: Props) {
  const llkUmo = commission['ЛЛК/УМО'];

  return (
    <div className="bg-bg-primary rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border-light">
        <h2 className="text-base text-text-primary">Комісування</h2>
      </div>

      <div className="divide-y divide-border-light text-sm">
        {/* ЛЛК/УМО */}
        {llkUmo && isLlkUmo(llkUmo) && (
          <div className="px-4 py-3">
            <div className="text-text-primary mb-2">ЛЛК/УМО</div>
            <div className="flex flex-col gap-1 ml-4">
              {llkUmo.llk && (
                <div className="flex items-center gap-2">
                  <StatusDot color={llkUmo.llk.color} />
                  <span className="text-text-secondary">ЛЛК:</span>
                  <span className="text-text-primary">{llkUmo.llk.date}</span>
                </div>
              )}
              {llkUmo.umo && (
                <div className="flex items-center gap-2">
                  <StatusDot color={llkUmo.umo.color} />
                  <span className="text-text-secondary">УМО:</span>
                  <span className="text-text-primary">{llkUmo.umo.date}</span>
                </div>
              )}
              {llkUmo.nextType && (
                <div className="flex items-center gap-2 mt-1">
                  <StatusDot color={llkUmo.nextColor} />
                  <span className="text-text-tertiary">
                    Наступна: {llkUmo.nextType} до {llkUmo.nextDate}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Other commission types */}
        {Object.entries(commission).filter(([key]) => key !== 'ЛЛК/УМО').map(([typeName, value]) => {
          const items = value as StatusItem[];
          if (items.length === 0) return null;
          return (
            <div key={typeName} className="px-4 py-3">
              <div className="text-text-primary mb-1">{typeName}</div>
              <div className="flex flex-col gap-1 ml-4">
                {items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <StatusDot color={item.color} />
                    {item.aircraft && <span className="text-text-secondary">{item.aircraft}:</span>}
                    <span className="text-text-primary">{item.date || '—'}</span>
                    {item.expiryDate && (
                      <span className="text-text-tertiary text-xs">до {item.expiryDate}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
