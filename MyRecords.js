// MyRecords.js
import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { AuthCtx } from './contexts';
import { supabase } from './supabase';
import { Colors, Shadows, BorderRadius, Spacing, FONT } from './theme';
import { TabNavigationContext } from './FixedTabNavigator';

/** Дата ISO → DD.MM.YYYY */
function formatDate(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  return `${dd}.${mm}.${yy}`;
}

/** interval string "01:30:00" → "01:30" */
function formatFlightTime(v) {
  if (!v) return '';
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m) return `${String(+m[1]).padStart(2, '0')}:${m[2]}`;
  return s;
}

/** Рядок деталі */
function DetailRow({ icon, label, value }) {
  if (!value || value === '-' || value === '0' || value === '00:00') return null;
  return (
    <View style={s.detailRow}>
      <Ionicons name={icon} size={14} color={Colors.textTertiary} />
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={s.detailValue}>{value}</Text>
    </View>
  );
}

export default function MyRecords({ navigation }) {
  const { auth } = useContext(AuthCtx);
  const { tabNavigate } = useContext(TabNavigationContext);
  const [items, setItems] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      if (!auth?.pib) return;
      setLoading(true);

      // Знайти user_id
      const { data: userData, error: userErr } = await supabase
        .from('users').select('id').eq('name', auth.pib).single();
      if (userErr || !userData) throw new Error('Користувача не знайдено');

      const admin = auth?.role === 'admin';
      setIsAdmin(admin);

      // Завантажити польоти з Supabase
      let query = supabase
        .from('flights')
        .select(`
          id, date, aircraft_type_id, time_of_day, weather_conditions,
          flight_type, test_flight_topic, document_source, flight_time,
          combat_applications, flight_purpose, notes, flights_count,
          aircraft_types(name),
          fuel_records(airfield, fuel_amount),
          users!flights_user_id_fkey(name)
        `)
        .order('date', { ascending: false });

      if (!admin) {
        query = query.eq('user_id', userData.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setItems(data || []);
    } catch (e) {
      Alert.alert('Помилка', String(e.message || e));
    } finally {
      setLoading(false);
    }
  }, [auth?.pib, auth?.role]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { load(); }, []);

  const onDelete = (it) => {
    Alert.alert('Видалити запис', 'Підтвердити видалення?', [
      { text: 'Скасувати' },
      {
        text: 'Видалити',
        style: 'destructive',
        onPress: async () => {
          try {
            // Видалити пов'язані записи
            await supabase.from('flight_exercises').delete().eq('flight_id', it.id);
            await supabase.from('fuel_records').delete().eq('flight_id', it.id);
            await supabase.from('flight_updates_log').delete().eq('flight_id', it.id);
            // Видалити сам політ
            const { error } = await supabase.from('flights').delete().eq('id', it.id);
            if (error) throw error;
            await load();
          } catch (e) {
            Alert.alert('Помилка', String(e.message || e));
          }
        },
      },
    ]);
  };

  const onEdit = (it) => {
    tabNavigate('Main', undefined, { edit: { id: it.id, data: it } });
  };

  const renderItem = ({ item }) => {
    const date = formatDate(item.date);
    const typePs = item.aircraft_types?.name || '';
    const pib = isAdmin ? (item.users?.name || '') : '';
    const nalit = formatFlightTime(item.flight_time);
    const pol = String(item.flights_count || '');
    const bz = String(item.combat_applications || '');
    const chas = (item.time_of_day || '') + (item.weather_conditions || '');
    const vid = item.flight_type || '';
    const notes = item.notes || '';
    const docSource = item.document_source || '';
    const flightPurpose = item.flight_purpose || '';
    const testTopic = item.test_flight_topic || '';
    const fuel = item.fuel_records?.[0];
    const fuelText = fuel
      ? (fuel.airfield && fuel.fuel_amount
          ? `${fuel.airfield} — ${fuel.fuel_amount} кг`
          : fuel.fuel_amount ? `${fuel.fuel_amount} кг` : '')
      : '';

    return (
      <View style={s.card}>
        {/* Шапка картки */}
        <View style={s.cardHeader}>
          <View style={s.cardHeaderLeft}>
            <View style={s.dateBadge}>
              <Text style={s.dateBadgeText}>{date}</Text>
            </View>
            {!!typePs && <Text style={s.typeText}>{typePs}</Text>}
          </View>
          {!!pib && <Text style={s.pibText}>{pib}</Text>}
        </View>

        {/* Основні числа */}
        <View style={s.statsRow}>
          <View style={s.statItem}>
            <Text style={s.statValue}>{nalit || '00:00'}</Text>
            <Text style={s.statLabel}>Наліт</Text>
          </View>
          {!!pol && pol !== '0' && (
            <View style={s.statItem}>
              <Text style={s.statValue}>{pol}</Text>
              <Text style={s.statLabel}>Польотів</Text>
            </View>
          )}
          {!!bz && bz !== '0' && (
            <View style={s.statItem}>
              <Text style={s.statValue}>{bz}</Text>
              <Text style={s.statLabel}>Бой. заст.</Text>
            </View>
          )}
        </View>

        {/* Деталі — з'являються якщо заповнені */}
        <View style={s.detailsBlock}>
          <DetailRow icon="sunny-outline" label="Час доби МУ" value={chas} />
          <DetailRow icon="navigate-outline" label="Вид польоту" value={vid} />
          <DetailRow icon="book-outline" label="Згідно чого" value={docSource} />
          <DetailRow icon="flag-outline" label="Мета польоту" value={flightPurpose} />
          <DetailRow icon="flask-outline" label="Тема випробування" value={testTopic} />
          <DetailRow icon="flame-outline" label="Паливо" value={fuelText} />
          <DetailRow icon="ribbon-outline" label="Досягнення" value={notes} />
        </View>

        {/* Кнопки */}
        <View style={s.actions}>
          <TouchableOpacity onPress={() => onEdit(item)} activeOpacity={0.7} style={s.actionBtn}>
            <Ionicons name="create-outline" size={16} color={Colors.textSecondary} />
            <Text style={s.actionText}>Редагувати</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete(item)} activeOpacity={0.7} style={s.actionBtn}>
            <Ionicons name="trash-outline" size={16} color={Colors.error} />
            <Text style={[s.actionText, { color: Colors.error }]}>Видалити</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={s.backBtn}>
          <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Мої записи</Text>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        contentContainerStyle={s.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} colors={[Colors.primary]} tintColor={Colors.primary} />
        }
        ListEmptyComponent={!loading ? (
          <View style={s.emptyWrap}>
            <Ionicons name="document-text-outline" size={40} color={Colors.textTertiary} />
            <Text style={s.emptyText}>Немає записів</Text>
          </View>
        ) : null}
      />
    </View>
  );
}

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
  title: {
    fontFamily: FONT,
    fontSize: 18,
    fontWeight: '400',
    color: Colors.textPrimary,
  },

  // List
  list: {
    padding: Spacing.lg,
    paddingBottom: 32,
  },

  // Card
  card: {
    backgroundColor: Colors.bgPrimary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.small,
  },

  // Card header
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dateBadgeText: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '400',
    color: Colors.textInverse,
  },
  typeText: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '400',
    color: Colors.textPrimary,
  },
  pibText: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '400',
    color: Colors.textSecondary,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.bgSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.lg,
    marginBottom: Spacing.md,
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

  // Details
  detailsBlock: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingVertical: 2,
  },
  detailLabel: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '400',
    color: Colors.textTertiary,
    width: 120,
  },
  detailValue: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '400',
    color: Colors.textPrimary,
    flex: 1,
  },

  // Actions
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.lg,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderLight,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  actionText: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '400',
    color: Colors.textSecondary,
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
