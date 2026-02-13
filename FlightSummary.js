// FlightSummary.js — Підсумки польотів за період
import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthCtx } from './contexts';
import { supabase } from './supabase';
import { Colors, Shadows, BorderRadius, Spacing, FONT } from './theme';
import CustomCalendar from './components/CustomCalendar';
import ThemedAlert from './ThemedAlert';

// ─── Періоди ───

const PERIODS = [
  { key: 'this_month', label: 'Цей місяць' },
  { key: 'last_month', label: 'Мин. місяць' },
  { key: 'this_year', label: 'Цей рік' },
  { key: 'last_year', label: 'Мин. рік' },
  { key: 'custom', label: 'Період' },
];

// ─── Категорії польотів ───

const CATEGORIES = [
  { key: 'control', label: 'Контрольні польоти', icon: 'shield-checkmark-outline' },
  { key: 'training', label: 'Тренувальні польоти', icon: 'fitness-outline' },
  { key: 'crew', label: 'У складі екіпажу', icon: 'people-outline' },
  { key: 'test', label: 'На випробування', icon: 'flask-outline' },
];

// ─── Утиліти ───

function getDateRange(periodKey) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (periodKey) {
    case 'this_month':
      return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0) };
    case 'last_month':
      return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0) };
    case 'this_year':
      return { start: new Date(y, 0, 1), end: new Date(y, 11, 31) };
    case 'last_year':
      return { start: new Date(y - 1, 0, 1), end: new Date(y - 1, 11, 31) };
    default:
      return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0) };
  }
}

function toISO(d) {
  return d.toISOString().split('T')[0];
}

function fmtDate(d) {
  if (!d) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

/** interval "HH:MM:SS" → хвилини */
function parseMin(v) {
  if (!v) return 0;
  const m = String(v).trim().match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  return m ? (+m[1]) * 60 + (+m[2]) : 0;
}

/** хвилини → "HH:MM" */
function fmtMin(t) {
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Визначити категорію польоту */
function categorize(f) {
  if (f.flight_type === 'Випробувальний') return 'test';
  if (f.flight_type === 'У складі екіпажу') return 'crew';
  const exs = f.flight_exercises || [];
  return exs.some(fe => fe.exercises?.is_control === true) ? 'control' : 'training';
}

function emptyBucket() {
  return { count: 0, minutes: 0, topics: [] };
}

function emptyGroup() {
  return {
    control: emptyBucket(),
    training: emptyBucket(),
    crew: emptyBucket(),
    test: emptyBucket(),
  };
}

// ─── Компонент ───

export default function FlightSummary({ navigation }) {
  const { auth } = useContext(AuthCtx);
  const [period, setPeriod] = useState('this_month');
  const [menuOpen, setMenuOpen] = useState(false);
  const [customStart, setCustomStart] = useState(null);
  const [customEnd, setCustomEnd] = useState(null);
  const [calTarget, setCalTarget] = useState(null); // 'start' | 'end'
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const periodLabel = PERIODS.find(p => p.key === period)?.label || '';

  const load = useCallback(async () => {
    try {
      if (!auth?.pib) return;
      setLoading(true);

      const { data: u, error: ue } = await supabase
        .from('users').select('id').eq('name', auth.pib).single();
      if (ue || !u) throw new Error('Користувача не знайдено');

      let range;
      if (period === 'custom') {
        if (!customStart || !customEnd) { setData(null); return; }
        range = { start: customStart, end: customEnd };
      } else {
        range = getDateRange(period);
      }

      const { data: flights, error } = await supabase
        .from('flights')
        .select(`
          id, date, time_of_day, flight_type, flight_time, flights_count,
          test_flight_topic,
          flight_exercises(exercise_id, exercises(is_control))
        `)
        .eq('user_id', u.id)
        .gte('date', toISO(range.start))
        .lte('date', toISO(range.end))
        .order('date', { ascending: true });

      if (error) throw error;

      const result = { day: emptyGroup(), night: emptyGroup() };

      (flights || []).forEach(f => {
        const cat = categorize(f);
        const tod = f.time_of_day === 'Н' ? 'night' : 'day';
        const cnt = f.flights_count || 1;
        const mins = parseMin(f.flight_time);

        result[tod][cat].count += cnt;
        result[tod][cat].minutes += mins;

        if (cat === 'test' && f.test_flight_topic) {
          if (!result[tod][cat].topics.includes(f.test_flight_topic)) {
            result[tod][cat].topics.push(f.test_flight_topic);
          }
        }
      });

      setData(result);
    } catch (e) {
      ThemedAlert.alert('Помилка', String(e.message || e));
    } finally {
      setLoading(false);
    }
  }, [auth?.pib, period, customStart, customEnd]);

  useEffect(() => { load(); }, [load]);

  const onCalSelect = (date) => {
    if (calTarget === 'start') {
      setCustomStart(date);
      if (!customEnd || date > customEnd) setCustomEnd(date);
    } else {
      setCustomEnd(date);
    }
    setCalTarget(null);
  };

  // ─── Рендер секції (День / Ніч) ───

  const renderSection = (title, icon, group) => {
    const cats = CATEGORIES.filter(c => group[c.key].count > 0);
    if (cats.length === 0) return null;

    return (
      <View style={s.section}>
        <View style={s.sectionHead}>
          <Ionicons name={icon} size={16} color={Colors.textSecondary} />
          <Text style={s.sectionTitle}>{title}</Text>
        </View>
        {cats.map(c => renderCatRow(c, group[c.key]))}
      </View>
    );
  };

  // ─── Рядок категорії ───

  const renderCatRow = (cat, bucket) => (
    <View key={cat.key} style={s.catRow}>
      <View style={s.catHead}>
        <Ionicons name={cat.icon} size={14} color={Colors.textTertiary} />
        <Text style={s.catLabel}>{cat.label}</Text>
      </View>
      <View style={s.catStats}>
        <View style={s.statItem}>
          <Text style={s.statValue}>{bucket.count}</Text>
          <Text style={s.statLabel}>польотів</Text>
        </View>
        <View style={s.statItem}>
          <Text style={s.statValue}>{fmtMin(bucket.minutes)}</Text>
          <Text style={s.statLabel}>наліт</Text>
        </View>
      </View>
      {cat.key === 'test' && bucket.topics.length > 0 && (
        <View style={s.topicsWrap}>
          <Text style={s.topicsTitle}>Теми:</Text>
          {bucket.topics.map((t, i) => (
            <Text key={i} style={s.topicText}>{t}</Text>
          ))}
        </View>
      )}
    </View>
  );

  // ─── Рендер Всього ───

  const renderTotal = () => {
    if (!data) return null;

    const total = {};
    CATEGORIES.forEach(c => {
      total[c.key] = {
        count: data.day[c.key].count + data.night[c.key].count,
        minutes: data.day[c.key].minutes + data.night[c.key].minutes,
        topics: [...new Set([...data.day[c.key].topics, ...data.night[c.key].topics])],
      };
    });

    const cats = CATEGORIES.filter(c => total[c.key].count > 0);
    if (cats.length === 0) return null;

    const grandCount = cats.reduce((s, c) => s + total[c.key].count, 0);
    const grandMin = cats.reduce((s, c) => s + total[c.key].minutes, 0);

    return (
      <View style={s.section}>
        <View style={s.sectionHead}>
          <Ionicons name="stats-chart-outline" size={16} color={Colors.textSecondary} />
          <Text style={s.sectionTitle}>Всього за період</Text>
        </View>

        <View style={s.grandRow}>
          <View style={s.grandItem}>
            <Text style={s.grandValue}>{grandCount}</Text>
            <Text style={s.statLabel}>польотів</Text>
          </View>
          <View style={s.grandItem}>
            <Text style={s.grandValue}>{fmtMin(grandMin)}</Text>
            <Text style={s.statLabel}>наліт</Text>
          </View>
        </View>

        {cats.map(c => renderCatRow(c, total[c.key]))}
      </View>
    );
  };

  const hasDay = data && CATEGORIES.some(c => data.day[c.key].count > 0);
  const hasNight = data && CATEGORIES.some(c => data.night[c.key].count > 0);
  const hasAny = hasDay || hasNight;

  return (
    <View style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={s.backBtn}>
          <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Підсумки</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} colors={[Colors.primary]} tintColor={Colors.primary} />
        }
      >
        {/* Фільтр періоду — випадаюче меню */}
        <View style={s.filterWrap}>
          <TouchableOpacity style={s.select} activeOpacity={0.85} onPress={() => setMenuOpen(true)}>
            <Text style={s.selectText}>{periodLabel}</Text>
            <Ionicons name="chevron-down" size={16} color={Colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Вибір дат для кастомного періоду */}
        {period === 'custom' && (
          <View style={s.customRow}>
            <TouchableOpacity style={s.dateBtn} onPress={() => setCalTarget('start')} activeOpacity={0.7}>
              <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} />
              <Text style={s.dateBtnText}>{customStart ? fmtDate(customStart) : 'Від'}</Text>
            </TouchableOpacity>
            <Text style={s.dateSep}>—</Text>
            <TouchableOpacity style={s.dateBtn} onPress={() => setCalTarget('end')} activeOpacity={0.7}>
              <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} />
              <Text style={s.dateBtnText}>{customEnd ? fmtDate(customEnd) : 'До'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Завантаження */}
        {loading && !data && (
          <View style={s.emptyWrap}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}

        {/* Дані */}
        {data && hasAny && (
          <>
            {hasDay && renderSection('День', 'sunny-outline', data.day)}
            {hasNight && renderSection('Ніч', 'moon-outline', data.night)}
            {renderTotal()}
          </>
        )}

        {/* Порожньо */}
        {data && !hasAny && !loading && (
          <View style={s.emptyWrap}>
            <Ionicons name="airplane-outline" size={40} color={Colors.textTertiary} />
            <Text style={s.emptyText}>Немає польотів за цей період</Text>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Випадаюче меню періоду */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Період</Text>
            <FlatList
              data={PERIODS}
              keyExtractor={p => p.key}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => { setPeriod(item.key); setMenuOpen(false); }}
                  style={[s.optionRow, period === item.key && s.optionRowActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[s.optionText, period === item.key && s.optionTextActive]}>
                    {item.label}
                  </Text>
                  {period === item.key && (
                    <Ionicons name="checkmark" size={18} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={s.closeBtn} onPress={() => setMenuOpen(false)} activeOpacity={0.85}>
              <Text style={s.closeBtnText}>Закрити</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Календар */}
      <CustomCalendar
        visible={calTarget !== null}
        value={calTarget === 'start' ? customStart : customEnd}
        onSelect={onCalSelect}
        onClose={() => setCalTarget(null)}
      />
    </View>
  );
}

// ─── Стилі ───

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgTertiary,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.bgPrimary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.bgTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FONT,
    fontSize: 18,
    fontWeight: '400',
    color: Colors.textPrimary,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg },

  // Filter dropdown
  filterWrap: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.bgPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selectText: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '400',
    color: Colors.textPrimary,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: Colors.bgPrimary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    ...Shadows.large,
  },
  modalTitle: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '400',
    marginBottom: 10,
    color: Colors.textPrimary,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  optionRowActive: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: BorderRadius.sm,
  },
  optionText: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '400',
    color: Colors.textPrimary,
  },
  optionTextActive: {
    color: Colors.primary,
  },
  closeBtn: {
    marginTop: Spacing.sm,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgTertiary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  closeBtnText: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '400',
    color: Colors.textPrimary,
  },

  // Custom date range
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: Spacing.lg,
  },
  dateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.bgPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dateBtnText: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textPrimary,
  },
  dateSep: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '400',
    color: Colors.textTertiary,
  },

  // Section card
  section: {
    backgroundColor: Colors.bgPrimary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.small,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  sectionTitle: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '400',
    color: Colors.textPrimary,
  },

  // Category row
  catRow: {
    marginBottom: Spacing.md,
  },
  catHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  catLabel: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textSecondary,
  },
  catStats: {
    flexDirection: 'row',
    backgroundColor: Colors.bgSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.lg,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontFamily: FONT,
    fontSize: 17,
    fontWeight: '400',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  statLabel: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '400',
    color: Colors.textTertiary,
  },

  // Grand total
  grandRow: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  grandItem: {
    alignItems: 'center',
    flex: 1,
  },
  grandValue: {
    fontFamily: FONT,
    fontSize: 22,
    fontWeight: '400',
    color: Colors.textInverse,
    marginBottom: 2,
  },

  // Topics
  topicsWrap: {
    marginTop: 6,
    paddingLeft: 20,
  },
  topicsTitle: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '400',
    color: Colors.textTertiary,
    marginBottom: 2,
  },
  topicText: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '400',
    color: Colors.textPrimary,
    paddingVertical: 1,
  },

  // Empty
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 10,
  },
  emptyText: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '400',
    color: Colors.textTertiary,
  },
});
