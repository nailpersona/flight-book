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

const FLIGHT_TYPES_ORDER = [
  'Тренувальний',
  'Контрольний',
  'На випробування',
  'У складі екіпажу',
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

      // Get current user's ID to filter flights
      const { data: userData, error: userErr } = await supabase
        .from('users')
        .select('id')
        .eq('name', auth.pib)
        .maybeSingle();

      if (userErr || !userData) {
        setData(null);
        setLoading(false);
        return;
      }

      let range;
      if (period === 'custom') {
        if (!customStart || !customEnd) { setData(null); setLoading(false); return; }
        range = { start: customStart, end: customEnd };
      } else {
        range = getDateRange(period);
      }

      const pStart = toISO(range.start);
      const pEnd = toISO(range.end);

      const { data: flights, error } = await supabase
        .from('flights')
        .select('date, flight_type, flight_time, flights_count, combat_applications, time_of_day')
        .eq('user_id', userData.id)
        .gte('date', pStart)
        .lte('date', pEnd)
        .order('date');

      if (error) throw error;

      // Group by flight_type and day/night
      const byType = {};
      const bucket = () => ({ flights: 0, minutes: 0, combat: 0 });

      (flights || []).forEach(f => {
        const type = f.flight_type || 'Інше';
        const isNight = f.time_of_day === 'Н';
        const timeKey = isNight ? 'night' : 'day';

        if (!byType[type]) byType[type] = { day: bucket(), night: bucket() };

        const cnt = f.flights_count || 1;
        const min = parseMin(f.flight_time);
        const cmb = f.combat_applications || 0;

        byType[type][timeKey].flights += cnt;
        byType[type][timeKey].minutes += min;
        byType[type][timeKey].combat += cmb;
      });

      // Sort by predefined order
      const sortedTypes = Object.keys(byType).sort((a, b) => {
        const idxA = FLIGHT_TYPES_ORDER.indexOf(a);
        const idxB = FLIGHT_TYPES_ORDER.indexOf(b);
        if (idxA === -1 && idxB === -1) return a.localeCompare(b, 'uk');
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      });

      // Calculate totals
      const totalDay = bucket();
      const totalNight = bucket();
      let hasNight = false;
      let hasCombat = false;

      sortedTypes.forEach(type => {
        const t = byType[type];
        totalDay.flights += t.day.flights;
        totalDay.minutes += t.day.minutes;
        totalDay.combat += t.day.combat;
        totalNight.flights += t.night.flights;
        totalNight.minutes += t.night.minutes;
        totalNight.combat += t.night.combat;
        if (t.night.flights > 0) hasNight = true;
        if (t.day.combat > 0 || t.night.combat > 0) hasCombat = true;
      });

      const totalAll = {
        flights: totalDay.flights + totalNight.flights,
        minutes: totalDay.minutes + totalNight.minutes,
        combat: totalDay.combat + totalNight.combat,
      };

      // Count flight dates
      const flightDates = new Set();
      (flights || []).forEach(f => flightDates.add(f.date));

      setData({
        byType,
        sortedTypes,
        totalDay,
        totalNight,
        totalAll,
        hasNight,
        hasCombat,
        flightDays: flightDates.size,
        year: range.start.getFullYear(),
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

  const hasData = data && data.sortedTypes.length > 0;

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
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <HeroCard value={data.totalAll.flights} label="польотів" />
            <HeroCard value={fmtMin(data.totalAll.minutes)} label="наліт" />
            {data.hasCombat && <HeroCard value={data.totalAll.combat} label="бой.заст" />}
          </div>

          {/* Main table */}
          <div className={s.card} style={{ padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 280 }}>
                <thead>
                  <tr>
                    <th style={thName}>Вид польотів</th>
                    <th style={thSub}>Польотів</th>
                    <th style={thSub}>Наліт</th>
                    {data.hasCombat && <th style={thSub}>Б.з.</th>}
                  </tr>
                </thead>
                <tbody>
                  {/* Day flights */}
                  {data.sortedTypes.map(type => {
                    const t = data.byType[type];
                    if (t.day.flights === 0) return null;
                    return (
                      <tr key={`${type}-day`}>
                        <td style={tdName}>{type}</td>
                        <td style={tdVal}>{t.day.flights}</td>
                        <td style={tdVal}>{fmtMin(t.day.minutes)}</td>
                        {data.hasCombat && <td style={tdVal}>{fmtNum(t.day.combat)}</td>}
                      </tr>
                    );
                  })}
                  {/* Day total */}
                  <tr style={{ background: '#F0F9FF' }}>
                    <td style={totSubName}>Всього День</td>
                    <td style={totSubVal}>{data.totalDay.flights}</td>
                    <td style={totSubVal}>{fmtMin(data.totalDay.minutes)}</td>
                    {data.hasCombat && <td style={totSubVal}>{data.totalDay.combat}</td>}
                  </tr>

                  {/* Night flights (if any) */}
                  {data.hasNight && (
                    <>
                      <tr><td colSpan={data.hasCombat ? 4 : 3} style={{ height: 12 }}></td></tr>
                      {data.sortedTypes.map(type => {
                        const t = data.byType[type];
                        if (t.night.flights === 0) return null;
                        return (
                          <tr key={`${type}-night`}>
                            <td style={tdName}>{type}</td>
                            <td style={tdVal}>{t.night.flights}</td>
                            <td style={tdVal}>{fmtMin(t.night.minutes)}</td>
                            {data.hasCombat && <td style={tdVal}>{fmtNum(t.night.combat)}</td>}
                          </tr>
                        );
                      })}
                      {/* Night total */}
                      <tr style={{ background: '#FEF3C7' }}>
                        <td style={totSubName}>Всього Ніч</td>
                        <td style={totSubVal}>{data.totalNight.flights}</td>
                        <td style={totSubVal}>{fmtMin(data.totalNight.minutes)}</td>
                        {data.hasCombat && <td style={totSubVal}>{data.totalNight.combat}</td>}
                      </tr>
                    </>
                  )}

                  {/* Grand total */}
                  <tr><td colSpan={data.hasCombat ? 4 : 3} style={{ height: 8 }}></td></tr>
                  <tr style={{ background: '#F9FAFB' }}>
                    <td style={totName}>Всього за період</td>
                    <td style={totP}>{data.totalAll.flights}</td>
                    <td style={totP}>{fmtMin(data.totalAll.minutes)}</td>
                    {data.hasCombat && <td style={totP}>{data.totalAll.combat}</td>}
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
              <SummaryItem label="Польотів" value={data.totalAll.flights} />
              <SummaryItem label="Наліт" value={fmtMin(data.totalAll.minutes)} />
            </div>
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
const thSub = { ...base, padding: '2px 6px 10px', textAlign: 'center', fontSize: 11, color: '#6B7280', borderBottom: '1px solid #E5E7EB' };

const tdName = { ...base, padding: '10px 12px', fontSize: 14, color: '#374151', borderBottom: '1px solid #F3F4F6' };
const tdVal = { ...base, padding: '10px 6px', fontSize: 14, color: '#111827', textAlign: 'center', borderBottom: '1px solid #F3F4F6' };

const totSubBg = '#F0F9FF';
const totSubBorder = '1px solid #BAE6FD';
const totSubName = { ...base, padding: '10px 12px', fontSize: 13, color: '#0369A1', borderTop: totSubBorder, background: totSubBg };
const totSubVal = { ...base, padding: '10px 6px', fontSize: 13, color: '#0369A1', textAlign: 'center', borderTop: totSubBorder, background: totSubBg };

const totBg = '#F9FAFB';
const totBorder = '2px solid #E5E7EB';
const totName = { ...base, padding: '12px 12px', fontSize: 14, color: '#111827', borderTop: totBorder, background: totBg };
const totP = { ...base, padding: '12px 6px', fontSize: 14, color: '#111827', textAlign: 'center', borderTop: totBorder, background: totBg };
