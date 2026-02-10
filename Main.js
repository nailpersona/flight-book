// Main.js — сторінка записів
import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Alert, ScrollView,
  ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView,
  Modal, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CustomCalendar from './components/CustomCalendar';
import { AuthCtx } from './contexts';
import { supabase } from './supabase';
import { Colors, Shadows, BorderRadius, Spacing, FONT } from './theme';
import { TabNavigationContext } from './FixedTabNavigator';

// ─── Утиліти ───

function ddmmyyyy(d) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function toHhMmSs(input) {
  if (input == null) return '00:00:00';
  const sRaw = String(input).trim();
  if (!sRaw) return '00:00:00';
  const mClock = sRaw.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (mClock) {
    let hh = +mClock[1], mm = +mClock[2], ss = +(mClock[3] || 0);
    hh += Math.floor(mm / 60); mm = mm % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }
  const s = sRaw.replace(',', '.');
  const mHM = s.match(/^(\d+)\.(\d{1,2})$/);
  if (mHM) {
    let hh = +mHM[1], mm = +mHM[2];
    hh += Math.floor(mm / 60); mm = mm % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
  }
  if (/^\d+$/.test(s)) return `${String(+s).padStart(2, '0')}:00:00`;
  return '00:00:00';
}

// ─── Базові компоненти ───

const PrimaryButton = ({ title, onPress, style, loading }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[s.btn, s.btnPrimary, style]} disabled={loading}>
    {loading ? (
      <ActivityIndicator color={Colors.textInverse} size="small" />
    ) : (
      <Text style={s.btnText}>{title}</Text>
    )}
  </TouchableOpacity>
);

const SecondaryButton = ({ title, onPress, style }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[s.btn, s.btnSecondary, style]}>
    <Text style={s.btnTextDark}>{title}</Text>
  </TouchableOpacity>
);

const DarkButton = ({ title, onPress, style }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[s.btn, s.btnDark, style]}>
    <Text style={s.btnText}>{title}</Text>
  </TouchableOpacity>
);

// ─── Section card ───

function Section({ icon, title, children }) {
  return (
    <View style={s.card}>
      <View style={s.sectionHeader}>
        <Ionicons name={icon} size={16} color={Colors.textSecondary} />
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

// ─── Combo ───

function Combo({ label, value, onChange, options = [], placeholder = '' }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: Spacing.md }}>
      {!!label && <Text style={s.label}>{label}</Text>}
      <TouchableOpacity style={s.select} activeOpacity={0.85} onPress={() => setOpen(true)}>
        <Text style={[s.selectText, !value && { color: Colors.textTertiary }]}>
          {value || placeholder || label}
        </Text>
        <Ionicons name="chevron-down" size={16} color={Colors.textTertiary} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(item, idx) => item + '_' + idx}
              style={{ maxHeight: 340 }}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => { onChange(item); setOpen(false); }} style={s.optionRow}>
                  <Text style={s.optionText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
            <SecondaryButton title="Закрити" onPress={() => setOpen(false)} style={{ marginTop: Spacing.sm }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Вибір вправ з автокомплітом ───

function ExercisePicker({ exercises, selectedExercises, onAdd, onRemove }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const getExerciseKey = (ex, flightNum = null) => {
    return flightNum ? `${ex.id}_${flightNum}` : String(ex.id);
  };

  const exerciseVariants = useMemo(() => {
    const variants = [];
    exercises.forEach(ex => {
      const flightCount = ex.flights_count && ex.flights_count !== 'РК' ? parseInt(ex.flights_count) : 0;
      if (flightCount > 1) {
        for (let i = 1; i <= flightCount; i++) {
          variants.push({ ...ex, flight_number: i, displayNumber: `${ex.number}(${i})` });
        }
      } else {
        variants.push({ ...ex, flight_number: null, displayNumber: ex.number });
      }
    });
    return variants;
  }, [exercises]);

  const filtered = useMemo(() => {
    if (!search.trim()) return exerciseVariants.slice(0, 30);
    const q = search.toLowerCase();
    return exerciseVariants.filter(e =>
      e.number.toLowerCase().includes(q) || e.displayNumber.toLowerCase().includes(q) || e.name.toLowerCase().includes(q)
    ).slice(0, 30);
  }, [exerciseVariants, search]);

  const selectedKeys = new Set(selectedExercises.map(ex => getExerciseKey(ex, ex.flight_number)));

  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Text style={s.label}>Вправа</Text>

      {selectedExercises.length > 0 ? (
        <TouchableOpacity activeOpacity={0.85} onPress={() => setOpen(true)} style={[s.select, { height: 'auto', minHeight: 44, paddingVertical: 6 }]}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 }}>
            {selectedExercises.map(ex => {
              const key = getExerciseKey(ex, ex.flight_number);
              const displayLabel = ex.flight_number ? `${ex.number}(${ex.flight_number})` : ex.number;
              return (
                <View key={key} style={s.chip}>
                  <Text style={s.chipText}>{displayLabel}</Text>
                  <TouchableOpacity onPress={() => onRemove(ex.id, ex.flight_number)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={s.chipRemove}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
          <Ionicons name="chevron-down" size={16} color={Colors.textTertiary} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={s.select} activeOpacity={0.85} onPress={() => setOpen(true)}>
          <Text style={[s.selectText, { color: Colors.textTertiary }]}> </Text>
          <Ionicons name="chevron-down" size={16} color={Colors.textTertiary} />
        </TouchableOpacity>
      )}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={s.modalBackdrop}>
          <View style={[s.modalCard, { maxHeight: '80%' }]}>
            <Text style={s.modalTitle}>Вправа</Text>
            <TextInput
              style={[s.input, s.inputText, { marginBottom: Spacing.sm }]}
              placeholder="Пошук: номер або назва..."
              placeholderTextColor={Colors.textTertiary}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
            <FlatList
              data={filtered}
              keyExtractor={(item) => getExerciseKey(item, item.flight_number)}
              style={{ maxHeight: 340 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const key = getExerciseKey(item, item.flight_number);
                const isSelected = selectedKeys.has(key);
                const displayLabel = item.flight_number ? `${item.number}(${item.flight_number}) ${item.name}` : `${item.number} ${item.name}`;
                return (
                  <TouchableOpacity
                    onPress={() => { if (!isSelected) onAdd(item); }}
                    style={[s.optionRow, isSelected && s.optionRowSelected]}
                  >
                    <Text style={[s.optionText, isSelected && s.optionTextSelected]}>
                      {displayLabel}
                    </Text>
                    {isSelected && <Text style={s.selectedMark}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={s.emptyText}>Нічого не знайдено</Text>
              }
            />
            <SecondaryButton title="Готово" onPress={() => { setOpen(false); setSearch(''); }} style={{ marginTop: Spacing.sm }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Попап палива ───

function FuelPopup({ fuel, onSave }) {
  const [open, setOpen] = useState(false);
  const [airfield, setAirfield] = useState(fuel?.airfield || '');
  const [amount, setAmount] = useState(fuel?.amount || '');

  const handleSave = () => {
    onSave({ airfield: airfield.trim(), amount: amount.trim() });
    setOpen(false);
  };

  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Text style={s.label}>Паливо</Text>
      <TouchableOpacity style={s.select} activeOpacity={0.85} onPress={() => setOpen(true)}>
        <Text style={[s.selectText, { color: fuel?.airfield ? Colors.textPrimary : Colors.textTertiary }]}>
          {fuel?.airfield ? `${fuel.airfield} — ${fuel.amount} кг` : 'кг'}
        </Text>
        <Ionicons name="chevron-down" size={16} color={Colors.textTertiary} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Паливо</Text>

            <Text style={s.label}>Аеродром</Text>
            <TextInput
              style={[s.input, s.inputText, { marginBottom: Spacing.md }]}
              placeholder="Назва аеродрому"
              placeholderTextColor={Colors.textTertiary}
              value={airfield}
              onChangeText={setAirfield}
            />

            <Text style={s.label}>Кількість (кг)</Text>
            <TextInput
              style={[s.input, s.inputText, { marginBottom: Spacing.md }]}
              placeholder="0"
              placeholderTextColor={Colors.textTertiary}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />

            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <SecondaryButton title="Скасувати" onPress={() => setOpen(false)} style={{ flex: 1 }} />
              <DarkButton title="Зберегти" onPress={handleSave} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Модальне вікно зворотного зв'язку після польоту ───

function FlightFeedbackModal({ visible, data, onClose }) {
  const [correcting, setCorrecting] = useState(false);
  const [checkedLp, setCheckedLp] = useState({});
  const [saving, setSaving] = useState(false);

  // All possible LP types for correction checklist
  const [allLpTypes, setAllLpTypes] = useState([]);

  useEffect(() => {
    if (visible && data) {
      // Initialize checked state from detected LP types
      const init = {};
      (data.detectedLp || []).forEach(lp => { init[lp] = true; });
      setCheckedLp(init);
      setCorrecting(false);

      // Load available LP types
      (async () => {
        const { data: types } = await supabase
          .from('break_periods_lp')
          .select('lp_type')
          .order('lp_type');
        if (types) {
          const unique = [...new Set(types.map(t => t.lp_type))];
          setAllLpTypes(unique);
        }
      })();
    }
  }, [visible, data]);

  const handleConfirm = async () => {
    // Mark as confirmed
    if (data?.logId) {
      await supabase
        .from('flight_updates_log')
        .update({ confirmed: true })
        .eq('id', data.logId);
    }
    onClose();
  };

  const handleCorrection = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const correctedLp = Object.entries(checkedLp)
        .filter(([, v]) => v)
        .map(([k]) => k);

      // Update log with correction
      if (data.logId) {
        await supabase
          .from('flight_updates_log')
          .update({
            confirmed: false,
            corrected_lp: correctedLp,
          })
          .eq('id', data.logId);
      }

      // Store as AI lesson
      const detectedStr = (data.detectedLp || []).join(', ') || 'нічого';
      const correctedStr = correctedLp.join(', ') || 'нічого';
      const lessonText = `Автовизначення видів ЛП було: [${detectedStr}]. Льотчик виправив на: [${correctedStr}].`;

      await supabase.from('ai_lessons').insert({
        lesson_text: lessonText,
        context: JSON.stringify({
          flight_id: data.flightId,
          detected_lp: data.detectedLp,
          corrected_lp: correctedLp,
          detected_mu: data.detectedMu,
          exercise_ids: data.exerciseIds || [],
        }),
        source: 'pilot_feedback',
        user_id: data.userId,
      });

      // Update lp_break_dates: remove unchecked, add newly checked
      const removed = (data.detectedLp || []).filter(lp => !checkedLp[lp]);
      const added = correctedLp.filter(lp => !(data.detectedLp || []).includes(lp));

      // Note: we don't remove from lp_break_dates (might have older valid dates)
      // Just add new ones the pilot indicated
      for (const lp of added) {
        const flightDate = new Date().toISOString().split('T')[0];
        await supabase.from('lp_break_dates')
          .upsert({ user_id: data.userId, lp_type: lp, last_date: flightDate },
            { onConflict: 'user_id,lp_type' });
      }

      onClose();
    } catch (err) {
      Alert.alert('Помилка', String(err.message || err));
    } finally {
      setSaving(false);
    }
  };

  if (!data) return null;

  const muList = data.detectedMu || [];
  const lpList = data.detectedLp || [];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.modalBackdrop}>
        <View style={[s.modalCard, { maxHeight: '80%' }]}>
          {!correcting ? (
            <>
              <View style={{ alignItems: 'center', marginBottom: Spacing.md }}>
                <Ionicons name="checkmark-circle-outline" size={40} color={Colors.primary} />
                <Text style={[s.modalTitle, { marginTop: Spacing.sm }]}>Запис додано</Text>
              </View>

              <Text style={s.feedbackLabel}>Ви подовжили перерви:</Text>

              {muList.length > 0 && (
                <View style={s.feedbackSection}>
                  <Text style={s.feedbackSectionTitle}>МУ:</Text>
                  <Text style={s.feedbackItems}>{muList.join(', ')}</Text>
                </View>
              )}

              {lpList.length > 0 && (
                <View style={s.feedbackSection}>
                  <Text style={s.feedbackSectionTitle}>Види ЛП:</Text>
                  {lpList.map((lp, i) => (
                    <Text key={i} style={s.feedbackItem}>  {lp}</Text>
                  ))}
                </View>
              )}

              {lpList.length === 0 && muList.length > 0 && (
                <Text style={s.feedbackNote}>Види ЛП не визначено (немає вправ)</Text>
              )}

              <Text style={[s.feedbackLabel, { marginTop: Spacing.md }]}>Вірно?</Text>

              <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md }}>
                <TouchableOpacity
                  style={[s.btn, s.btnOutline, { flex: 1 }]}
                  onPress={() => setCorrecting(true)}
                >
                  <Text style={[s.btnText, { color: Colors.textPrimary }]}>Ні</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.btn, s.btnPrimary, { flex: 1 }]}
                  onPress={handleConfirm}
                >
                  <Text style={s.btnText}>Так</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={s.modalTitle}>Виправте види ЛП</Text>
              <Text style={s.feedbackNote}>
                Виправте, будь ласка, ці дані вручну. AI врахує під час наступного оновлення.
              </Text>

              <ScrollView style={{ maxHeight: 300, marginVertical: Spacing.md }}>
                {allLpTypes.map((lp, i) => {
                  const isChecked = !!checkedLp[lp];
                  return (
                    <TouchableOpacity
                      key={i}
                      style={s.checkRow}
                      onPress={() => setCheckedLp(prev => ({ ...prev, [lp]: !prev[lp] }))}
                    >
                      <Ionicons
                        name={isChecked ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={isChecked ? Colors.primary : Colors.textTertiary}
                      />
                      <Text style={s.checkLabel}>{lp}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                <TouchableOpacity
                  style={[s.btn, s.btnOutline, { flex: 1 }]}
                  onPress={() => setCorrecting(false)}
                >
                  <Text style={[s.btnText, { color: Colors.textPrimary }]}>Назад</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.btn, s.btnPrimary, { flex: 1 }]}
                  onPress={handleCorrection}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={s.btnText}>Зберегти</Text>
                  }
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Головний екран ───

export default function Main({ route, navigation }) {
  const { auth } = useContext(AuthCtx);
  const { tabNavigate } = useContext(TabNavigationContext);
  const isAdmin = auth?.role === 'admin';

  const [submitting, setSubmitting] = useState(false);
  const [allExercises, setAllExercises] = useState([]);
  const [loading, setLoading] = useState(true);

  // Налаштування записів з профілю
  const [settingsAircraftTypes, setSettingsAircraftTypes] = useState([]);
  const [settingsSources, setSettingsSources] = useState([]);

  // Feedback modal after flight save
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackData, setFeedbackData] = useState(null);

  // Поля форми
  const [dateObj, setDateObj] = useState(new Date());
  const [date, setDate] = useState(ddmmyyyy(new Date()));
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [typePs, setTypePs] = useState('');
  const [timeDayMu, setTimeDayMu] = useState('');
  const [flightType, setFlightType] = useState('');
  const [testTopic, setTestTopic] = useState('');
  const [docSource, setDocSource] = useState('');
  const [selectedExercises, setSelectedExercises] = useState([]);
  const [nalit, setNalit] = useState('');
  const [combatApps, setCombatApps] = useState('');
  const [fuel, setFuel] = useState({ airfield: '', amount: '' });
  const [flightPurpose, setFlightPurpose] = useState('');

  // Завантажити вправи та налаштування записів з Supabase
  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('exercises')
          .select('id, number, name, document, task, category, flights_count')
          .order('id');
        if (error) throw error;
        setAllExercises(data || []);

        // Завантажити налаштування записів пілота
        if (auth?.email) {
          const { data: pilot } = await supabase
            .from('pilots')
            .select('entry_settings')
            .eq('email', auth.email)
            .maybeSingle();
          if (pilot?.entry_settings) {
            const parsed = JSON.parse(pilot.entry_settings);
            if (parsed.aircraft_types?.length) setSettingsAircraftTypes(parsed.aircraft_types);
            if (parsed.sources?.length) setSettingsSources(parsed.sources);
          }
        }
      } catch (err) {
        console.warn('Помилка завантаження вправ:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Фільтр вправ по обраному документу
  const filteredExercises = useMemo(() => {
    if (!docSource) return allExercises;
    return allExercises.filter(e => e.document === docSource);
  }, [allExercises, docSource]);

  // Скидання вправ при зміні документу
  useEffect(() => {
    setSelectedExercises([]);
  }, [docSource]);

  // Автозаповнення мети польоту з обраних вправ
  const exercisesText = useMemo(() => {
    return selectedExercises.map(e => {
      const label = e.flight_number ? `${e.number}(${e.flight_number})` : e.number;
      return `Впр. ${label} ${e.name}`;
    }).join(', ');
  }, [selectedExercises]);

  // Синхронізація мети польоту з обраними вправами
  useEffect(() => {
    if (exercisesText) {
      setFlightPurpose(exercisesText);
    }
  }, [exercisesText]);

  const onSelectDate = (selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDateObj(selectedDate);
      setDate(ddmmyyyy(selectedDate));
    }
  };

  const resetForm = () => {
    const now = new Date();
    setDateObj(now);
    setDate(ddmmyyyy(now));
    setTypePs('');
    setTimeDayMu('');
    setFlightType('');
    setTestTopic('');
    setDocSource('');
    setSelectedExercises([]);
    setNalit('');
    setCombatApps('');
    setFuel({ airfield: '', amount: '' });
    setFlightPurpose('');
  };

  const submit = async () => {
    if (!date) return Alert.alert('Увага', 'Вкажи дату');
    if (!typePs) return Alert.alert('Увага', 'Вкажи тип ПС');
    if (!timeDayMu) return Alert.alert('Увага', 'Вкажи час доби та МУ');
    if (!flightType) return Alert.alert('Увага', 'Вкажи вид польоту');

    try {
      setSubmitting(true);

      // Parse timeDayMu: "ДСМУ" → time_of_day="Д", weather="СМУ"
      const time_of_day = timeDayMu[0];
      const weather_conditions = timeDayMu.substring(1);

      // Find user
      const { data: userData, error: userErr } = await supabase
        .from('users').select('id').eq('name', auth.pib).single();
      if (userErr || !userData) throw new Error('Користувача не знайдено');

      // Find aircraft_type_id
      const { data: atData, error: atErr } = await supabase
        .from('aircraft_types').select('id').eq('name', typePs).single();
      if (atErr || !atData) throw new Error('Тип ПС не знайдено');

      // Map flight type
      let dbFlightType = flightType;
      if (flightType === 'УТП') dbFlightType = 'Учбово-тренув.';

      // Insert flight
      const { data: flight, error: flightErr } = await supabase
        .from('flights')
        .insert({
          user_id: userData.id,
          date: dateObj.toISOString().split('T')[0],
          aircraft_type_id: atData.id,
          time_of_day,
          weather_conditions,
          flight_type: dbFlightType,
          test_flight_topic: flightType === 'На випробування' ? testTopic : null,
          document_source: docSource || null,
          flight_time: toHhMmSs(nalit),
          combat_applications: parseInt(combatApps) || 0,
          flight_purpose: flightPurpose || null,
          flights_count: 1,
        })
        .select()
        .single();

      if (flightErr) throw flightErr;

      // Insert exercises
      if (selectedExercises.length > 0) {
        const { error: exErr } = await supabase
          .from('flight_exercises')
          .insert(selectedExercises.map(ex => ({
            flight_id: flight.id,
            exercise_id: ex.id,
          })));
        if (exErr) console.warn('Помилка вправ:', exErr);
      }

      // Insert fuel
      if (fuel.airfield && fuel.amount) {
        await supabase.from('fuel_records').insert({
          flight_id: flight.id,
          airfield: fuel.airfield,
          fuel_amount: parseFloat(fuel.amount) || 0,
        });
      }

      // Small delay for triggers to complete, then get detection log
      await new Promise(r => setTimeout(r, 300));
      const { data: log } = await supabase
        .from('flight_updates_log')
        .select('*')
        .eq('flight_id', flight.id)
        .maybeSingle();

      const detectedMu = log?.detected_mu || [];
      const detectedLp = log?.detected_lp || [];

      if (detectedMu.length > 0 || detectedLp.length > 0) {
        setFeedbackData({
          flightId: flight.id,
          userId: userData.id,
          detectedMu,
          detectedLp,
          logId: log?.id,
          exerciseIds: selectedExercises.map(e => e.id),
        });
        setShowFeedback(true);
      } else {
        Alert.alert('Готово', 'Запис додано');
      }

      resetForm();
    } catch (err) {
      Alert.alert('Помилка', String(err.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgTertiary }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={s.loadingText}>Завантаження...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgTertiary }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

          {/* ── Секція 1: Основне ── */}
          <Section icon="airplane-outline" title="Основне">
            <View style={s.row}>
              <View style={s.col}>
                <Text style={s.label}>Дата</Text>
                <TouchableOpacity style={s.dateBtn} onPress={() => setShowDatePicker(true)}>
                  <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} />
                  <Text style={s.dateText}>{date || 'Оберіть дату'}</Text>
                </TouchableOpacity>
                <CustomCalendar
                  visible={showDatePicker}
                  value={dateObj}
                  onSelect={onSelectDate}
                  onClose={() => setShowDatePicker(false)}
                />
              </View>
              <View style={s.col}>
                <Combo label="Тип ПС" value={typePs} onChange={setTypePs} placeholder=" " options={settingsAircraftTypes.length > 0 ? settingsAircraftTypes : ['МіГ-29', 'Су-27', 'Л-39']} />
              </View>
            </View>

            <View style={s.row}>
              <View style={s.col}>
                <Combo label="Час доби та МУ" value={timeDayMu} onChange={setTimeDayMu} placeholder=" " options={['ДПМУ', 'ДСМУ', 'ДВМП', 'НПМУ', 'НСМУ', 'НВМП']} />
              </View>
              <View style={s.col}>
                <Combo
                  label="Вид польоту"
                  value={flightType}
                  onChange={setFlightType}
                  placeholder=" "
                  options={['УТП', 'На випробування', 'У складі екіпажу']}
                />
              </View>
            </View>

            {flightType === 'На випробування' && (
              <View style={{ marginBottom: Spacing.md }}>
                <Text style={s.label}>Тема випробувального польоту</Text>
                <TextInput
                  style={[s.input, s.inputText]}
                  value={testTopic}
                  onChangeText={setTestTopic}
                />
              </View>
            )}
          </Section>

          {/* ── Секція 2: Вправа ── */}
          {flightType !== 'У складі екіпажу' && (
          <Section icon="book-outline" title="Завдання">
            <View style={s.row}>
              <View style={s.col}>
                <Combo
                  label="Згідно чого"
                  value={docSource}
                  onChange={setDocSource}
                  placeholder=" "
                  options={settingsSources.length > 0 ? settingsSources : ['КБП ВА', 'КЛПВ']}
                />
              </View>
              <View style={s.col}>
                <ExercisePicker
                  exercises={filteredExercises}
                  selectedExercises={selectedExercises}
                  onAdd={(ex) => setSelectedExercises(prev => [...prev, ex])}
                  onRemove={(id, flightNumber) => setSelectedExercises(prev => prev.filter(e =>
                    !(e.id === id && e.flight_number === flightNumber)
                  ))}
                />
              </View>
            </View>

            <View style={{ marginBottom: Spacing.md }}>
              <Text style={s.label}>Мета польоту</Text>
              <TextInput
                style={[s.input, s.inputText, { minHeight: 56, textAlignVertical: 'top' }]}
                value={flightPurpose}
                onChangeText={setFlightPurpose}
                multiline
              />
            </View>
          </Section>
          )}

          {/* ── Секція 3: Результати ── */}
          <Section icon="stats-chart-outline" title="Результати">
            {flightType === 'У складі екіпажу' ? (
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: '50%' }}>
                  <Text style={[s.label, { textAlign: 'center' }]}>Наліт</Text>
                  <TextInput
                    style={[s.input, s.inputText, { textAlign: 'center' }]}
                    placeholder="1.30"
                    placeholderTextColor={Colors.textTertiary}
                    value={nalit}
                    onChangeText={setNalit}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            ) : (
              <View style={s.row}>
                <View style={s.col}>
                  <Text style={s.label}>Наліт</Text>
                  <TextInput
                    style={[s.input, s.inputText]}
                    placeholder="1.30"
                    placeholderTextColor={Colors.textTertiary}
                    value={nalit}
                    onChangeText={setNalit}
                    keyboardType="numeric"
                  />
                </View>
                <View style={s.col}>
                  <Text style={s.label}>Бой. заст.</Text>
                  <TextInput
                    style={[s.input, s.inputText]}
                    placeholder="0"
                    placeholderTextColor={Colors.textTertiary}
                    value={combatApps}
                    onChangeText={setCombatApps}
                    keyboardType="numeric"
                  />
                </View>
                <View style={s.col}>
                  <FuelPopup fuel={fuel} onSave={setFuel} />
                </View>
              </View>
            )}
          </Section>

          {/* ── Кнопки ── */}
          <View style={{ alignItems: 'center' }}>
            <PrimaryButton title="Додати запис" onPress={submit} loading={submitting} style={{ width: '60%' }} />
          </View>

          <View style={{ height: Spacing.xl }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <FlightFeedbackModal
        visible={showFeedback}
        data={feedbackData}
        onClose={() => { setShowFeedback(false); setFeedbackData(null); }}
      />
    </SafeAreaView>
  );
}

// ─── Стилі ───

const s = StyleSheet.create({
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },

  // Card sections
  card: {
    backgroundColor: Colors.bgPrimary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.small,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  sectionTitle: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textSecondary,
    letterSpacing: 0.3,
  },

  row: { flexDirection: 'row', gap: Spacing.md },
  col: { flex: 1 },

  // Buttons
  btn: {
    height: 48,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    ...Shadows.medium,
  },
  btnPrimary: {
    backgroundColor: Colors.primary,
  },
  btnSecondary: {
    backgroundColor: Colors.bgPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.small,
  },
  btnDark: {
    backgroundColor: Colors.btnDark,
  },
  btnText: {
    color: Colors.textInverse,
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '400',
  },
  btnTextDark: {
    color: Colors.textPrimary,
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '400',
  },

  // Link-style button
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  linkText: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '400',
    color: Colors.textSecondary,
  },

  // Inputs
  label: {
    fontFamily: FONT,
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 5,
    fontWeight: '400',
  },
  input: {
    minHeight: 44,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputText: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '400',
    color: Colors.textPrimary,
  },

  // Select / combo
  select: {
    minHeight: 44,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '400',
    color: Colors.textPrimary,
    flex: 1,
  },

  // Date
  dateBtn: {
    minHeight: 44,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    color: Colors.textPrimary,
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '400',
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    backgroundColor: Colors.bgPrimary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.large,
  },
  modalTitle: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '400',
    marginBottom: 12,
    color: Colors.textPrimary,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  optionRowSelected: {
    backgroundColor: Colors.bgSecondary,
  },
  optionText: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '400',
    color: Colors.textPrimary,
    flex: 1,
  },
  optionTextSelected: {
    color: Colors.primary,
  },
  selectedMark: {
    fontFamily: FONT,
    color: Colors.success,
    fontSize: 14,
    fontWeight: '400',
    marginLeft: 8,
  },
  emptyText: {
    padding: 12,
    color: Colors.textTertiary,
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '400',
  },

  // Chips
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgTertiary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 5,
  },
  chipText: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '400',
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  chipRemove: {
    fontFamily: FONT,
    fontSize: 12,
    color: Colors.textTertiary,
  },

  // Loading
  loadingText: {
    marginTop: 10,
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '400',
    color: Colors.textSecondary,
  },

  // Feedback modal
  feedbackLabel: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '400',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  feedbackSection: {
    marginBottom: Spacing.sm,
    paddingLeft: Spacing.sm,
  },
  feedbackSectionTitle: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  feedbackItems: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  feedbackItem: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  feedbackNote: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '400',
    color: Colors.textTertiary,
    fontStyle: 'italic',
    marginBottom: Spacing.sm,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  checkLabel: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textPrimary,
    flex: 1,
  },
  btnOutline: {
    backgroundColor: Colors.bgPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
