// MyRecords.js
import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AuthCtx } from './App';
import api from './api';

const FONT = 'NewsCycle-Regular';
const DARK = '#333';
const LIGHT = '#fff';
const BORDER = '#E5E7EB';
const TEXT = '#111827';

const DarkButton = ({ title, onPress, style, leftIcon }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={[styles.btn, styles.btnDark, style]}>
    <Text style={styles.btnText}>{leftIcon ? leftIcon + ' ' : ''}{title}</Text>
  </TouchableOpacity>
);
const GrayButton = ({ title, onPress, style, leftIcon }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={[styles.btn, styles.btnGray, style]}>
    <Text style={styles.btnText}>{leftIcon ? leftIcon + ' ' : ''}{title}</Text>
  </TouchableOpacity>
);

/** Дата → DD.MM.YYYY (без часу) */
function parseDateToDDMMYYYY(v) {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return String(v);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  return `${dd}.${mm}.${yy}`;
}

/** "01.09.2025" -> 20250901 (для сортування) */
function dmyToNum(s) {
  const m = String(s || '').match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return 0;
  return Number(m[3] + m[2] + m[1]);
}

/** Витягнути тільки час HH:MM:SS з будь-якого значення */
function onlyTimeHHMMSS(v) {
  if (v == null) return '';

  // Якщо це Date або ISO — повертаємо тільки час (локальний)
  const maybeDate = v instanceof Date ? v : new Date(v);
  if (!isNaN(maybeDate.getTime())) {
    const hh = String(maybeDate.getHours()).padStart(2, '0');
    const mm = String(maybeDate.getMinutes()).padStart(2, '0');
    const ss = String(maybeDate.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  const s = String(v).trim();

  // ISO "....THH:MM:SS"
  const iso = s.match(/T(\d{2}):(\d{2}):(\d{2})/);
  if (iso) return `${iso[1]}:${iso[2]}:${iso[3]}`;

  // HH:MM[:SS]
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const hh = String(+m[1]).padStart(2, '0');
    const mm = String(+m[2]).padStart(2, '0');
    const ss = String(m[3] ? +m[3] : 0).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  // H.MM / H,MM (де друга частина — хвилини, НЕ десяткова)
  const s2 = s.replace(',', '.');
  const mHM = s2.match(/^(\d+)\.(\d{1,2})$/);
  if (mHM) {
    let hh = +mHM[1];
    let mm = +mHM[2];
    hh += Math.floor(mm / 60);
    mm = mm % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
  }

  // Просто число — години
  if (/^\d+$/.test(s2)) {
    const hh = +s2;
    return `${String(hh).padStart(2, '0')}:00:00`;
  }

  // Інакше — як є
  return s;
}

export default function MyRecords({ navigation }) {
  const { auth } = useContext(AuthCtx);
  const [items, setItems] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      if (!auth?.token) return;
      setLoading(true);
      const r = await api.rows(auth.token);
      if (!r?.ok) throw new Error(r?.error || 'Не вдалося завантажити записи');

      // Сортуємо: якщо дата як "DD.MM.YYYY" — dmyToNum, інакше Date
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
  useEffect(() => { load(); }, []); // підстраховка

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
    navigation.navigate('Main', { edit: { row: it._row, data: it } });
  };

  const renderItem = ({ item }) => {
    const titleLeft = isAdmin ? `${item['ПІБ'] || ''} · ` : '';
    const title = `${titleLeft}${parseDateToDDMMYYYY(item['Дата'])} · ${item['Тип ПС'] || ''}`;

    const pol = String(item['Польотів'] || '').trim();
    const bz = String(item['Бойових заст.'] || '').trim();
    const nalit = onlyTimeHHMMSS(item['Наліт']);
    const chas = String(item['Час доби МУ'] || '').trim();
    const vid = String(item['Вид пол.'] || item['Вид польоту'] || '').trim();
    const notes = String(item['Примітки'] || '').trim();

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{title}</Text>

        <Text style={styles.rowText}>
          <Text style={styles.muted}>Польотів: </Text>
          <Text style={styles.val}>{pol || '0'}</Text>
          <Text style={styles.muted}> | Наліт: </Text>
          <Text style={styles.val}>{nalit || '00:00:00'}</Text>
          <Text style={styles.muted}> | БЗ: </Text>
          <Text style={styles.val}>{bz || '0'}</Text>
        </Text>

        <Text style={styles.rowText}>
          <Text style={styles.muted}>Час доби: </Text>
          <Text style={styles.val}>{chas || '-'}</Text>
          <Text style={styles.muted}> | Вид польоту: </Text>
          <Text style={styles.val}>{vid || '-'}</Text>
        </Text>

        {!!notes && (
          <Text style={styles.rowText}>
            <Text style={styles.muted}>Досягнення: </Text>
            <Text style={styles.val}>{notes}</Text>
          </Text>
        )}

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
          <DarkButton title="Редагувати" leftIcon="✏️" onPress={() => onEdit(item)} style={{ flex: 1 }} />
          <GrayButton title="Видалити" leftIcon="🗑️" onPress={() => onDelete(item)} style={{ flex: 1 }} />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Мої записи</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.9} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Назад</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(it, idx) => String(it._row || idx)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} colors={[DARK]} tintColor={DARK} />
        }
        ListEmptyComponent={!loading ? (
          <Text style={[styles.muted, { paddingHorizontal: 16 }]}>Немає записів.</Text>
        ) : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F6F8' },

  header: {
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  title: { fontFamily: FONT, fontSize: 28, fontWeight: '800', color: TEXT },
  backBtn: {
    backgroundColor: DARK, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 8,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  backBtnText: { color: LIGHT, fontFamily: FONT, fontSize: 16, fontWeight: '700' },

  card: {
    backgroundColor: LIGHT, borderRadius: 16, padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: BORDER,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  cardTitle: { fontFamily: FONT, fontSize: 18, fontWeight: '800', color: TEXT, marginBottom: 8 },
  rowText: { fontFamily: FONT, fontSize: 16, color: TEXT, marginTop: 4 },
  muted: { fontFamily: FONT, fontSize: 16, color: '#6B7280' },
  val: { fontFamily: FONT, fontSize: 16, color: TEXT },

  btn: {
    height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  btnDark: { backgroundColor: DARK },
  btnGray: { backgroundColor: '#7B7B7B' },
  btnText: { color: LIGHT, fontFamily: FONT, fontSize: 18, fontWeight: '800' },
});
