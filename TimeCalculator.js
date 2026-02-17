// TimeCalculator.js — авіаційний калькулятор
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, SafeAreaView, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FONT, Spacing, BorderRadius } from './theme';

const g = 9.81; // прискорення вільного падіння

const MODES = [
  { key: 'time', label: 'Час', icon: 'time-outline' },
  { key: 'turn', label: 'Розворот', icon: 'sync-outline' },
  { key: 'tsd', label: 'TSD', icon: 'speedometer-outline' },
  { key: 'sun', label: 'Сонце', icon: 'sunny-outline' },
  { key: 'moon', label: 'Місяць', icon: 'moon-outline' },
];

export default function TimeCalculator({ visible, onClose }) {
  const [mode, setMode] = useState('time');
  const [showModeMenu, setShowModeMenu] = useState(false);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.modeSelector}
            onPress={() => setShowModeMenu(!showModeMenu)}
          >
            <Ionicons
              name={MODES.find(m => m.key === mode)?.icon}
              size={20}
              color={Colors.textPrimary}
            />
            <Text style={styles.headerTitle}>
              {MODES.find(m => m.key === mode)?.label}
            </Text>
            <Ionicons
              name={showModeMenu ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>

          <View style={styles.placeholder} />
        </View>

        {/* Mode menu dropdown */}
        {showModeMenu && (
          <View style={styles.modeMenu}>
            {MODES.map(m => (
              <TouchableOpacity
                key={m.key}
                style={[styles.modeMenuItem, mode === m.key && styles.modeMenuItemActive]}
                onPress={() => {
                  setMode(m.key);
                  setShowModeMenu(false);
                }}
              >
                <Ionicons
                  name={m.icon}
                  size={20}
                  color={mode === m.key ? Colors.primary : Colors.textSecondary}
                />
                <Text style={[
                  styles.modeMenuText,
                  mode === m.key && styles.modeMenuTextActive
                ]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Content */}
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {mode === 'time' && <TimeMode />}
          {mode === 'turn' && <TurnMode />}
          {mode === 'tsd' && <TSDMode />}
          {mode === 'sun' && <SunMode />}
          {mode === 'moon' && <MoonMode />}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════
// TIME MODE — калькулятор часу +/-
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

  const CalcBtn = ({ value, onPress, type = 'num' }) => (
    <TouchableOpacity
      style={[styles.calcBtn, type === 'func' && styles.calcBtnFunc, type === 'op' && styles.calcBtnOp]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.calcBtnText, type === 'func' && styles.calcBtnTextFunc]}>{value}</Text>
    </TouchableOpacity>
  );

  return (
    <View>
      <View style={styles.timeDisplay}>
        <Text style={styles.timeExpression}>{expression}</Text>
        <Text style={styles.timeValue}>{display}</Text>
      </View>

      <View style={styles.keypadCompact}>
        <View style={styles.keypadRow}>
          <CalcBtn value="C" onPress={handleClear} type="func" />
          <CalcBtn value="⌫" onPress={handleBackspace} type="func" />
          <CalcBtn value="+" onPress={() => handleOperator('+')} type="op" />
          <CalcBtn value="-" onPress={() => handleOperator('-')} type="op" />
        </View>
        <View style={styles.keypadRow}>
          <CalcBtn value="7" onPress={() => handleNumber('7')} />
          <CalcBtn value="8" onPress={() => handleNumber('8')} />
          <CalcBtn value="9" onPress={() => handleNumber('9')} />
          <CalcBtn value="=" onPress={calculate} type="op" />
        </View>
        <View style={styles.keypadRow}>
          <CalcBtn value="4" onPress={() => handleNumber('4')} />
          <CalcBtn value="5" onPress={() => handleNumber('5')} />
          <CalcBtn value="6" onPress={() => handleNumber('6')} />
          <View style={styles.calcBtnEmpty} />
        </View>
        <View style={styles.keypadRow}>
          <CalcBtn value="1" onPress={() => handleNumber('1')} />
          <CalcBtn value="2" onPress={() => handleNumber('2')} />
          <CalcBtn value="3" onPress={() => handleNumber('3')} />
          <View style={styles.calcBtnEmpty} />
        </View>
        <View style={styles.keypadRow}>
          <View style={styles.calcBtnEmpty} />
          <CalcBtn value="0" onPress={() => handleNumber('0')} />
          <View style={styles.calcBtnEmpty} />
          <View style={styles.calcBtnEmpty} />
        </View>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════
// TURN MODE — розворот, радіус, перевантаження
// ═══════════════════════════════════════════════════════════

function TurnMode() {
  const [tas, setTas] = useState('');
  const [bankAngle, setBankAngle] = useState('');
  const [turnAngle, setTurnAngle] = useState('360');

  const tasNum = parseFloat(tas) || 0;
  const bankNum = parseFloat(bankAngle) || 0;
  const turnNum = parseFloat(turnAngle) || 360;

  // V in m/s (TAS in km/h)
  const vMs = tasNum / 3.6;
  const bankRad = (bankNum * Math.PI) / 180;

  // Результати
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
    <View style={styles.modeContent}>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>TAS (км/год)</Text>
        <TextInput
          style={styles.input}
          value={tas}
          onChangeText={setTas}
          keyboardType="numeric"
          placeholder="500"
          placeholderTextColor={Colors.textTertiary}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Кут крену (°)</Text>
        <TextInput
          style={styles.input}
          value={bankAngle}
          onChangeText={setBankAngle}
          keyboardType="numeric"
          placeholder="30"
          placeholderTextColor={Colors.textTertiary}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Кут розвороту (°)</Text>
        <TextInput
          style={styles.input}
          value={turnAngle}
          onChangeText={setTurnAngle}
          keyboardType="numeric"
          placeholder="360"
          placeholderTextColor={Colors.textTertiary}
        />
      </View>

      <View style={styles.divider} />

      <View style={styles.resultRow}>
        <Text style={styles.resultLabel}>Час розвороту</Text>
        <Text style={styles.resultValue}>{formatTime(turnTime)}</Text>
      </View>

      <View style={styles.resultRow}>
        <Text style={styles.resultLabel}>Радіус віражу</Text>
        <Text style={styles.resultValue}>{formatDistance(turnRadius)}</Text>
      </View>

      <View style={styles.resultRow}>
        <Text style={styles.resultLabel}>Перевантаження</Text>
        <Text style={styles.resultValue}>{loadFactor > 1 ? `${loadFactor.toFixed(2)}g` : '—'}</Text>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════
// TSD MODE — час, швидкість, дальність
// ═══════════════════════════════════════════════════════════

function TSDMode() {
  const [time, setTime] = useState('');
  const [speed, setSpeed] = useState('');
  const [distance, setDistance] = useState('');

  // Автообчислення
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
    <View style={styles.modeContent}>
      <Text style={styles.modeHint}>Введіть будь-які два параметри:</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Час (хв)</Text>
        <TextInput
          style={styles.input}
          value={time}
          onChangeText={setTime}
          keyboardType="numeric"
          placeholder="30"
          placeholderTextColor={Colors.textTertiary}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Швидкість (км/год)</Text>
        <TextInput
          style={styles.input}
          value={speed}
          onChangeText={setSpeed}
          keyboardType="numeric"
          placeholder="500"
          placeholderTextColor={Colors.textTertiary}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Дальність (км)</Text>
        <TextInput
          style={styles.input}
          value={distance}
          onChangeText={setDistance}
          keyboardType="numeric"
          placeholder="250"
          placeholderTextColor={Colors.textTertiary}
        />
      </View>

      <View style={styles.divider} />

      {result ? (
        <View style={styles.resultHighlight}>
          <Text style={styles.resultLabelBig}>{resultLabel}</Text>
          <Text style={styles.resultValueBig}>{result}</Text>
        </View>
      ) : (
        <Text style={styles.resultPlaceholder}>Введіть два параметри</Text>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════
// SUN MODE — схід/захід сонця на висоті
// ═══════════════════════════════════════════════════════════

function SunMode() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const lat = 49; // Центральна Україна

  // Місяці українською
  const MONTHS_UA = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  const WEEKDAYS_UA = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

  // Форматування дати
  const formatDateUA = (d) => {
    return `${d.getDate()} ${MONTHS_UA[d.getMonth()]} ${d.getFullYear()}`;
  };

  // Розрахунок дня року
  const getDayOfYear = (d) => {
    const start = new Date(d.getFullYear(), 0, 0);
    const diff = d - start;
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
  };

  const dayOfYear = getDayOfYear(selectedDate);

  // Спрощений розрахунок сходу/заходу сонця
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

  // Генерація днів для календаря
  const generateCalendarDays = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Понеділок = 0
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;

    const days = [];

    // Порожні клітинки на початку
    for (let i = 0; i < startDay; i++) {
      days.push({ day: null, date: null });
    }

    // Дні місяця
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
    <View style={styles.modeContent}>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Дата</Text>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => setShowCalendar(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.dateButtonText}>{formatDateUA(selectedDate)}</Text>
          <Ionicons name="calendar-outline" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />

      <View style={styles.resultRow}>
        <Text style={styles.resultLabel}>Схід</Text>
        <Text style={styles.resultValueHighlight}>{sunTimes.sunrise}</Text>
      </View>

      <View style={styles.resultRow}>
        <Text style={styles.resultLabel}>Захід</Text>
        <Text style={styles.resultValueHighlight}>{sunTimes.sunset}</Text>
      </View>

      <View style={styles.resultRow}>
        <Text style={styles.resultLabel}>Тривалість дня</Text>
        <Text style={styles.resultValueHighlight}>{formatDayLength(sunTimes.dayLength)}</Text>
      </View>

      {/* Calendar Modal */}
      <Modal
        visible={showCalendar}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCalendar(false)}
      >
        <TouchableOpacity
          style={styles.calendarOverlay}
          activeOpacity={1}
          onPress={() => setShowCalendar(false)}
        >
          <View style={styles.calendarContainer} onStartShouldSetResponder={() => true}>
            {/* Header */}
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={prevMonth} style={styles.calendarNavBtn}>
                <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.calendarTitle}>
                {calendarMonth.getFullYear()}
              </Text>
              <TouchableOpacity onPress={nextMonth} style={styles.calendarNavBtn}>
                <Ionicons name="chevron-forward" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Month name */}
            <Text style={styles.calendarMonthName}>
              {MONTHS_UA[calendarMonth.getMonth()].charAt(0).toUpperCase() + MONTHS_UA[calendarMonth.getMonth()].slice(1)}
            </Text>

            {/* Weekdays */}
            <View style={styles.calendarWeekdays}>
              {WEEKDAYS_UA.map((day, i) => (
                <Text key={i} style={styles.calendarWeekday}>{day}</Text>
              ))}
            </View>

            {/* Days grid */}
            <View style={styles.calendarGrid}>
              {calendarDays.map((item, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.calendarDay,
                    item.day && styles.calendarDayActive,
                    isSelectedDate(item.date) && styles.calendarDaySelected,
                    isToday(item.date) && !isSelectedDate(item.date) && styles.calendarDayToday,
                  ]}
                  onPress={() => {
                    if (item.date) {
                      setSelectedDate(item.date);
                      setShowCalendar(false);
                    }
                  }}
                  disabled={!item.day}
                >
                  <Text style={[
                    styles.calendarDayText,
                    isSelectedDate(item.date) && styles.calendarDayTextSelected,
                  ]}>
                    {item.day || ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════
// MOON MODE — фаза та висота місяця
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

  // Розрахунок фази місяця
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

    let lightSide;
    let shadowWidth;

    if (phase < 0.5) {
      lightSide = 'right';
      shadowWidth = Math.abs(0.5 - phase * 2);
    } else {
      lightSide = 'left';
      shadowWidth = Math.abs(0.5 - (phase - 0.5) * 2);
    }

    const shadowRadius = shadowWidth * size / 2;

    // Створюємо SVG-подібний елемент за допомогою View
    return (
      <View style={[styles.moonVisual, { width: size, height: size, borderRadius: size / 2 }]}>
        {/* Темний диск (база) */}
        <View style={[styles.moonBase, { width: size - 4, height: size - 4, borderRadius: (size - 4) / 2 }]} />

        {/* Освітлена частина */}
        <View style={[
          styles.moonLight,
          {
            width: (size - 4) / 2,
            height: size - 4,
            borderRadius: (size - 4) / 2,
            left: lightSide === 'right' ? (size - 4) / 2 : 0,
          }
        ]} />

        {/* Тінь */}
        {shadowWidth > 0.05 && (
          <View style={[
            styles.moonShadow,
            {
              width: shadowRadius * 2,
              height: size - 4,
              borderRadius: (size - 4) / 2,
              left: lightSide === 'right' ? (size - 4) / 2 - shadowRadius : (size - 4) / 2 - shadowRadius,
            }
          ]} />
        )}

        {/* Повний місяць */}
        {moon.illumination >= 98 && (
          <View style={[styles.moonFull, { width: size - 4, height: size - 4, borderRadius: (size - 4) / 2 }]} />
        )}
      </View>
    );
  };

  // Час сходу/заходу (спрощено - варіюється залежно від фази)
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

  const times = getMoonTimes(moon.phase);

  return (
    <View style={styles.modeContent}>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Дата</Text>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => setShowCalendar(true)}
        >
          <Text style={styles.dateButtonText}>{formatDateUA(selectedDate)}</Text>
          <Ionicons name="calendar-outline" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />

      {/* Візуалізація місяця */}
      <View style={styles.moonVisualContainer}>
        {renderMoonPhase()}
      </View>

      <View style={styles.moonPhaseContainer}>
        <Text style={styles.moonPhaseName}>{moon.phaseName}</Text>
        <Text style={styles.moonIllumination}>{moon.illumination}% освітленості</Text>
      </View>

      <View style={styles.resultRow}>
        <Text style={styles.resultLabel}>Вік місяця</Text>
        <Text style={styles.resultValue}>{moon.age} днів</Text>
      </View>

      <View style={styles.resultRow}>
        <Text style={styles.resultLabel}>Схід (орієнт.)</Text>
        <Text style={styles.resultValue}>{times.rise}</Text>
      </View>

      <View style={styles.resultRow}>
        <Text style={styles.resultLabel}>Захід (орієнт.)</Text>
        <Text style={styles.resultValue}>{times.set}</Text>
      </View>

      <Text style={styles.modeNote}>
        Час сходу/заходу є орієнтовним та залежить від широти.
      </Text>

      {/* Calendar Modal */}
      <Modal
        visible={showCalendar}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCalendar(false)}
      >
        <TouchableOpacity
          style={styles.calendarOverlay}
          activeOpacity={1}
          onPress={() => setShowCalendar(false)}
        >
          <View style={styles.calendarContainer} onStartShouldSetResponder={() => true}>
            {/* Header */}
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={prevMonth} style={styles.calendarNavBtn}>
                <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
              <View style={styles.calendarTitleContainer}>
                <Text style={styles.calendarYear}>{calendarMonth.getFullYear()}</Text>
                <Text style={styles.calendarMonth}>
                  {MONTHS_UA[calendarMonth.getMonth()].charAt(0).toUpperCase() + MONTHS_UA[calendarMonth.getMonth()].slice(1)}
                </Text>
              </View>
              <TouchableOpacity onPress={nextMonth} style={styles.calendarNavBtn}>
                <Ionicons name="chevron-forward" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Weekdays */}
            <View style={styles.calendarWeekdays}>
              {WEEKDAYS_UA.map((day, i) => (
                <Text key={i} style={styles.calendarWeekday}>{day}</Text>
              ))}
            </View>

            {/* Days grid */}
            <View style={styles.calendarDays}>
              {calendarDays.map((item, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.calendarDay,
                    isSelectedDate(item.date) && styles.calendarDaySelected,
                    isToday(item.date) && !isSelectedDate(item.date) && styles.calendarDayToday,
                  ]}
                  onPress={() => {
                    if (item.date) {
                      setSelectedDate(item.date);
                      setShowCalendar(false);
                    }
                  }}
                  disabled={!item.day}
                >
                  <Text style={[
                    styles.calendarDayText,
                    isSelectedDate(item.date) && styles.calendarDayTextSelected,
                  ]}>
                    {item.day || ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════

const BTN_SIZE = 64;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgTertiary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.bgPrimary,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: Colors.bgTertiary,
  },
  modeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.bgTertiary,
  },
  headerTitle: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '400',
    color: Colors.textPrimary,
  },
  placeholder: {
    width: 40,
  },
  modeMenu: {
    position: 'absolute',
    top: 60,
    left: '50%',
    marginLeft: -80,
    width: 160,
    backgroundColor: Colors.bgPrimary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
    zIndex: 100,
  },
  modeMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modeMenuItemActive: {
    backgroundColor: Colors.bgTertiary,
  },
  modeMenuText: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '400',
    color: Colors.textSecondary,
  },
  modeMenuTextActive: {
    color: Colors.primary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },

  // Time mode
  timeDisplay: {
    backgroundColor: Colors.bgPrimary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  timeExpression: {
    fontFamily: FONT,
    fontSize: 18,
    fontWeight: '400',
    color: Colors.textTertiary,
    textAlign: 'right',
    marginBottom: 8,
    minHeight: 24,
  },
  timeValue: {
    fontFamily: FONT,
    fontSize: 52,
    fontWeight: '400',
    color: Colors.textPrimary,
    textAlign: 'right',
    letterSpacing: 2,
  },
  keypadCompact: {
    padding: Spacing.lg,
    gap: 10,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  calcBtn: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
    backgroundColor: '#4B5563',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calcBtnFunc: {
    backgroundColor: '#6B7280',
  },
  calcBtnOp: {
    backgroundColor: '#374151',
  },
  calcBtnText: {
    fontFamily: FONT,
    fontSize: 26,
    fontWeight: '400',
    color: '#FFFFFF',
  },
  calcBtnTextFunc: {
    fontSize: 20,
  },
  calcBtnEmpty: {
    width: BTN_SIZE,
    height: BTN_SIZE,
  },

  // Mode content
  modeContent: {
    padding: Spacing.lg,
  },
  modeHint: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textTertiary,
    marginBottom: Spacing.md,
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '400',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '400',
    color: Colors.textPrimary,
    backgroundColor: Colors.bgPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.lg,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  resultLabel: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '400',
    color: Colors.textSecondary,
  },
  resultValue: {
    fontFamily: FONT,
    fontSize: 17,
    fontWeight: '400',
    color: Colors.textPrimary,
  },
  resultValueHighlight: {
    fontFamily: FONT,
    fontSize: 17,
    fontWeight: '400',
    color: Colors.primary,
  },
  resultHighlight: {
    backgroundColor: Colors.bgPrimary,
    borderRadius: 12,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  resultLabelBig: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  resultValueBig: {
    fontFamily: FONT,
    fontSize: 28,
    fontWeight: '400',
    color: Colors.primary,
  },
  resultPlaceholder: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '400',
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: 20,
  },
  modeNote: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '400',
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },

  // Moon
  moonVisualContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    marginVertical: 8,
  },
  moonVisual: {
    position: 'relative',
    backgroundColor: '#1C1C1E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moonBase: {
    position: 'absolute',
    backgroundColor: '#1C1C1E',
  },
  moonLight: {
    position: 'absolute',
    backgroundColor: '#F5F5DC',
  },
  moonShadow: {
    position: 'absolute',
    backgroundColor: '#1C1C1E',
  },
  moonFull: {
    position: 'absolute',
    backgroundColor: '#F5F5DC',
  },
  moonPhaseContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  moonPhaseName: {
    fontFamily: FONT,
    fontSize: 22,
    fontWeight: '400',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  moonIllumination: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textSecondary,
  },

  // Date button
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dateButtonText: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '400',
    color: Colors.textPrimary,
  },

  // Calendar
  calendarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  calendarContainer: {
    backgroundColor: Colors.bgPrimary,
    borderRadius: 16,
    padding: 16,
    width: '100%',
    maxWidth: 340,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  calendarNavBtn: {
    padding: 8,
  },
  calendarTitle: {
    fontFamily: FONT,
    fontSize: 20,
    fontWeight: '400',
    color: Colors.textPrimary,
  },
  calendarTitleContainer: {
    alignItems: 'center',
  },
  calendarYear: {
    fontFamily: FONT,
    fontSize: 20,
    fontWeight: '400',
    color: Colors.textPrimary,
  },
  calendarMonth: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '400',
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  calendarMonthName: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '400',
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  calendarWeekdays: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  calendarWeekday: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '400',
    color: Colors.textTertiary,
    width: 40,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  calendarDays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  calendarDay: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  calendarDayActive: {
    // active day
  },
  calendarDaySelected: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
  },
  calendarDayToday: {
    backgroundColor: Colors.bgTertiary,
    borderRadius: 20,
  },
  calendarDayText: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '400',
    color: Colors.textPrimary,
  },
  calendarDayTextSelected: {
    color: Colors.textInverse,
  },
});
