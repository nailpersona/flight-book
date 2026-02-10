import { FlightHourRow } from '@/lib/types';
import { formatMinutes } from '@/lib/utils';

export default function FlightHoursSummary({ rows }: { rows: FlightHourRow[] }) {
  if (rows.length === 0) return null;

  const totalFlights = rows.reduce((s, r) => s + r.flightsCount, 0);
  const totalMinutes = rows.reduce((s, r) => s + r.totalMinutes, 0);
  const totalCombat = rows.reduce((s, r) => s + r.combatTotal, 0);

  return (
    <div className="bg-bg-primary rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border-light">
        <h2 className="text-base text-text-primary">Наліт</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg-tertiary">
              <th className="text-left px-4 py-2 text-text-secondary">Тип ПС</th>
              <th className="text-right px-4 py-2 text-text-secondary">Польотів</th>
              <th className="text-right px-4 py-2 text-text-secondary">Наліт (год)</th>
              <th className="text-right px-4 py-2 text-text-secondary">Бойових</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.aircraftName} className="border-t border-border-light">
                <td className="px-4 py-2 text-text-primary">{row.aircraftName}</td>
                <td className="px-4 py-2 text-right text-text-primary">{row.flightsCount}</td>
                <td className="px-4 py-2 text-right text-text-primary">{formatMinutes(row.totalMinutes)}</td>
                <td className="px-4 py-2 text-right text-text-primary">{row.combatTotal}</td>
              </tr>
            ))}
            {rows.length > 1 && (
              <tr className="border-t border-border bg-bg-tertiary">
                <td className="px-4 py-2 text-text-primary">Разом</td>
                <td className="px-4 py-2 text-right text-text-primary">{totalFlights}</td>
                <td className="px-4 py-2 text-right text-text-primary">{formatMinutes(totalMinutes)}</td>
                <td className="px-4 py-2 text-right text-text-primary">{totalCombat}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
