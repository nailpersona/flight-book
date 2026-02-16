'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IoChevronBack, IoPrintOutline, IoChevronDown, IoCalendarOutline } from 'react-icons/io5';
import { useAuth } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import Modal from '../../../components/Modal';
import CustomCalendar from '../../../components/CustomCalendar';
import s from './summary.module.css';

const PERIODS = [
  { key: 'this_month', label: 'Цей місяць' },
  { key: 'last_month', label: 'Мин. місяць' },
  { key: 'this_year', label: 'Цей рік' },
  { key: 'last_year', label: 'Мин. рік' },
  { key: 'custom', label: 'Період' },
];

function getDateRange(k) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (k) {
    case 'this_month': return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0) };
    case 'last_month': return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0) };
    case 'this_year': return { start: new Date(y, 0, 1), end: new Date(y, 11, 31) };
    case 'last_year': return { start: new Date(y - 1, 0, 1), end: new Date(y - 1, 11, 31) };
    default: return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0) };
  }
}

function toISO(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

function fmtDate(d) {
  if (!d) return '';
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

function parseMin(v) {
  if (!v) return 0;
  const m = String(v).trim().match(/^(\d+):(\d{2})/);
  return m ? (+m[1]) * 60 + (+m[2]) : 0;
}

function fmtMin(t) {
  if (!t) return '—';
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

function fmtNum(n) { return n || '—'; }

export default function SummaryAllPage() {
  const { auth } = useAuth();
  const router = useRouter();
  const [period, setPeriod] = useState('this_month');
  const [menuOpen, setMenuOpen] = useState(false);
  const [customStart, setCustomStart] = useState(null);
  const [customEnd, setCustomEnd] = useState(null);
  const [calTarget, setCalTarget] = useState(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const periodLabel = PERIODS.find(p => p.key === period)?.label || '';

  const load = useCallback(async () => {
    try {
      setLoading(true);

      let range;
      if (period === 'custom') {
        if (!customStart || !customEnd) { setData(null); setLoading(false); return; }
        range = { start: customStart, end: customEnd };
      } else {
        range = getDateRange(period);
      }

      const isFullYear = period === 'this_year' || period === 'last_year';
      const yearStart = new Date(range.start.getFullYear(), 0, 1);
      const fetchStart = isFullYear ? range.start : yearStart;

      const { data: flights, error } = await supabase
        .from('flights')
        .select('date, aircraft_type_id, flight_type, flight_time, flights_count, combat_applications, aircraft_types(name), users(name)')
        .gte('date', toISO(fetchStart))
        .lte('date', toISO(range.end))
        .order('date');

      if (error) throw error;

      const pStart = toISO(range.start);
      const pEnd = toISO(range.end);

      const byAc = {};
      const bucket = () => ({ flights: 0, minutes: 0, combat: 0, test: 0, testMin: 0 });

      (flights || []).forEach(f => {
        const ac = f.aircraft_types?.name || '—';
        if (!byAc[ac]) byAc[ac] = { name: ac, period: bucket(), year: bucket() };
        const cnt = f.flights_count || 1;
        const min = parseMin(f.flight_time);
        const cmb = f.combat_applications || 0;
        const isTest = f.flight_type === 'Випробувальний';
        const inP = f.date >= pStart && f.date <= pEnd;

        byAc[ac].year.flights += cnt;
        byAc[ac].year.minutes += min;
        byAc[ac].year.combat += cmb;
        if (isTest) { byAc[ac].year.test += cnt; byAc[ac].year.testMin += min; }

        if (inP) {
          byAc[ac].period.flights += cnt;
          byAc[ac].period.minutes += min;
          byAc[ac].period.combat += cmb;
          if (isTest) { byAc[ac].period.test += cnt; byAc[ac].period.testMin += min; }
        }
      });

      const rows = Object.values(byAc).sort((a, b) => b.year.flights - a.year.flights);

      const tot = { period: bucket(), year: bucket() };
      rows.forEach(r => {
        for (const k of ['flights', 'minutes', 'combat', 'test', 'testMin']) {
          tot.period[k] += r.period[k];
          tot.year[k] += r.year[k];
        }
      });

      const flightDates = new Set();
      (flights || []).forEach(f => {
        if (f.date >= pStart && f.date <= pEnd) flightDates.add(f.date);
      });

      setData({
        rows, totals: tot,
        showYear: !isFullYear,
        year: range.start.getFullYear(),
        hasCombat: tot.year.combat > 0,
        hasTest: tot.year.test > 0,
        flightDays: flightDates.size,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [period, customStart, customEnd]);

  useEffect(() => { load(); }, [load]);

  const onCalSelect = (date) => {
    if (calTarget === 'start') { setCustomStart(date); if (!customEnd || date > customEnd) setCustomEnd(date); }
    else setCustomEnd(date);
    setCalTarget(null);
  };

  const handlePrint = () => window.print();

  const today = new Date();
  const dateStr = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`;

  const hasData = data && data.rows.length > 0;

  return (
    <div className={s.container}>
      <div className={s.header}>
        <button className={s.backBtn} onClick={() => router.push('/tabs/readiness')}>
          <IoChevronBack size={20} />
        </button>
        <div className={s.titleBlock}>
          <div className={s.title}>Підсумки льотної підготовки</div>
          <div className={s.subtitle}>{dateStr}</div>
        </div>
        <button className={s.printBtn} onClick={handlePrint}>
          <IoPrintOutline size={18} />
          Друк
        </button>
      </div>

      <div className={s.periodRow}>
        <div className={s.periodSelect} onClick={() => setMenuOpen(true)}>
          <span className={s.periodText}>{periodLabel}</span>
          <span className={s.periodArrow}><IoChevronDown size={16} /></span>
        </div>
        <div className={s.periodInfo}>
          {period === 'this_year' || period === 'last_year'
            ? `За ${data?.year || '...'} рік`
            : `${customStart ? fmtDate(customStart) : '...'} — ${customEnd ? fmtDate(customEnd) : '...'}`
          }
        </div>
      </div>

      {period === 'custom' && (
        <div className={s.customDateRow}>
          <div className={s.dateBtn} onClick={() => setCalTarget('start')}>
            <IoCalendarOutline size={14} />
            <span>{customStart ? fmtDate(customStart) : 'Від'}</span>
          </div>
          <span className={s.dateSep}>—</span>
          <div className={s.dateBtn} onClick={() => setCalTarget('end')}>
            <IoCalendarOutline size={14} />
            <span>{customEnd ? fmtDate(customEnd) : 'До'}</span>
          </div>
        </div>
      )}

      {loading && !data && (
        <div className={s.loading}>
          <div className={s.spinner}></div>
        </div>
      )}

      {hasData && (
        <>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                {data.showYear ? (
                  <>
                    <tr>
                      <th rowSpan={2} className={s.thName}>№</th>
                      <th rowSpan={2} className={s.thName}>Тип ПС</th>
                      <th colSpan={data.hasCombat ? 3 : 2} className={s.thGroupP}>В період</th>
                      <th colSpan={data.hasCombat ? 3 : 2} className={s.thGroupY}>З початку {data.year} р.</th>
                      {data.hasTest && <th colSpan={2} className={s.thGroupT}>Випроб.</th>}
                    </tr>
                    <tr>
                      <th className={s.thSubP}>пол.</th>
                      <th className={s.thSubP}>наліт</th>
                      {data.hasCombat && <th className={s.thSubP}>б.з.</th>}
                      <th className={s.thSubY}>пол.</th>
                      <th className={s.thSubY}>наліт</th>
                      {data.hasCombat && <th className={s.thSubY}>б.з.</th>}
                      {data.hasTest && <><th className={s.thSubT}>пол.</th><th className={s.thSubT}>наліт</th></>}
                    </tr>
                  </>
                ) : (
                  <tr>
                    <th className={s.thName}>№</th>
                    <th className={s.thName}>Тип ПС</th>
                    <th className={s.thSubP}>пол.</th>
                    <th className={s.thSubP}>наліт</th>
                    {data.hasCombat && <th className={s.thSubP}>б.з.</th>}
                    {data.hasTest && <><th className={s.thSubT}>випр.</th><th className={s.thSubT}>наліт</th></>}
                  </tr>
                )}
              </thead>
              <tbody>
                {data.rows.map((row, idx) => (
                  <tr key={row.name}>
                    <td className={s.tdNum}>{idx + 1}</td>
                    <td className={s.tdName}>{row.name}</td>
                    <td className={s.tdP}>{fmtNum(row.period.flights)}</td>
                    <td className={s.tdP}>{fmtMin(row.period.minutes)}</td>
                    {data.hasCombat && <td className={s.tdP}>{fmtNum(row.period.combat)}</td>}
                    {data.showYear && (
                      <>
                        <td className={s.tdY}>{fmtNum(row.year.flights)}</td>
                        <td className={s.tdY}>{fmtMin(row.year.minutes)}</td>
                        {data.hasCombat && <td className={s.tdY}>{fmtNum(row.year.combat)}</td>}
                      </>
                    )}
                    {data.hasTest && (
                      <>
                        <td className={s.tdT}>{fmtNum(data.showYear ? row.year.test : row.period.test)}</td>
                        <td className={s.tdT}>{fmtMin(data.showYear ? row.year.testMin : row.period.testMin)}</td>
                      </>
                    )}
                  </tr>
                ))}
                <tr className={s.totalRow}>
                  <td className={s.tdTotalNum}></td>
                  <td className={s.tdTotalName}>Всього</td>
                  <td className={s.tdTotalP}>{data.totals.period.flights}</td>
                  <td className={s.tdTotalP}>{fmtMin(data.totals.period.minutes)}</td>
                  {data.hasCombat && <td className={s.tdTotalP}>{data.totals.period.combat}</td>}
                  {data.showYear && (
                    <>
                      <td className={s.tdTotalY}>{data.totals.year.flights}</td>
                      <td className={s.tdTotalY}>{fmtMin(data.totals.year.minutes)}</td>
                      {data.hasCombat && <td className={s.tdTotalY}>{data.totals.year.combat}</td>}
                    </>
                  )}
                  {data.hasTest && (
                    <>
                      <td className={s.tdTotalT}>{data.showYear ? data.totals.year.test : data.totals.period.test}</td>
                      <td className={s.tdTotalT}>{fmtMin(data.showYear ? data.totals.year.testMin : data.totals.period.testMin)}</td>
                    </>
                  )}
                </tr>
              </tbody>
            </table>
          </div>

          <div className={s.footer}>
            <div className={s.footerItem}>
              <span className={s.footerValue}>{data.flightDays}</span>
              <span className={s.footerLabel}>льотних днів</span>
            </div>
            <div className={s.footerItem}>
              <span className={s.footerValue}>{data.totals.period.flights}</span>
              <span className={s.footerLabel}>польотів</span>
            </div>
            <div className={s.footerItem}>
              <span className={s.footerValue}>{fmtMin(data.totals.period.minutes)}</span>
              <span className={s.footerLabel}>наліт</span>
            </div>
          </div>
        </>
      )}

      {data && !hasData && !loading && (
        <div className={s.empty}>
          <div className={s.emptyIcon}>✈️</div>
          <div className={s.emptyText}>Немає польотів за цей період</div>
        </div>
      )}

      <Modal visible={menuOpen} onClose={() => setMenuOpen(false)} title="Період">
        <div className={s.optionsList}>
          {PERIODS.map(p => (
            <div key={p.key} className={`${s.optionRow} ${period === p.key ? s.optionRowSelected : ''}`}
              onClick={() => { setPeriod(p.key); setMenuOpen(false); }}>
              <span className={s.optionText}>{p.label}</span>
              {period === p.key && <span className={s.selectedMark}>✓</span>}
            </div>
          ))}
        </div>
      </Modal>
      <CustomCalendar visible={calTarget !== null} value={calTarget === 'start' ? customStart : customEnd}
        onSelect={onCalSelect} onClose={() => setCalTarget(null)} />
    </div>
  );
}
