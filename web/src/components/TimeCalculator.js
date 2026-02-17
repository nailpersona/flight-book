'use client';
import { useState } from 'react';
import { IoClose, IoTimeOutline, IoSyncOutline, IoSpeedometerOutline, IoSunnyOutline, IoMoonOutline, IoChevronDownOutline, IoChevronUpOutline, IoChevronBackOutline, IoChevronForwardOutline, IoCalendarOutline } from 'react-icons/io5';

const g = 9.81;

const MODES = [
  { key: 'time', label: 'Час', icon: IoTimeOutline },
  { key: 'turn', label: 'Розворот', icon: IoSyncOutline },
  { key: 'tsd', label: 'TSD', icon: IoSpeedometerOutline },
  { key: 'sun', label: 'Сонце', icon: IoSunnyOutline },
  { key: 'moon', label: 'Місяць', icon: IoMoonOutline },
];

export default function TimeCalculator({ isOpen, onClose }) {
  const [mode, setMode] = useState('time');
  const [showModeMenu, setShowModeMenu] = useState(false);

  if (!isOpen) return null;

  const ModeIcon = MODES.find(m => m.key === mode)?.icon || IoTimeOutline;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {/* Phone frame */}
      <div style={{
        width: 375,
        maxHeight: '90vh',
        backgroundColor: '#F3F4F6',
        borderRadius: 40,
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid #E5E7EB',
          backgroundColor: '#FFFFFF',
          position: 'relative',
        }}>
          <button
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              border: 'none',
              background: '#F3F4F6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <IoClose size={22} color="#111827" />
          </button>

          <button
            onClick={() => setShowModeMenu(!showModeMenu)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 8,
              border: 'none',
              background: '#F3F4F6',
              cursor: 'pointer',
            }}
          >
            <ModeIcon size={20} color="#111827" />
            <span style={{ fontSize: 16, fontWeight: 400, color: '#111827' }}>
              {MODES.find(m => m.key === mode)?.label}
            </span>
            {showModeMenu ? (
              <IoChevronUpOutline size={16} color="#6B7280" />
            ) : (
              <IoChevronDownOutline size={16} color="#6B7280" />
            )}
          </button>

          <div style={{ width: 36 }} />
        </div>

        {/* Mode menu */}
        {showModeMenu && (
          <div style={{
            position: 'absolute',
            top: 60,
            left: '50%',
            marginLeft: -80,
            width: 160,
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            border: '1px solid #E5E7EB',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 10,
            overflow: 'hidden',
          }}>
            {MODES.map(m => {
              const Icon = m.icon;
              return (
                <button
                  key={m.key}
                  onClick={() => {
                    setMode(m.key);
                    setShowModeMenu(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '12px 14px',
                    border: 'none',
                    borderBottom: '1px solid #E5E7EB',
                    background: mode === m.key ? '#F3F4F6' : '#FFFFFF',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <Icon size={20} color={mode === m.key ? '#111827' : '#6B7280'} />
                  <span style={{
                    fontSize: 15,
                    fontWeight: 400,
                    color: mode === m.key ? '#111827' : '#6B7280',
                  }}>
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {mode === 'time' && <TimeMode />}
          {mode === 'turn' && <TurnMode />}
          {mode === 'tsd' && <TSDMode />}
          {mode === 'sun' && <SunMode />}
          {mode === 'moon' && <MoonMode />}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TIME MODE
// ═══════════════════════════════════════════════════════════

function TimeMode() {
  const [display, setDisplay] = useState('00:00');
  const [expression, setExpression] = useState('');
  const [currentInput, setCurrentInput] = useState('');
  const [operator, setOperator] = useState(null);
  const [previousTime, setPreviousTime] = useState(null);
  const [justCalculated, setJustCalculated] = useState(false);

  const minutesToDisplay = (totalMinutes) => {
    const isNegative = totalMinutes < 0;
    const absMinutes = Math.abs(totalMinutes);
    const hours = Math.floor(absMinutes / 60);
    const minutes = absMinutes % 60;
    const result = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    return isNegative ? `-${result}` : result;
  };

  const displayToMinutes = (timeStr) => {
    const cleaned = timeStr.replace('-', '');
    const parts = cleaned.split(':');
    if (parts.length !== 2) return 0;
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    const total = hours * 60 + minutes;
    return timeStr.startsWith('-') ? -total : total;
  };

  const parseInputToTime = (input) => {
    if (!input) return '00:00';
    const cleaned = input.replace(/[^0-9]/g, '');
    const padded = cleaned.padStart(4, '0');
    const hh = padded.slice(-4, -2);
    const mm = padded.slice(-2);
    return `${hh}:${mm}`;
  };

  const handleNumber = (num) => {
    if (justCalculated) {
      setCurrentInput(num);
      setDisplay(parseInputToTime(num));
      setJustCalculated(false);
    } else {
      const newInput = currentInput + num;
      if (newInput.length <= 4) {
        setCurrentInput(newInput);
        setDisplay(parseInputToTime(newInput));
      }
    }
  };

  const handleOperator = (op) => {
    if (previousTime !== null && operator && !justCalculated) {
      calculate();
    }
    setPreviousTime(displayToMinutes(display));
    setOperator(op);
    setCurrentInput('');
    setExpression(`${display} ${op}`);
    setJustCalculated(false);
  };

  const calculate = () => {
    if (previousTime === null || !operator) return;
    const currentTime = displayToMinutes(display);
    let result;
    if (operator === '+') result = previousTime + currentTime;
    else if (operator === '-') result = previousTime - currentTime;
    setDisplay(minutesToDisplay(result));
    setExpression('');
    setPreviousTime(null);
    setOperator(null);
    setCurrentInput('');
    setJustCalculated(true);
  };

  const handleClear = () => {
    setDisplay('00:00');
    setExpression('');
    setCurrentInput('');
    setOperator(null);
    setPreviousTime(null);
    setJustCalculated(false);
  };

  const handleBackspace = () => {
    if (currentInput.length > 0) {
      const newInput = currentInput.slice(0, -1);
      setCurrentInput(newInput);
      setDisplay(parseInputToTime(newInput));
    } else if (justCalculated) {
      handleClear();
    }
  };

  return (
    <div>
      <div style={{
        backgroundColor: '#FFFFFF',
        padding: '24px 20px',
        borderBottom: '1px solid #E5E7EB',
      }}>
        <div style={{
          fontSize: 18,
          fontWeight: 400,
          color: '#9CA3AF',
          textAlign: 'right',
          marginBottom: 8,
          minHeight: 24,
        }}>{expression || '\u00A0'}</div>
        <div style={{
          fontSize: 48,
          fontWeight: 400,
          color: '#111827',
          textAlign: 'right',
          letterSpacing: 2,
        }}>{display}</div>
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          ['C', '⌫', '+', '-'],
          ['7', '8', '9', '='],
          ['4', '5', '6', ''],
          ['1', '2', '3', ''],
          ['', '0', '', ''],
        ].map((row, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
            {row.map((val, j) => {
              if (!val) return <div key={j} style={{ width: 64, height: 64 }} />;
              let type = 'num';
              if (['C', '⌫'].includes(val)) type = 'func';
              if (['+', '-', '='].includes(val)) type = 'op';
              let onClick;
              if (val === 'C') onClick = handleClear;
              else if (val === '⌫') onClick = handleBackspace;
              else if (val === '+') onClick = () => handleOperator('+');
              else if (val === '-') onClick = () => handleOperator('-');
              else if (val === '=') onClick = calculate;
              else onClick = () => handleNumber(val);
              return <CalcButton key={j} value={val} onClick={onClick} type={type} />;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TURN MODE
// ═══════════════════════════════════════════════════════════

function TurnMode() {
  const [tas, setTas] = useState('');
  const [bankAngle, setBankAngle] = useState('');
  const [turnAngle, setTurnAngle] = useState('360');

  const tasNum = parseFloat(tas) || 0;
  const bankNum = parseFloat(bankAngle) || 0;
  const turnNum = parseFloat(turnAngle) || 360;

  const vMs = tasNum / 3.6;
  const bankRad = (bankNum * Math.PI) / 180;

  const loadFactor = bankNum > 0 && bankNum < 90 ? 1 / Math.cos(bankRad) : 1;
  const turnRadius = bankNum > 0 ? (vMs * vMs) / (g * Math.tan(bankRad)) : 0;
  const fullCircleTime = bankNum > 0 ? (2 * Math.PI * vMs) / (g * Math.tan(bankRad)) : 0;
  const turnTime = fullCircleTime * (turnNum / 360);

  const formatTime = (seconds) => {
    if (!seconds || !isFinite(seconds)) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const formatDistance = (meters) => {
    if (!meters || !isFinite(meters)) return '—';
    if (meters >= 1000) return `${(meters / 1000).toFixed(2)} км`;
    return `${Math.round(meters)} м`;
  };

  return (
    <div style={{ padding: 20 }}>
      <InputField label="TAS (км/год)" value={tas} onChange={setTas} placeholder="500" />
      <InputField label="Кут крену (°)" value={bankAngle} onChange={setBankAngle} placeholder="30" />
      <InputField label="Кут розвороту (°)" value={turnAngle} onChange={setTurnAngle} placeholder="360" />

      <div style={{ height: 1, backgroundColor: '#E5E7EB', margin: '20px 0' }} />

      <ResultRow label="Час розвороту" value={formatTime(turnTime)} />
      <ResultRow label="Радіус віражу" value={formatDistance(turnRadius)} />
      <ResultRow label="Перевантаження" value={loadFactor > 1 ? `${loadFactor.toFixed(2)}g` : '—'} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TSD MODE
// ═══════════════════════════════════════════════════════════

function TSDMode() {
  const [time, setTime] = useState('');
  const [speed, setSpeed] = useState('');
  const [distance, setDistance] = useState('');

  const timeNum = parseFloat(time) || 0;
  const speedNum = parseFloat(speed) || 0;
  const distanceNum = parseFloat(distance) || 0;

  let result = null;
  let resultLabel = '';

  if (speedNum > 0 && distanceNum > 0 && timeNum === 0) {
    const t = (distanceNum / speedNum) * 60;
    result = `${Math.floor(t)} хв`;
    resultLabel = 'Час';
  } else if (timeNum > 0 && distanceNum > 0 && speedNum === 0) {
    const s = distanceNum / (timeNum / 60);
    result = `${s.toFixed(0)} км/год`;
    resultLabel = 'Швидкість';
  } else if (timeNum > 0 && speedNum > 0 && distanceNum === 0) {
    const d = speedNum * (timeNum / 60);
    result = `${d.toFixed(1)} км`;
    resultLabel = 'Дальність';
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 16 }}>
        Введіть будь-які два параметри:
      </div>

      <InputField label="Час (хв)" value={time} onChange={setTime} placeholder="30" />
      <InputField label="Швидкість (км/год)" value={speed} onChange={setSpeed} placeholder="500" />
      <InputField label="Дальність (км)" value={distance} onChange={setDistance} placeholder="250" />

      <div style={{ height: 1, backgroundColor: '#E5E7EB', margin: '20px 0' }} />

      {result ? (
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 12,
          padding: 20,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 4 }}>{resultLabel}</div>
          <div style={{ fontSize: 28, color: '#111827', fontWeight: 400 }}>{result}</div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 20 }}>
          Введіть два параметри
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SUN MODE
// ═══════════════════════════════════════════════════════════

function SunMode() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const lat = 49; // Центральна Україна

  const MONTHS_UA = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  const WEEKDAYS_UA = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

  const formatDateUA = (d) => {
    return `${d.getDate()} ${MONTHS_UA[d.getMonth()]} ${d.getFullYear()}`;
  };

  const getDayOfYear = (d) => {
    const start = new Date(d.getFullYear(), 0, 0);
    const diff = d - start;
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
  };

  const dayOfYear = getDayOfYear(selectedDate);

  const calculateSunTimes = () => {
    const declination = -23.45 * Math.cos((360 / 365) * (dayOfYear + 10) * Math.PI / 180);
    const declRad = declination * Math.PI / 180;
    const latRad = lat * Math.PI / 180;

    const cosH = -Math.tan(latRad) * Math.tan(declRad);

    if (cosH > 1) return { sunrise: '—', sunset: '—', dayLength: 0 };
    if (cosH < -1) return { sunrise: '00:00', sunset: '23:59', dayLength: 24 * 60 };

    const H = Math.acos(cosH) * 180 / Math.PI;
    const sunriseHour = 12 - H / 15;
    const sunsetHour = 12 + H / 15;

    const formatHour = (h) => {
      const hours = Math.floor(h);
      const minutes = Math.round((h - hours) * 60);
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    };

    return {
      sunrise: formatHour(sunriseHour),
      sunset: formatHour(sunsetHour),
      dayLength: (sunsetHour - sunriseHour) * 60
    };
  };

  const sunTimes = calculateSunTimes();

  const formatDayLength = (totalMin) => {
    if (!totalMin) return '—';
    const h = Math.floor(totalMin / 60);
    const m = Math.round(totalMin % 60);
    return `${h}:${String(m).padStart(2, '0')}`;
  };

  const generateCalendarDays = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;

    const days = [];

    for (let i = 0; i < startDay; i++) {
      days.push({ day: null, date: null });
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({ day: d, date: new Date(year, month, d) });
    }

    return days;
  };

  const calendarDays = generateCalendarDays();

  const isSelectedDate = (d) => {
    if (!d) return false;
    return d.getDate() === selectedDate.getDate() &&
           d.getMonth() === selectedDate.getMonth() &&
           d.getFullYear() === selectedDate.getFullYear();
  };

  const isToday = (d) => {
    if (!d) return false;
    const today = new Date();
    return d.getDate() === today.getDate() &&
           d.getMonth() === today.getMonth() &&
           d.getFullYear() === today.getFullYear();
  };

  const prevMonth = () => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 16 }}>
        <label style={{
          display: 'block',
          fontSize: 13,
          fontWeight: 400,
          color: '#6B7280',
          marginBottom: 6,
        }}>Дата</label>
        <button
          onClick={() => setShowCalendar(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: '12px 14px',
            fontSize: 16,
            fontWeight: 400,
            color: '#111827',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: 10,
            cursor: 'pointer',
            boxSizing: 'border-box',
          }}
        >
          {formatDateUA(selectedDate)}
          <IoCalendarOutline size={20} color="#6B7280" />
        </button>
      </div>

      <div style={{ height: 1, backgroundColor: '#E5E7EB', margin: '20px 0' }} />

      <ResultRow label="Схід" value={sunTimes.sunrise} highlight />
      <ResultRow label="Захід" value={sunTimes.sunset} highlight />
      <ResultRow label="Тривалість дня" value={formatDayLength(sunTimes.dayLength)} highlight />

      {/* Calendar Modal */}
      {showCalendar && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
        }} onClick={() => setShowCalendar(false)}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            padding: 16,
            width: 320,
          }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 4,
            }}>
              <button onClick={prevMonth} style={{ border: 'none', background: 'none', padding: 8, cursor: 'pointer' }}>
                <IoChevronBackOutline size={24} color="#111827" />
              </button>
              <span style={{ fontSize: 20, fontWeight: 400, color: '#111827' }}>
                {calendarMonth.getFullYear()}
              </span>
              <button onClick={nextMonth} style={{ border: 'none', background: 'none', padding: 8, cursor: 'pointer' }}>
                <IoChevronForwardOutline size={24} color="#111827" />
              </button>
            </div>

            {/* Month name */}
            <div style={{
              fontSize: 16,
              fontWeight: 400,
              color: '#6B7280',
              textAlign: 'center',
              marginBottom: 16,
            }}>
              {MONTHS_UA[calendarMonth.getMonth()].charAt(0).toUpperCase() + MONTHS_UA[calendarMonth.getMonth()].slice(1)}
            </div>

            {/* Weekdays */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-around',
              marginBottom: 8,
            }}>
              {WEEKDAYS_UA.map((day, i) => (
                <span key={i} style={{
                  fontSize: 12,
                  fontWeight: 400,
                  color: '#9CA3AF',
                  width: 40,
                  textAlign: 'center',
                }}>{day}</span>
              ))}
            </div>

            {/* Days grid */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'flex-start',
            }}>
              {calendarDays.map((item, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (item.date) {
                      setSelectedDate(item.date);
                      setShowCalendar(false);
                    }
                  }}
                  disabled={!item.day}
                  style={{
                    width: 40,
                    height: 40,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 4,
                    border: 'none',
                    borderRadius: 20,
                    cursor: item.day ? 'pointer' : 'default',
                    fontSize: 15,
                    fontWeight: 400,
                    color: isSelectedDate(item.date) ? '#FFFFFF' : '#111827',
                    backgroundColor: isSelectedDate(item.date)
                      ? '#111827'
                      : isToday(item.date)
                        ? '#F3F4F6'
                        : 'transparent',
                  }}
                >
                  {item.day || ''}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MOON MODE
// ═══════════════════════════════════════════════════════════

function MoonMode() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const MONTHS_UA = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  const WEEKDAYS_UA = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

  const formatDateUA = (d) => {
    return `${d.getDate()} ${MONTHS_UA[d.getMonth()]} ${d.getFullYear()}`;
  };

  const generateCalendarDays = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;

    const days = [];

    for (let i = 0; i < startDay; i++) {
      days.push({ day: null, date: null });
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({ day: d, date: new Date(year, month, d) });
    }

    return days;
  };

  const calendarDays = generateCalendarDays();

  const isSelectedDate = (d) => {
    if (!d) return false;
    return d.getDate() === selectedDate.getDate() &&
           d.getMonth() === selectedDate.getMonth() &&
           d.getFullYear() === selectedDate.getFullYear();
  };

  const isToday = (d) => {
    if (!d) return false;
    const today = new Date();
    return d.getDate() === today.getDate() &&
           d.getMonth() === today.getMonth() &&
           d.getFullYear() === today.getFullYear();
  };

  const prevMonth = () => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));
  };

  const getMoonPhase = (dateObj) => {
    const d = dateObj;
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();

    let jd;
    if (month < 3) {
      const y = year - 1;
      const m = month + 12;
      jd = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day - 1524.5;
    } else {
      jd = Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day - 1524.5;
    }

    const phase = ((jd - 2451550.1) / 29.530588853) % 1;
    const age = phase * 29.53;

    let phaseName = '';
    let illumination = 0;

    if (phase < 0.025) { phaseName = 'Новий місяць'; illumination = 0; }
    else if (phase < 0.25) { phaseName = 'Молодий місяць'; illumination = phase * 4 * 50; }
    else if (phase < 0.275) { phaseName = 'Перша чверть'; illumination = 50; }
    else if (phase < 0.5) { phaseName = 'Прибуваючий місяць'; illumination = 50 + (phase - 0.25) * 4 * 50; }
    else if (phase < 0.525) { phaseName = 'Повний місяць'; illumination = 100; }
    else if (phase < 0.75) { phaseName = 'Спадаючий місяць'; illumination = 100 - (phase - 0.5) * 4 * 50; }
    else if (phase < 0.775) { phaseName = 'Остання чверть'; illumination = 50; }
    else { phaseName = 'Старий місяць'; illumination = 50 - (phase - 0.75) * 4 * 50; }

    return { phaseName, age: age.toFixed(1), illumination: Math.max(0, Math.min(100, illumination)).toFixed(0), phase };
  };

  const moon = getMoonPhase(selectedDate);

  // Візуалізація фази місяця
  const renderMoonPhase = () => {
    const phase = moon.phase;
    const size = 120;

    // Визначаємо, яка частина місяця освітлена і з якого боку
    // phase: 0 = новий, 0.25 = перша чверть (права половина), 0.5 = повний, 0.75 = остання чверть (ліва половина)

    let lightSide; // 'right', 'left', або 'both'
    let shadowWidth; // 0 to 1

    if (phase < 0.5) {
      // Прибуваючий місяць - освітлена права сторона
      lightSide = 'right';
      shadowWidth = Math.abs(0.5 - phase * 2); // 0 при phase=0.25, 1 при phase=0 або 0.5
    } else {
      // Спадаючий місяць - освітлена ліва сторона
      lightSide = 'left';
      shadowWidth = Math.abs(0.5 - (phase - 0.5) * 2);
    }

    // Радіус "тіні" на освітленій частині (для молодого/старого місяця)
    const shadowRadius = shadowWidth * size / 2;

    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Темний диск (база) */}
        <circle
          cx={size/2}
          cy={size/2}
          r={size/2 - 2}
          fill="#1C1C1E"
        />

        {/* Освітлена частина */}
        {lightSide === 'right' && (
          <>
            {/* Права половина - світла */}
            <path
              d={`M ${size/2} ${2} A ${size/2 - 2} ${size/2 - 2} 0 0 1 ${size/2} ${size - 2} L ${size/2} ${2}`}
              fill="#F5F5DC"
            />
            {/* Тінь зправа (для молодого місяця) */}
            {shadowWidth > 0.05 && (
              <ellipse
                cx={size/2}
                cy={size/2}
                rx={shadowRadius}
                ry={size/2 - 2}
                fill="#1C1C1E"
              />
            )}
          </>
        )}

        {lightSide === 'left' && (
          <>
            {/* Ліва половина - світла */}
            <path
              d={`M ${size/2} ${2} A ${size/2 - 2} ${size/2 - 2} 0 0 0 ${size/2} ${size - 2} L ${size/2} ${2}`}
              fill="#F5F5DC"
            />
            {/* Тінь зліва (для старого місяця) */}
            {shadowWidth > 0.05 && (
              <ellipse
                cx={size/2}
                cy={size/2}
                rx={shadowRadius}
                ry={size/2 - 2}
                fill="#1C1C1E"
              />
            )}
          </>
        )}

        {/* Повний місяць */}
        {moon.illumination >= 98 && (
          <circle
            cx={size/2}
            cy={size/2}
            r={size/2 - 2}
            fill="#F5F5DC"
          />
        )}

        {/* Новий місяць (видимий обідок) */}
        {moon.illumination <= 2 && (
          <circle
            cx={size/2}
            cy={size/2}
            r={size/2 - 2}
            fill="none"
            stroke="#3A3A3C"
            strokeWidth={1}
          />
        )}
      </svg>
    );
  };

  const getMoonTimes = (phase) => {
    if (phase < 0.025 || phase > 0.975) return { rise: '—', set: '—' };
    if (phase < 0.25) return { rise: '09:00', set: '21:00' };
    if (phase < 0.275) return { rise: '12:00', set: '00:00' };
    if (phase < 0.5) return { rise: '15:00', set: '03:00' };
    if (phase < 0.525) return { rise: '18:00', set: '06:00' };
    if (phase < 0.75) return { rise: '21:00', set: '09:00' };
    if (phase < 0.775) return { rise: '00:00', set: '12:00' };
    return { rise: '03:00', set: '15:00' };
  };

  const d = selectedDate;
  const phaseNum = ((Math.floor(365.25 * (d.getFullYear() + 4716)) + Math.floor(30.6001 * ((d.getMonth() + 1) + 1)) + d.getDate() - 1524.5 - 2451550.1) / 29.530588853) % 1;
  const times = getMoonTimes(phaseNum);

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 16 }}>
        <label style={{
          display: 'block',
          fontSize: 13,
          fontWeight: 400,
          color: '#6B7280',
          marginBottom: 6,
        }}>Дата</label>
        <button
          onClick={() => setShowCalendar(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: '12px 14px',
            fontSize: 16,
            fontWeight: 400,
            color: '#111827',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: 10,
            cursor: 'pointer',
            boxSizing: 'border-box',
          }}
        >
          {formatDateUA(selectedDate)}
          <IoCalendarOutline size={20} color="#6B7280" />
        </button>
      </div>

      <div style={{ height: 1, backgroundColor: '#E5E7EB', margin: '20px 0' }} />

      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        {/* Візуалізація місяця */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: 16,
          padding: 20,
          backgroundColor: '#0A0A0A',
          borderRadius: 16,
        }}>
          {renderMoonPhase()}
        </div>

        <div style={{ fontSize: 22, color: '#111827', fontWeight: 400, marginBottom: 6 }}>
          {moon.phaseName}
        </div>
        <div style={{ fontSize: 14, color: '#6B7280' }}>
          {moon.illumination}% освітленості
        </div>
      </div>

      <ResultRow label="Вік місяця" value={`${moon.age} днів`} />
      <ResultRow label="Схід (орієнт.)" value={times.rise} />
      <ResultRow label="Захід (орієнт.)" value={times.set} />

      <div style={{
        fontSize: 12,
        color: '#9CA3AF',
        textAlign: 'center',
        marginTop: 20,
      }}>
        Час сходу/заходу є орієнтовним та залежить від широти.
      </div>

      {/* Calendar Modal */}
      {showCalendar && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
        }} onClick={() => setShowCalendar(false)}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            padding: 16,
            width: 320,
          }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 4,
            }}>
              <button onClick={prevMonth} style={{ border: 'none', background: 'none', padding: 8, cursor: 'pointer' }}>
                <IoChevronBackOutline size={24} color="#111827" />
              </button>
              <span style={{ fontSize: 20, fontWeight: 400, color: '#111827' }}>
                {calendarMonth.getFullYear()}
              </span>
              <button onClick={nextMonth} style={{ border: 'none', background: 'none', padding: 8, cursor: 'pointer' }}>
                <IoChevronForwardOutline size={24} color="#111827" />
              </button>
            </div>

            {/* Month name */}
            <div style={{
              fontSize: 16,
              fontWeight: 400,
              color: '#6B7280',
              textAlign: 'center',
              marginBottom: 16,
            }}>
              {MONTHS_UA[calendarMonth.getMonth()].charAt(0).toUpperCase() + MONTHS_UA[calendarMonth.getMonth()].slice(1)}
            </div>

            {/* Weekdays */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-around',
              marginBottom: 8,
            }}>
              {WEEKDAYS_UA.map((day, i) => (
                <span key={i} style={{
                  fontSize: 12,
                  fontWeight: 400,
                  color: '#9CA3AF',
                  width: 40,
                  textAlign: 'center',
                }}>{day}</span>
              ))}
            </div>

            {/* Days grid */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'flex-start',
            }}>
              {calendarDays.map((item, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (item.date) {
                      setSelectedDate(item.date);
                      setShowCalendar(false);
                    }
                  }}
                  disabled={!item.day}
                  style={{
                    width: 40,
                    height: 40,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 4,
                    border: 'none',
                    borderRadius: 20,
                    cursor: item.day ? 'pointer' : 'default',
                    fontSize: 15,
                    fontWeight: 400,
                    color: isSelectedDate(item.date) ? '#FFFFFF' : '#111827',
                    backgroundColor: isSelectedDate(item.date)
                      ? '#111827'
                      : isToday(item.date)
                        ? '#F3F4F6'
                        : 'transparent',
                  }}
                >
                  {item.day || ''}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════

function CalcButton({ value, onClick, type = 'num' }) {
  const bgColors = {
    num: '#4B5563',
    func: '#6B7280',
    op: '#374151',
  };
  const fontSizes = {
    num: 26,
    func: 20,
    op: 28,
  };

  return (
    <button
      onClick={onClick}
      style={{
        width: 64,
        height: 64,
        borderRadius: 32,
        border: 'none',
        background: bgColors[type],
        color: '#FFFFFF',
        fontSize: fontSizes[type],
        fontWeight: 400,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 0.1s',
      }}
      onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
      onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
    >
      {value}
    </button>
  );
}

function InputField({ label, value, onChange, placeholder }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: 'block',
        fontSize: 13,
        fontWeight: 400,
        color: '#6B7280',
        marginBottom: 6,
      }}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '12px 14px',
          fontSize: 16,
          fontWeight: 400,
          color: '#111827',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: 10,
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

function ResultRow({ label, value, highlight }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '10px 0',
    }}>
      <span style={{ fontSize: 15, fontWeight: 400, color: '#6B7280' }}>{label}</span>
      <span style={{
        fontSize: 17,
        fontWeight: 400,
        color: highlight ? '#111827' : '#111827',
      }}>{value}</span>
    </div>
  );
}
