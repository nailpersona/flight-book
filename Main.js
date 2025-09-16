// Main.js
import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Alert, ScrollView,
  ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView,
  Modal, FlatList,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AuthCtx } from './App';
import api from './api';

const FONT = 'NewsCycle-Regular';
const DARK = '#333333';
const DARK_TXT = '#ffffff';
const SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.18,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
};

/** Службові */
function ddmmyyyy(d) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

/** Витягти ТІЛЬКИ ЧАС із будь-якого значення, завжди HH:MM:SS */
function onlyTimeHHMMSS(v) {
  if (v == null) return '00:00:00';

  const tryDate = (val) => {
    const d = val instanceof Date ? val : new Date(val);
    if (!isNaN(d.getTime())) {
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      return `${hh}:${mm}:${ss}`;
    }
    return null;
  };
  const d1 = tryDate(v);
  if (d1) return d1;

  const s = String(v).trim();
  const iso = s.match(/T(\d{2}):(\d{2}):(\d{2})/);
  if (iso) return `${iso[1]}:${iso[2]}:${iso[3]}`;

  const any = s.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/);
  if (any) {
    const hh = String(+any[1]).padStart(2, '0');
    const mm = String(+any[2]).padStart(2, '0');
    const ss = String(any[3] ? +any[3] : 0).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  return s;
}

/** ПЕРЕТВОРЕННЯ ВВЕДЕННЯ «Наліт» → HH:MM:SS
 *  Правило: H.MM/ H,MM = години.хвилини (а не десяткова частка!)
 *  Приклади: 1.11 → 01:11:00, 1.5 → 01:05:00, 2 → 02:00:00.
 */
function toHhMmSs(input) {
  if (input == null) return '00:00:00';
  const sRaw = String(input).trim();
  if (!sRaw) return '00:00:00';

  // 1) Якщо це вже час "HH:MM" або "HH:MM:SS" — нормалізуємо і повертаємо
  const mClock = sRaw.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (mClock) {
    let hh = +mClock[1], mm = +mClock[2], ss = +(mClock[3] || 0);
    // нормалізація переносу, якщо хтось ввів 01:75
    hh += Math.floor(mm / 60); mm = mm % 60;
    hh += Math.floor(ss / 3600); ss = ss % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }

  // 2) H.MM або H,MM — трактуємо як години.хвилини (мінутна частина, НЕ десяткова)
  const s = sRaw.replace(',', '.');
  const mHM = s.match(/^(\d+)\.(\d{1,2})$/);
  if (mHM) {
    let hh = +mHM[1];
    let mm = +mHM[2];               // 5 → 5 хв, 05 → 5 хв, 50 → 50 хв
    hh += Math.floor(mm / 60);      // на всяк випадок якщо 75 → +1 год
    mm = mm % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
  }

  // 3) Чисте ціле число — це години
  if (/^\d+$/.test(s)) {
    const hh = +s;
    return `${String(hh).padStart(2, '0')}:00:00`;
  }

  // 4) Якщо прийшов ISO/дата-час — беремо лише час
  return onlyTimeHHMMSS(sRaw);
}

/** Кнопки */
const DarkButton = ({ title, onPress, style }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={[styles.btn, styles.btnDark, style]}>
    <Text style={styles.btnText}>{title}</Text>
  </TouchableOpacity>
);
const GrayButton = ({ title, onPress, style }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={[styles.btn, styles.btnGray, style]}>
    <Text style={styles.btnText}>{title}</Text>
  </TouchableOpacity>
);

/** Простий Combo без пошуку */
function Combo({ label, value, onChange, options = [], placeholder = '— Оберіть —' }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: 12 }}>
      {!!label && <Text style={styles.label}>{label}</Text>}

      <TouchableOpacity style={[styles.input, styles.select]} activeOpacity={0.88} onPress={() => setOpen(true)}>
        <Text style={[styles.inputText, { color: value ? '#111827' : '#9CA3AF' }]}>{value || placeholder}</Text>
        <Text style={styles.selectCaret}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{label}</Text>

            <FlatList
              data={options}
              keyExtractor={(item, idx) => item + '_' + idx}
              style={{ maxHeight: 340 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => { onChange(item); setOpen(false); }}
                  style={styles.optionRow}
                >
                  <Text style={styles.optionText}>{item}</Text>
                </TouchableOpacity>
              )}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <GrayButton title="Закрити" onPress={() => setOpen(false)} style={{ flex: 1 }} />
              <DarkButton title="ОК" onPress={() => setOpen(false)} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/** Мультивибір для Досягнень (через кому) */
function Achievements({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const addItem = (s) => {
    const base = (value || '').trim();
    const parts = base ? base.split(',').map(v => v.trim()).filter(Boolean) : [];
    if (!parts.includes(s)) parts.push(s);
    onChange(parts.join(', '));
  };

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>Досягнення</Text>

      <TouchableOpacity style={[styles.input, styles.select]} activeOpacity={0.88} onPress={() => setOpen(true)}>
        <Text style={[styles.inputText, { color: value ? '#111827' : '#9CA3AF' }]}>
          {value || 'Чого досягнув'}
        </Text>
        <Text style={styles.selectCaret}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Досягнення</Text>

            <FlatList
              data={options}
              keyExtractor={(item, idx) => item + '_' + idx}
              style={{ maxHeight: 340 }}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => addItem(item)} style={styles.optionRow}>
                  <Text style={styles.optionText}>{item}</Text>
                </TouchableOpacity>
              )}
            />

            <View style={{ gap: 6 }}>
              <Text style={[styles.label, { marginTop: 6 }]}>Обране:</Text>
              <TextInput
                style={[styles.input, styles.inputText]}
                placeholder="Чого досягнув"
                value={value}
                onChangeText={onChange}
                multiline
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <GrayButton title="Закрити" onPress={() => setOpen(false)} style={{ flex: 1 }} />
              <DarkButton title="ОК" onPress={() => setOpen(false)} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function Main({ route, navigation }) {
  const { auth } = useContext(AuthCtx);
  const isAdmin = auth?.role === 'admin';

  const [submitting, setSubmitting] = useState(false);
  const [loadingLists, setLoadingLists] = useState(true);
  const [dynamicOptions, setDynamicOptions] = useState({});

  const [dateObj, setDateObj] = useState(new Date());
  const [date, setDate] = useState(ddmmyyyy(new Date()));
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Поля форми
  const [typePs, setTypePs] = useState('');
  const [timeOfDay, setTimeOfDay] = useState('');
  const [kindPol, setKindPol] = useState('');
  const [flights, setFlights] = useState('');
  const [nalit, setNalit] = useState('');
  const [boi, setBoi] = useState('');
  const [notes, setNotes] = useState('');

  // для редагування існуючого рядка
  const [editRow, setEditRow] = useState(null);

  // ВИПРАВЛЕНЕ завантаження динамічних списків
  useEffect(() => {
    const loadDynamicLists = async () => {
      try {
        setLoadingLists(true);
        const result = await api.lists(); // Використовуємо api.lists() замість getDynamicLists()
        console.log('Завантажені списки з API:', result);
        
        if (result?.ok && result.lists) {
          console.log('Список "Вид пол.":', result.lists['Вид пол.']);
          setDynamicOptions(result.lists);
        } else {
          throw new Error('Не вдалося завантажити списки з API');
        }
      } catch (error) {
        console.warn('Fallback до статичних списків:', error);
        // ВИПРАВЛЕНИЙ Fallback до статичних списків з правильними ключами
        setDynamicOptions({
          'Тип ПС': ['Су-27', 'МіГ-29', 'Ми-8', 'Л-39', 'Су-24'],
          'Час доби МУ': ['ДПМУ', 'ДСМУ', 'ДВМП', 'НПМУ', 'НСМУ', 'НВМП'],
          'Вид пол.': ['Бойовий', 'Випробувальний', 'Учбово-тренув.', 'За методиками'], // ✅ Виправлено
          'Примітки': [
            'Вивід з-під удару', 'Складний пілотаж', 'Мала висота', 'Гр. мала висота (ОНБ)',
            'Бойове застосування', 'Групова злітаність', 'На десантування',
          ],
        });
      } finally {
        setLoadingLists(false);
      }
    };

    loadDynamicLists();
  }, []);

  // якщо прийшли з MyRecords для редагування
  useEffect(() => {
    const edit = route.params?.edit;
    if (edit && edit.data) {
      const d = edit.data;
      setEditRow(edit.row || d._row || null);

      const parsed = new Date(d['Дата']);
      const dObj = isNaN(parsed.getTime()) ? new Date() : parsed;
      setDateObj(dObj);
      setDate(ddmmyyyy(dObj));

      setTypePs(String(d['Тип ПС'] || ''));
      setTimeOfDay(String(d['Час доби МУ'] || ''));
      const vid = String(d['Вид пол.'] || d['Вид польоту'] || '');
      setKindPol(vid);
      setFlights(String(d['Польотів'] || ''));

      // беремо лише час (навіть якщо в таблиці це дата-час)
      setNalit(onlyTimeHHMMSS(d['Наліт']));

      setBoi(String(d['Бойових заст.'] || ''));
      setNotes(String(d['Примітки'] || ''));
    }
  }, [route.params?.edit]);

  const resetForm = () => {
    const now = new Date();
    setDateObj(now); setDate(ddmmyyyy(now));
    setTypePs(''); setTimeOfDay(''); setKindPol('');
    setFlights(''); setNalit(''); setBoi(''); setNotes('');
    setEditRow(null);
  };

  const onChangeDate = (event, selectedDate) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selectedDate) {
      setDateObj(selectedDate);
      setDate(ddmmyyyy(selectedDate));
    }
  };

  const submit = async () => {
    if (!auth?.token) return Alert.alert('Помилка', 'Немає токена сесії');
    if (!date) return Alert.alert('Увага', 'Вкажи дату');
    if (!typePs) return Alert.alert('Увага', 'Вкажи Тип ПС');
    if (!timeOfDay) return Alert.alert('Увага', 'Вкажи Час доби МУ');
    if (!kindPol) return Alert.alert('Увага', 'Вкажи Вид польоту');

    try {
      setSubmitting(true);
      const payload = {
        'Дата': date,
        'Тип ПС': typePs,
        'Час доби МУ': timeOfDay,
        'Вид пол.': kindPol,
        'Польотів': (flights || '').toString().trim(),
        'Наліт': toHhMmSs(nalit || ''),         // ТУТ новий конвертер
        'Бойових заст.': (boi || '').toString().trim(),
        'Примітки': (notes || '').toString().trim(),
      };

      let j;
      if (editRow) j = await api.updateRow(auth.token, editRow, payload);
      else j = await api.add(auth.token, payload);

      if (!j?.ok) throw new Error(j?.error || 'Помилка збереження');
      Alert.alert('Готово', editRow ? 'Запис оновлено' : 'Запис додано');
      resetForm();
    } catch (err) {
      Alert.alert('Помилка', String(err.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  // Показуємо індикатор завантаження списків
  if (loadingLists) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F5F9' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={DARK} />
          <Text style={{ marginTop: 10, fontFamily: FONT, fontSize: 16, color: '#111827' }}>
            Завантаження довідників...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F5F9' }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Топбар */}
        <View style={[styles.topBar, { paddingTop: 14, marginTop: 16 }]}>
          <View>
            <Text style={styles.roleName}>{auth?.pib || ''}</Text>
            <Text style={styles.roleText}>Роль: {isAdmin ? 'admin' : 'user'}</Text>
          </View>
          <DarkButton title="ПРОФІЛЬ" onPress={() => navigation.navigate('Profile')} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Ряд 1 */}
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Дата</Text>
              <TouchableOpacity style={[styles.input, styles.dateBtn]} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.dateText}>{date || 'Оберіть дату'}</Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker value={dateObj} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} onChange={onChangeDate}/>
              )}
            </View>

            <View style={styles.col}>
              <Combo 
                label="Тип ПС" 
                value={typePs} 
                onChange={setTypePs} 
                options={dynamicOptions['Тип ПС'] || []} 
              />
            </View>
          </View>

          {/* Ряд 2 */}
          <View style={styles.row}>
            <View style={styles.col}>
              <Combo 
                label="Час доби МУ" 
                value={timeOfDay} 
                onChange={setTimeOfDay} 
                options={dynamicOptions['Час доби МУ'] || []} 
              />
            </View>
            <View style={styles.col}>
              <Combo 
                label="Вид польоту" 
                value={kindPol} 
                onChange={setKindPol} 
                options={dynamicOptions['Вид пол.'] || []} // ✅ ВИПРАВЛЕНО: використовуємо правильний ключ
              />
            </View>
          </View>

          {/* Ряд 3 */}
          <View style={styles.row3}>
            <View style={styles.col3}>
              <Text style={styles.label}>Польотів</Text>
              <TextInput style={[styles.input, styles.inputText]} placeholder="К-сть пол." value={flights} onChangeText={setFlights} keyboardType="numeric"/>
            </View>
            <View style={styles.col3}>
              <Text style={styles.label}>Наліт</Text>
              <TextInput
                style={[styles.input, styles.inputText]}
                placeholder="Год.Хв"
                value={nalit}
                onChangeText={setNalit}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.col3}>
              <Text style={styles.label}>Бойових заст.</Text>
              <TextInput style={[styles.input, styles.inputText]} placeholder="К-сть БЗ" value={boi} onChangeText={setBoi} keyboardType="numeric"/>
            </View>
          </View>

          {/* Досягнення */}
          <Achievements 
            value={notes} 
            onChange={setNotes} 
            options={dynamicOptions['Примітки'] || []} 
          />

          {/* Зберегти */}
          <DarkButton
            title={editRow ? 'ОНОВИТИ' : 'ДОДАТИ'}
            onPress={submit}
            style={{ marginTop: 10 }}
          />
          {submitting ? <ActivityIndicator color={DARK} style={{ marginTop: 8 }} /> : null}

          <GrayButton title="МОЇ ЗАПИСИ" onPress={() => navigation.navigate('MyRecords')} style={{ marginTop: 12 }} />

          <View style={{ height: 28 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 16, paddingBottom: 6, backgroundColor: '#F3F5F9',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  roleName: { fontFamily: FONT, fontSize: 22, fontWeight: '800', color: '#111827' },
  roleText: { fontFamily: FONT, fontSize: 14, fontWeight: '600', color: '#1F2937' },

  btn: {
    height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    ...SHADOW, paddingHorizontal: 18,
  },
  btnDark: { backgroundColor: DARK },
  btnGray: { backgroundColor: '#7B7B7B' },
  btnText: { color: DARK_TXT, fontFamily: FONT, fontSize: 18, fontWeight: '800' },

  content: { padding: 16, gap: 10 },

  row: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },

  row3: { flexDirection: 'row', gap: 10, marginTop: 4 },
  col3: { flex: 1 },

  label: { fontFamily: FONT, fontSize: 14, color: '#111827', marginBottom: 6, fontWeight: '600' },

  input: {
    minHeight: 44, borderRadius: 12, paddingHorizontal: 12, backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  inputText: { fontFamily: FONT, fontSize: 16, color: '#111827' },

  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectCaret: { fontSize: 16, color: '#6B7280' },

  dateBtn: { justifyContent: 'center' },
  dateText: { color: '#111827', fontFamily: FONT, fontSize: 16 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14 },
  modalTitle: { fontFamily: FONT, fontSize: 16, fontWeight: '700', marginBottom: 10, color: '#111827' },
  optionRow: { paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  optionText: { fontFamily: FONT, fontSize: 16, color: '#111827' },
});