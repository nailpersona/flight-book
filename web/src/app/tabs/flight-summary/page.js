'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IoChevronBack, IoChevronDown, IoCalendarOutline, IoAirplaneOutline } from 'react-icons/io5';
import { useAuth } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import Modal from '../../../components/Modal';
import CustomCalendar from '../../../components/CustomCalendar';
import s from '../../../components/shared.module.css';

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

function toISO(d) { return d.toISOString().split('T')[0]; }

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

export default function FlightSummaryPage() {
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
      if (!auth?.pib) return;
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
        .select('date, aircraft_type_id, flight_type, flight_time, flights_count, combat_applications, aircraft_types(name)')
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

      // Count distinct flight dates in period (~ flight days/shifts)
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
  }, [auth?.pib, period, customStart, customEnd]);

  useEffect(() => { load(); }, [load]);

  const onCalSelect = (date) => {
    if (calTarget === 'start') { setCustomStart(date); if (!customEnd || date > customEnd) setCustomEnd(date); }
    else setCustomEnd(date);
    setCalTarget(null);
  };

  const hasData = data && data.rows.length > 0;

  return (
    <div className={s.page}>
      <div className={s.topBar}>
        <button className={s.topBarBack} onClick={() => router.push('/tabs/profile')}>
          <IoChevronBack size={20} />
        </button>
        <span className={s.topBarTitle}>Підсумки</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <div className={s.select} onClick={() => setMenuOpen(true)} style={{ background: '#fff' }}>
          <span className={s.selectText}>{periodLabel}</span>
          <span className={s.selectArrow}><IoChevronDown size={16} /></span>
        </div>
      </div>

      {period === 'custom' && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
          <div className={s.dateBtn} onClick={() => setCalTarget('start')} style={{ flex: 1 }}>
            <IoCalendarOutline size={14} color="#6B7280" />
            <span style={{ fontSize: 14 }}>{customStart ? fmtDate(customStart) : 'Від'}</span>
          </div>
          <span style={{ color: '#9CA3AF' }}>—</span>
          <div className={s.dateBtn} onClick={() => setCalTarget('end')} style={{ flex: 1 }}>
            <IoCalendarOutline size={14} color="#6B7280" />
            <span style={{ fontSize: 14 }}>{customEnd ? fmtDate(customEnd) : 'До'}</span>
          </div>
        </div>
      )}

      {loading && !data && (
        <div className={s.loadingWrap}>
          <div className={s.spinner} style={{ borderTopColor: '#111827', width: 24, height: 24 }} />
        </div>
      )}

      {hasData && (
        <>
          {/* Hero totals */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <HeroCard value={data.totals.period.flights} label="польотів" />
            <HeroCard value={fmtMin(data.totals.period.minutes)} label="наліт" />
            {data.hasCombat && <HeroCard value={data.totals.period.combat} label="бой.заст" />}
          </div>

          {data.showYear && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              <div className={s.statCard} style={{ flex: 1 }}>
                <div className={s.statValue}>{data.totals.year.flights}</div>
                <div className={s.statLabel}>пол. з поч. року</div>
              </div>
              <div className={s.statCard} style={{ flex: 1 }}>
                <div className={s.statValue}>{fmtMin(data.totals.year.minutes)}</div>
                <div className={s.statLabel}>наліт з поч. року</div>
              </div>
            </div>
          )}

          {/* Main table */}
          <div className={s.card} style={{ padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: data.showYear ? 380 : 240 }}>
                <thead>
                  {data.showYear ? (
                    <>
                      <tr>
                        <th rowSpan={2} style={thName}>Тип ПС</th>
                        <th colSpan={data.hasCombat ? 3 : 2} style={thGroupP}>В період</th>
                        <th colSpan={data.hasCombat ? 3 : 2} style={thGroupY}>З поч. {data.year} р.</th>
                        {data.hasTest && <th colSpan={2} style={thGroupT}>Випроб.</th>}
                      </tr>
                      <tr>
                        <th style={thSubP}>пол.</th>
                        <th style={thSubP}>наліт</th>
                        {data.hasCombat && <th style={thSubP}>б.з.</th>}
                        <th style={thSubY}>пол.</th>
                        <th style={thSubY}>наліт</th>
                        {data.hasCombat && <th style={thSubY}>б.з.</th>}
                        {data.hasTest && <><th style={thSubT}>пол.</th><th style={thSubT}>наліт</th></>}
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <th style={thName}>Тип ПС</th>
                      <th style={thSubP}>пол.</th>
                      <th style={thSubP}>наліт</th>
                      {data.hasCombat && <th style={thSubP}>б.з.</th>}
                      {data.hasTest && <><th style={thSubT}>випр.</th><th style={thSubT}>наліт</th></>}
                    </tr>
                  )}
                </thead>
                <tbody>
                  {data.rows.map(row => (
                    <tr key={row.name}>
                      <td style={tdName}>{row.name}</td>
                      <td style={tdP}>{fmtNum(row.period.flights)}</td>
                      <td style={tdP}>{fmtMin(row.period.minutes)}</td>
                      {data.hasCombat && <td style={tdP}>{fmtNum(row.period.combat)}</td>}
                      {data.showYear && (
                        <>
                          <td style={tdY}>{fmtNum(row.year.flights)}</td>
                          <td style={tdY}>{fmtMin(row.year.minutes)}</td>
                          {data.hasCombat && <td style={tdY}>{fmtNum(row.year.combat)}</td>}
                        </>
                      )}
                      {data.hasTest && (
                        <>
                          <td style={tdT}>{fmtNum(data.showYear ? row.year.test : row.period.test)}</td>
                          <td style={tdT}>{fmtMin(data.showYear ? row.year.testMin : row.period.testMin)}</td>
                        </>
                      )}
                    </tr>
                  ))}
                  <tr>
                    <td style={totName}>Всього</td>
                    <td style={totP}>{data.totals.period.flights}</td>
                    <td style={totP}>{fmtMin(data.totals.period.minutes)}</td>
                    {data.hasCombat && <td style={totP}>{data.totals.period.combat}</td>}
                    {data.showYear && (
                      <>
                        <td style={totY}>{data.totals.year.flights}</td>
                        <td style={totY}>{fmtMin(data.totals.year.minutes)}</td>
                        {data.hasCombat && <td style={totY}>{data.totals.year.combat}</td>}
                      </>
                    )}
                    {data.hasTest && (
                      <>
                        <td style={totT}>{data.showYear ? data.totals.year.test : data.totals.period.test}</td>
                        <td style={totT}>{fmtMin(data.showYear ? data.totals.year.testMin : data.totals.period.testMin)}</td>
                      </>
                    )}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary info */}
          <div className={s.card}>
            <div style={{ fontSize: 13, color: '#6B7280', fontWeight: 400, marginBottom: 10 }}>Виконано за період</div>
            <div style={{ display: 'flex', gap: 16 }}>
              <SummaryItem label="Льотних днів" value={data.flightDays} />
              <SummaryItem label="Польотів" value={data.totals.period.flights} />
              <SummaryItem label="Наліт" value={fmtMin(data.totals.period.minutes)} />
            </div>
            {data.hasTest && data.totals.period.test > 0 && (
              <>
                <div style={{ fontSize: 13, color: '#6B7280', fontWeight: 400, marginTop: 14, marginBottom: 10 }}>На випробування</div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <SummaryItem label="Польотів" value={data.totals.period.test} />
                  <SummaryItem label="Наліт" value={fmtMin(data.totals.period.testMin)} />
                </div>
              </>
            )}
          </div>
        </>
      )}

      {data && !hasData && !loading && (
        <div className={s.loadingWrap}>
          <IoAirplaneOutline size={40} color="#9CA3AF" />
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

function HeroCard({ value, label }) {
  return (
    <div style={{ flex: 1, background: '#6B7280', borderRadius: 14, padding: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 24, color: '#fff', fontWeight: 400 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 400, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 18, fontWeight: 400, color: '#111827' }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 400, color: '#9CA3AF' }}>{label}</div>
    </div>
  );
}

/* ── Table styles ── */
const base = { fontWeight: 400, whiteSpace: 'nowrap' };

const thName = { ...base, padding: '12px 12px 8px', textAlign: 'left', fontSize: 12, color: '#6B7280', borderBottom: '1px solid #E5E7EB' };

const thGroupP = { ...base, padding: '10px 4px 2px', textAlign: 'center', fontSize: 11, color: '#111827' };
const thGroupY = { ...base, padding: '10px 4px 2px', textAlign: 'center', fontSize: 11, color: '#9CA3AF' };
const thGroupT = { ...base, padding: '10px 4px 2px', textAlign: 'center', fontSize: 11, color: '#78716C' };

const thSubP = { ...base, padding: '2px 6px 10px', textAlign: 'center', fontSize: 11, color: '#6B7280', borderBottom: '1px solid #E5E7EB' };
const thSubY = { ...base, padding: '2px 6px 10px', textAlign: 'center', fontSize: 11, color: '#9CA3AF', borderBottom: '1px solid #E5E7EB' };
const thSubT = { ...base, padding: '2px 6px 10px', textAlign: 'center', fontSize: 11, color: '#78716C', borderBottom: '1px solid #E5E7EB' };

const tdName = { ...base, padding: '10px 12px', fontSize: 14, color: '#374151', borderBottom: '1px solid #F3F4F6' };
const tdP = { ...base, padding: '10px 6px', fontSize: 14, color: '#111827', textAlign: 'center', borderBottom: '1px solid #F3F4F6' };
const tdY = { ...base, padding: '10px 6px', fontSize: 13, color: '#9CA3AF', textAlign: 'center', borderBottom: '1px solid #F3F4F6' };
const tdT = { ...base, padding: '10px 6px', fontSize: 13, color: '#78716C', textAlign: 'center', borderBottom: '1px solid #F3F4F6' };

const totBg = '#F9FAFB';
const totBorder = '2px solid #E5E7EB';
const totName = { ...base, padding: '12px 12px', fontSize: 14, color: '#111827', borderTop: totBorder, background: totBg };
const totP = { ...base, padding: '12px 6px', fontSize: 14, color: '#111827', textAlign: 'center', borderTop: totBorder, background: totBg };
const totY = { ...base, padding: '12px 6px', fontSize: 13, color: '#6B7280', textAlign: 'center', borderTop: totBorder, background: totBg };
const totT = { ...base, padding: '12px 6px', fontSize: 13, color: '#78716C', textAlign: 'center', borderTop: totBorder, background: totBg };
