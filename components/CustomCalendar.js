// components/CustomCalendar.js — Custom calendar matching app theme
import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Shadows, Spacing, FONT } from '../theme';

const DAYS_UA = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const MONTHS_UA = [
  'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень',
];

const CustomCalendar = ({ visible, value, onSelect, onClose }) => {
  const [viewDate, setViewDate] = useState(() => {
    const d = value instanceof Date && !isNaN(value) ? value : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  // Reset view when modal opens with new value
  React.useEffect(() => {
    if (visible && value instanceof Date && !isNaN(value)) {
      setViewDate({ year: value.getFullYear(), month: value.getMonth() });
    }
  }, [visible]);

  const today = useMemo(() => {
    const d = new Date();
    return { day: d.getDate(), month: d.getMonth(), year: d.getFullYear() };
  }, []);

  const selected = useMemo(() => {
    if (!(value instanceof Date) || isNaN(value)) return null;
    return { day: value.getDate(), month: value.getMonth(), year: value.getFullYear() };
  }, [value]);

  const days = useMemo(() => {
    const { year, month } = viewDate;
    const firstDay = new Date(year, month, 1).getDay();
    // Convert Sunday=0 to Monday-based: Mon=0, Sun=6
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells = [];

    // Previous month trailing days
    for (let i = startOffset - 1; i >= 0; i--) {
      cells.push({ day: daysInPrevMonth - i, current: false });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, current: true });
    }

    // Next month leading days (fill to complete 6 rows max)
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, current: false });
    }

    return cells;
  }, [viewDate]);

  const prevMonth = () => {
    setViewDate(prev => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { ...prev, month: prev.month - 1 };
    });
  };

  const nextMonth = () => {
    setViewDate(prev => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { ...prev, month: prev.month + 1 };
    });
  };

  const goToday = () => {
    setViewDate({ year: today.year, month: today.month });
  };

  const handleSelect = (cell) => {
    if (!cell.current) return;
    const d = new Date(viewDate.year, viewDate.month, cell.day);
    onSelect(d);
  };

  const isToday = (cell) =>
    cell.current &&
    cell.day === today.day &&
    viewDate.month === today.month &&
    viewDate.year === today.year;

  const isSelected = (cell) =>
    selected &&
    cell.current &&
    cell.day === selected.day &&
    viewDate.month === selected.month &&
    viewDate.year === selected.year;

  // Only show 5 or 6 rows depending on content
  const rowCount = days.length > 35 ? 6 : (days.slice(35).some(c => c.current) ? 6 : 5);
  const visibleDays = days.slice(0, rowCount * 7);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} style={styles.card}>
          {/* Header: month navigation */}
          <View style={styles.header}>
            <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
              <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>

            <TouchableOpacity onPress={goToday} style={styles.monthLabel}>
              <Text style={styles.monthText}>
                {MONTHS_UA[viewDate.month]} {viewDate.year}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
              <Ionicons name="chevron-forward" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Weekday headers */}
          <View style={styles.weekRow}>
            {DAYS_UA.map((d, i) => (
              <View key={i} style={styles.weekCell}>
                <Text style={[styles.weekText, i >= 5 && styles.weekTextWeekend]}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Days grid */}
          {Array.from({ length: rowCount }, (_, row) => (
            <View key={row} style={styles.dayRow}>
              {visibleDays.slice(row * 7, row * 7 + 7).map((cell, i) => {
                const sel = isSelected(cell);
                const tod = isToday(cell);
                return (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.dayCell,
                      sel && styles.dayCellSelected,
                      tod && !sel && styles.dayCellToday,
                    ]}
                    onPress={() => handleSelect(cell)}
                    disabled={!cell.current}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        !cell.current && styles.dayTextInactive,
                        sel && styles.dayTextSelected,
                        tod && !sel && styles.dayTextToday,
                      ]}
                    >
                      {cell.day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          {/* Bottom actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Скасувати</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.todayBtn}
              onPress={() => {
                onSelect(new Date());
              }}
            >
              <Text style={styles.todayText}>Сьогоднi</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const CELL_SIZE = 40;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: Colors.bgPrimary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 340,
    ...Shadows.large,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.round,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgTertiary,
  },
  monthLabel: {
    flex: 1,
    alignItems: 'center',
  },
  monthText: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '400',
    color: Colors.textPrimary,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  weekText: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '400',
    color: Colors.textSecondary,
  },
  weekTextWeekend: {
    color: Colors.error,
  },
  dayRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: CELL_SIZE,
    borderRadius: BorderRadius.round,
  },
  dayCellSelected: {
    backgroundColor: Colors.primary,
  },
  dayCellToday: {
    backgroundColor: Colors.bgTertiary,
  },
  dayText: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '400',
    color: Colors.textPrimary,
  },
  dayTextInactive: {
    color: Colors.textTertiary,
  },
  dayTextSelected: {
    color: Colors.textInverse,
  },
  dayTextToday: {
    color: Colors.primary,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    height: 42,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgTertiary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelText: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '400',
    color: Colors.textSecondary,
  },
  todayBtn: {
    flex: 1,
    height: 42,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  todayText: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '400',
    color: Colors.textInverse,
  },
});

export default CustomCalendar;
