'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IoChevronBack, IoPrintOutline, IoChevronDown, IoCalendarOutline, IoAirplaneOutline } from 'react-icons/io5';
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

const FLIGHT_TYPES_ORDER = [
  'Тренувальний',
  'Контрольний',
  'На випробування',
  'У складі екіпажу',
];

// Positions for ДНДІ group (in order)
const DNDI_POSITIONS = [
  'Заступник командира в/ч А3444 з ЛП',
  'Начальник СБП в/ч А3444',
  'Начальник ЛМВ в/ч А3444',
  'Головний штурман в/ч А3444',
];

// Check if position belongs to ДНДІ group
const isDndiPosition = (position) => DNDI_POSITIONS.includes(position);

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

function fmtCell(flights, minutes) {
  if (!flights) return '—';
  return `${flights}/${fmtMin(minutes)}`;
}

export default function SummaryAllPage() {
  const { auth } = useAuth();
  const router = useRouter();
  const [period, setPeriod] = useState('this_year');
  const [menuOpen, setMenuOpen] = useState(false);
  const [customStart, setCustomStart] = useState(null);
  const [customEnd, setCustomEnd] = useState(null);
  const [calTarget, setCalTarget] = useState(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [showDndi, setShowDndi] = useState(true);
  const [showLvk, setShowLvk] = useState(true);

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

      const pStart = toISO(range.start);
      const pEnd = toISO(range.end);

      // flights.user_id — це командир запису, його наліт завжди йде в загальну статистику
      // Члени екіпажу (flight_crew) не враховуються тут — тільки в особистій статистиці
      const { data: flights, error } = await supabase
        .from('flights')
        .select('date, aircraft_type_id, flight_type, flight_time, flights_count, time_of_day, aircraft_types(name), users(position)')
        .gte('date', pStart)
        .lte('date', pEnd)
        .order('date');

      if (error) throw error;

      // Filter flights by organization
      const filteredFlights = (flights || []).filter(f => {
        const isDndi = isDndiPosition(f.users?.position);
        if (isDndi) return showDndi;
        return showLvk;
      });

      // Collect all aircraft types
      const aircraftSet = new Set();
      const flightTypesSet = new Set();

      // Structure: { aircraftType: { flightType: { day: {flights, minutes}, night: {flights, minutes} } } }
      const byAircraft = {};

      filteredFlights.forEach(f => {
        const ac = f.aircraft_types?.name || '—';
        const type = f.flight_type || 'Інше';
        const isNight = f.time_of_day === 'Н';
        const timeKey = isNight ? 'night' : 'day';

        aircraftSet.add(ac);
        flightTypesSet.add(type);

        if (!byAircraft[ac]) byAircraft[ac] = {};
        if (!byAircraft[ac][type]) byAircraft[ac][type] = { day: { flights: 0, minutes: 0 }, night: { flights: 0, minutes: 0 } };

        const cnt = f.flights_count || 1;
        const min = parseMin(f.flight_time);

        byAircraft[ac][type][timeKey].flights += cnt;
        byAircraft[ac][type][timeKey].minutes += min;
      });

      // Sort aircraft types
      const aircraftTypes = Array.from(aircraftSet).sort((a, b) => a.localeCompare(b, 'uk'));

      // Sort flight types by predefined order
      const flightTypes = FLIGHT_TYPES_ORDER.filter(t => flightTypesSet.has(t));
      // Add any unknown types at the end
      Array.from(flightTypesSet).forEach(t => {
        if (!FLIGHT_TYPES_ORDER.includes(t)) flightTypes.push(t);
      });

      // Calculate totals per aircraft (column totals)
      const aircraftTotals = {};
      aircraftTypes.forEach(ac => {
        aircraftTotals[ac] = { day: { flights: 0, minutes: 0 }, night: { flights: 0, minutes: 0 } };
        flightTypes.forEach(type => {
          if (byAircraft[ac]?.[type]) {
            aircraftTotals[ac].day.flights += byAircraft[ac][type].day.flights;
            aircraftTotals[ac].day.minutes += byAircraft[ac][type].day.minutes;
            aircraftTotals[ac].night.flights += byAircraft[ac][type].night.flights;
            aircraftTotals[ac].night.minutes += byAircraft[ac][type].night.minutes;
          }
        });
      });

      // Calculate row totals (Загальний column)
      const rowTotals = {};
      flightTypes.forEach(type => {
        rowTotals[type] = { day: { flights: 0, minutes: 0 }, night: { flights: 0, minutes: 0 } };
        aircraftTypes.forEach(ac => {
          if (byAircraft[ac]?.[type]) {
            rowTotals[type].day.flights += byAircraft[ac][type].day.flights;
            rowTotals[type].day.minutes += byAircraft[ac][type].day.minutes;
            rowTotals[type].night.flights += byAircraft[ac][type].night.flights;
            rowTotals[type].night.minutes += byAircraft[ac][type].night.minutes;
          }
        });
      });

      // Calculate grand totals
      const totalDay = { flights: 0, minutes: 0 };
      const totalNight = { flights: 0, minutes: 0 };
      const grandTotal = { flights: 0, minutes: 0 };

      aircraftTypes.forEach(ac => {
        totalDay.flights += aircraftTotals[ac].day.flights;
        totalDay.minutes += aircraftTotals[ac].day.minutes;
        totalNight.flights += aircraftTotals[ac].night.flights;
        totalNight.minutes += aircraftTotals[ac].night.minutes;
      });
      grandTotal.flights = totalDay.flights + totalNight.flights;
      grandTotal.minutes = totalDay.minutes + totalNight.minutes;

      // Count flight dates
      const flightDates = new Set();
      filteredFlights.forEach(f => flightDates.add(f.date));

      const hasNight = totalNight.flights > 0;

      setData({
        byAircraft,
        aircraftTypes,
        flightTypes,
        aircraftTotals,
        rowTotals,
        totalDay,
        totalNight,
        grandTotal,
        hasNight,
        flightDays: flightDates.size,
        year: range.start.getFullYear(),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [period, customStart, customEnd, showDndi, showLvk]);

  useEffect(() => { load(); }, [load]);

  const onCalSelect = (date) => {
    if (calTarget === 'start') { setCustomStart(date); if (!customEnd || date > customEnd) setCustomEnd(date); }
    else setCustomEnd(date);
    setCalTarget(null);
  };

  const handlePrint = () => window.print();

  const today = new Date();
  const dateStr = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`;

  const hasData = data && data.aircraftTypes.length > 0;

  // Get period date string for title
  const getPeriodDates = () => {
    const today = fmtDate(new Date());
    if (period === 'custom' && customStart && customEnd) {
      return `в період з ${fmtDate(customStart)} по ${fmtDate(customEnd)}`;
    }
    const range = getDateRange(period);
    const endDate = range.end > new Date() ? today : fmtDate(range.end);
    return `в період з ${fmtDate(range.start)} по ${endDate}`;
  };

  return (
    <div className={s.container}>
      {/* Filter row */}
      <div className={s.filterRow}>
        <button className={s.backBtn} onClick={() => router.push('/tabs/readiness')}>
          <IoChevronBack size={20} />
        </button>

        <div style={{ flex: 1 }} />

        {/* Period selector */}
        <div className={s.periodSelect} onClick={() => setMenuOpen(true)}>
          <span className={s.periodText}>{periodLabel}</span>
          <span className={s.periodArrow}><IoChevronDown size={16} /></span>
        </div>

        {/* Custom date range */}
        {period === 'custom' && (
          <>
            <div className={s.dateBtnSmall} onClick={() => setCalTarget('start')}>
              <IoCalendarOutline size={14} />
              <span>{customStart ? fmtDate(customStart) : 'Від'}</span>
            </div>
            <span className={s.dateSepSmall}>—</span>
            <div className={s.dateBtnSmall} onClick={() => setCalTarget('end')}>
              <IoCalendarOutline size={14} />
              <span>{customEnd ? fmtDate(customEnd) : 'До'}</span>
            </div>
          </>
        )}

        {/* Organization filter */}
        <div className={s.orgFilter}>
          <label className={s.orgCheckbox}>
            <input type="checkbox" checked={showDndi} onChange={(e) => setShowDndi(e.target.checked)} />
            <span>ДНДІ</span>
          </label>
          <label className={s.orgCheckbox}>
            <input type="checkbox" checked={showLvk} onChange={(e) => setShowLvk(e.target.checked)} />
            <span>ЛВК</span>
          </label>
        </div>

        <button className={s.printBtn} onClick={handlePrint}>
          <IoPrintOutline size={18} />
          Друк
        </button>
      </div>

      {loading && !data && (
        <div className={s.loading}>
          <div className={s.spinner}></div>
        </div>
      )}

      {hasData && (
        <>
          {/* Title with period */}
          <div className={s.titleRow}>
            Підсумки льотної підготовки {getPeriodDates()}
          </div>

          {/* Organization header */}
          {showDndi && !showLvk && (
            <div className={s.orgHeader}>
              ДЕРЖАВНИЙ НАУКОВО-ДОСЛІДНИЙ ІНСТИТУТ ВИПРОБУВАНЬ І СЕРТИФІКАЦІЇ ОЗБРОЄННЯ ТА ВІЙСЬКОВОЇ ТЕХНІКИ
            </div>
          )}
          {!showDndi && showLvk && (
            <div className={s.orgHeader}>
              ЛЬОТНО-ВИПРОБУВАЛЬНИЙ КОМПЛЕКС
            </div>
          )}
          <div className={s.tableWrap}>
            <table className={s.matrixTable}>
              <thead>
                <tr>
                  <th style={thFirst}>Види польотів</th>
                  {data.aircraftTypes.map(ac => (
                    <th key={ac} style={thAc}>{ac}</th>
                  ))}
                  <th style={thTotal}>Загальний</th>
                </tr>
              </thead>
              <tbody>
                {/* DAY section */}
                {data.flightTypes.map(type => (
                  <tr key={`day-${type}`}>
                    <td style={tdName}>{type}</td>
                    {data.aircraftTypes.map(ac => {
                      const cell = data.byAircraft[ac]?.[type]?.day;
                      return (
                        <td key={ac} style={tdVal}>
                          {cell?.flights ? fmtCell(cell.flights, cell.minutes) : '—'}
                        </td>
                      );
                    })}
                    <td style={tdTotalCol}>
                      {fmtCell(data.rowTotals[type].day.flights, data.rowTotals[type].day.minutes)}
                    </td>
                  </tr>
                ))}
                {/* Day total */}
                <tr>
                  <td style={tdSubNameDay}>Всього День</td>
                  {data.aircraftTypes.map(ac => (
                    <td key={ac} style={tdSubValDay}>
                      {fmtCell(data.aircraftTotals[ac].day.flights, data.aircraftTotals[ac].day.minutes)}
                    </td>
                  ))}
                  <td style={tdSubTotalDay}>
                    {fmtCell(data.totalDay.flights, data.totalDay.minutes)}
                  </td>
                </tr>

                {/* NIGHT section (if any) */}
                {data.hasNight && (
                  <>
                    <tr><td colSpan={data.aircraftTypes.length + 2} style={{ height: 16 }}></td></tr>
                    {data.flightTypes.map(type => (
                      <tr key={`night-${type}`}>
                        <td style={tdName}>{type}</td>
                        {data.aircraftTypes.map(ac => {
                          const cell = data.byAircraft[ac]?.[type]?.night;
                          return (
                            <td key={ac} style={tdVal}>
                              {cell?.flights ? fmtCell(cell.flights, cell.minutes) : '—'}
                            </td>
                          );
                        })}
                        <td style={tdTotalCol}>
                          {fmtCell(data.rowTotals[type].night.flights, data.rowTotals[type].night.minutes)}
                        </td>
                      </tr>
                    ))}
                    {/* Night total */}
                    <tr>
                      <td style={tdSubNameNight}>Всього Ніч</td>
                      {data.aircraftTypes.map(ac => (
                        <td key={ac} style={tdSubValNight}>
                          {fmtCell(data.aircraftTotals[ac].night.flights, data.aircraftTotals[ac].night.minutes)}
                        </td>
                      ))}
                      <td style={tdSubTotalNight}>
                        {fmtCell(data.totalNight.flights, data.totalNight.minutes)}
                      </td>
                    </tr>
                  </>
                )}

                {/* Grand total */}
                <tr><td colSpan={data.aircraftTypes.length + 2} style={{ height: 8 }}></td></tr>
                <tr>
                  <td style={tdGrandName}>Всього</td>
                  {data.aircraftTypes.map(ac => {
                    const total = data.aircraftTotals[ac].day.flights + data.aircraftTotals[ac].night.flights;
                    const min = data.aircraftTotals[ac].day.minutes + data.aircraftTotals[ac].night.minutes;
                    return (
                      <td key={ac} style={tdGrandVal}>
                        {fmtCell(total, min)}
                      </td>
                    );
                  })}
                  <td style={tdGrandTotal}>
                    {fmtCell(data.grandTotal.flights, data.grandTotal.minutes)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

        </>
      )}

      {data && !hasData && !loading && (
        <div className={s.empty}>
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

/* ── Table styles ── */
const base = { fontWeight: 400, whiteSpace: 'nowrap' };

// Headers - як нижній рядок Всього
const thFirst = { ...base, padding: '12px 12px', textAlign: 'left', fontSize: 14, color: '#111827', borderBottom: '2px solid #9CA3AF', background: '#D1D5DB' };
const thAc = { ...base, padding: '12px 8px', textAlign: 'center', fontSize: 14, color: '#111827', borderBottom: '2px solid #9CA3AF', background: '#D1D5DB' };
const thTotal = { ...base, padding: '12px 10px', textAlign: 'center', fontSize: 14, color: '#111827', borderBottom: '2px solid #9CA3AF', background: '#D1D5DB' };

// Data cells
const tdName = { ...base, padding: '10px 12px', fontSize: 13, color: '#374151', borderBottom: '1px solid #F3F4F6' };
const tdVal = { ...base, padding: '10px 8px', fontSize: 13, color: '#111827', textAlign: 'center', borderBottom: '1px solid #F3F4F6' };
const tdTotalCol = { ...base, padding: '10px 10px', fontSize: 13, color: '#111827', textAlign: 'center', borderBottom: '1px solid #F3F4F6', background: '#FAFAFA' };

// Day subtotal (light gray) - весь рядок однаковий
const tdSubNameDay = { ...base, padding: '10px 12px', fontSize: 13, color: '#374151', borderTop: '1px solid #D1D5DB', background: '#F3F4F6' };
const tdSubValDay = { ...base, padding: '10px 8px', fontSize: 13, color: '#374151', textAlign: 'center', borderTop: '1px solid #D1D5DB', background: '#F3F4F6' };
const tdSubTotalDay = { ...base, padding: '10px 10px', fontSize: 13, color: '#374151', textAlign: 'center', borderTop: '1px solid #D1D5DB', background: '#F3F4F6' };

// Night subtotal (light gray) - весь рядок однаковий
const tdSubNameNight = { ...base, padding: '10px 12px', fontSize: 13, color: '#374151', borderTop: '1px solid #D1D5DB', background: '#F3F4F6' };
const tdSubValNight = { ...base, padding: '10px 8px', fontSize: 13, color: '#374151', textAlign: 'center', borderTop: '1px solid #D1D5DB', background: '#F3F4F6' };
const tdSubTotalNight = { ...base, padding: '10px 10px', fontSize: 13, color: '#374151', textAlign: 'center', borderTop: '1px solid #D1D5DB', background: '#F3F4F6' };

// Grand total (darker gray) - весь рядок однаковий
const tdGrandName = { ...base, padding: '12px 12px', fontSize: 14, color: '#111827', borderTop: '2px solid #9CA3AF', background: '#D1D5DB' };
const tdGrandVal = { ...base, padding: '12px 8px', fontSize: 14, color: '#111827', textAlign: 'center', borderTop: '2px solid #9CA3AF', background: '#D1D5DB' };
const tdGrandTotal = { ...base, padding: '12px 10px', fontSize: 14, color: '#111827', textAlign: 'center', borderTop: '2px solid #9CA3AF', background: '#D1D5DB' };
