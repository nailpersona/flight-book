// MyRecords.js
import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { AuthCtx } from './contexts';
import api from './api';
import { Colors, Shadows, BorderRadius, Spacing, FONT } from './theme';
import { TabNavigationContext } from './FixedTabNavigator';

/** Дата → DD.MM.YYYY */
function parseDateToDDMMYYYY(v) {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return String(v);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  return `${dd}.${mm}.${yy}`;
}

/** "01.09.2025" -> 20250901 */
function dmyToNum(s) {
  const m = String(s || '').match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return 0;
  return Number(m[3] + m[2] + m[1]);
}

/** Витягнути тільки час HH:MM:SS */
function onlyTimeHHMMSS(v) {
  if (v == null) return '';
  const maybeDate = v instanceof Date ? v : new Date(v);
  if (!isNaN(maybeDate.getTime())) {
    const hh = String(maybeDate.getHours()).padStart(2, '0');
    const mm = String(maybeDate.getMinutes()).padStart(2, '0');
    const ss = String(maybeDate.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
  const s = String(v).trim();
  const iso = s.match(/T(\d{2}):(\d{2}):(\d{2})/);
  if (iso) return `${iso[1]}:${iso[2]}:${iso[3]}`;
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const hh = String(+m[1]).padStart(2, '0');
    const mm = String(+m[2]).padStart(2, '0');
    const ss = String(m[3] ? +m[3] : 0).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
  const s2 = s.replace(',', '.');
  const mHM = s2.match(/^(\d+)\.(\d{1,2})$/);
  if (mHM) {
    let hh = +mHM[1], mm = +mHM[2];
    hh += Math.floor(mm / 60); mm = mm % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
  }
  if (/^\d+$/.test(s2)) return `${String(+s2).padStart(2, '0')}:00:00`;
  return s;
}

/** Рядок деталі */
function DetailRow({ icon, label, value }) {
  if (!value || value === '-' || value === '0' || value === '00:00:00') return null;
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
      if (!auth?.token) return;
      setLoading(true);
      const r = await api.rows(auth.token);
      if (!r?.ok) throw new Error(r?.error || 'Не вдалося завантажити записи');

      const sorted = [...(r.items || [])].sort((a, b) => {
        const aD = a['Дата'], bD = b['Дата'];
        const aNum = dmyToNum(aD);
        const bNum = dmyToNum(bD);
        if (aNum && bNum) return bNum - aNum;
        const da = new Date(aD).getTime() || 0;
        const db = new Date(bD).getTime() || 0;
        return db - da;
      });

      setItems(sorted);
      setIsAdmin(r.role === 'admin');
    } catch (e) {
      Alert.alert('Помилка', String(e.message || e));
    } finally {
      setLoading(false);
    }
  }, [auth?.token]);

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
            if (!auth?.token) throw new Error('Немає токена');
            if (!it?._row) throw new Error('Немає індексу рядка');
            const r = await api.deleteRow(auth.token, it._row);
            if (!r?.ok) throw new Error(r?.error || 'Не вдалося видалити');
            await load();
          } catch (e) {
            Alert.alert('Помилка', String(e.message || e));
          }
        },
      },
    ]);
  };

  const onEdit = (it) => {
    tabNavigate('Main', undefined, { edit: { row: it._row, data: it } });
  };

  const renderItem = ({ item }) => {
    const date = parseDateToDDMMYYYY(item['Дата']);
    const typePs = String(item['Тип ПС'] || '').trim();
    const pib = isAdmin ? String(item['ПІБ'] || '').trim() : '';
    const nalitFull = onlyTimeHHMMSS(item['Наліт']);
    const nalit = nalitFull ? nalitFull.replace(/:(\d{2})$/, '') : '';
    const pol = String(item['Польотів'] || '').trim();
    const bz = String(item['Бойових заст.'] || '').trim();
    const chas = String(item['Час доби МУ'] || '').trim();
    const vid = String(item['Вид пол.'] || item['Вид польоту'] || '').trim();
    const notes = String(item['Примітки'] || '').trim();
    const docSource = String(item['Згідно чого'] || item['document_source'] || '').trim();
    const flightPurpose = String(item['Мета польоту'] || item['flight_purpose'] || '').trim();
    const testTopic = String(item['Тема випробування'] || item['test_flight_topic'] || '').trim();
    const fuelAirfield = String(item['Аеродром палива'] || item['fuel_airfield'] || '').trim();
    const fuelAmount = String(item['Паливо'] || item['fuel_amount'] || '').trim();
    const fuelText = fuelAirfield && fuelAmount ? `${fuelAirfield} — ${fuelAmount} кг` : fuelAmount ? `${fuelAmount} кг` : '';

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
        keyExtractor={(it, idx) => String(it._row || idx)}
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
