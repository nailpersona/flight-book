// Main.js — сторінка записів
import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView,
  Modal, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CustomCalendar from './components/CustomCalendar';
import { AuthCtx } from './contexts';
import { supabase } from './supabase';
import { Colors, Shadows, BorderRadius, Spacing, FONT } from './theme';
import { TabNavigationContext } from './FixedTabNavigator';
import ThemedAlert from './ThemedAlert';

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
      <ActivityIndicator color="#555860" size="small" />
    ) : (
      <>
        <Ionicons name="add-circle-outline" size={18} color="#555860" style={s.btnIcon} />
        <Text style={s.btnText}>{title}</Text>
      </>
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

// ─── Модальне вікно додавання екіпажу ───

function CrewModal({ visible, aircraftType, roles, showTechnician, pilots, crew, onSave, onClose }) {
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedPilot, setSelectedPilot] = useState(null); // {id, name}
  const [customName, setCustomName] = useState('');
  const [technicianRole] = useState('Бортовий технік');
  const [technicianPilot, setTechnicianPilot] = useState(null);
  const [technicianCustom, setTechnicianCustom] = useState('');

  const [showRolePicker, setShowRolePicker] = useState(false);
  const [showNamePicker, setShowNamePicker] = useState(false);
  const [showTechNamePicker, setShowTechNamePicker] = useState(false);

  // Визначаємо, чи вже є член екіпажу з цією роллю
  const isRoleTaken = (role) => crew.some(m => m.role === role);

  const handleAddMember = () => {
    if (!selectedRole) return;
    const name = customName.trim() || selectedPilot?.name;
    if (!name) return;

    // Якщо введено вручну - userId буде null
    const userId = customName.trim() ? null : selectedPilot?.id;

    onSave([...crew, { role: selectedRole, name, userId }]);
    setSelectedRole('');
    setSelectedPilot(null);
    setCustomName('');
  };

  const handleAddTechnician = () => {
    const name = technicianCustom.trim() || technicianPilot?.name;
    if (!name) return;

    const userId = technicianCustom.trim() ? null : technicianPilot?.id;

    // Видаляємо попереднього техніка якщо є
    const filtered = crew.filter(m => m.role !== technicianRole);
    onSave([...filtered, { role: technicianRole, name, userId }]);
    setTechnicianPilot(null);
    setTechnicianCustom('');
  };

  // Фільтруємо доступні ролі (ті, що ще не зайняті)
  const availableRoles = roles.filter(r => !isRoleTaken(r));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.modalBackdrop}>
        <View style={[s.modalCard, { maxHeight: '85%' }]}>
          <Text style={s.modalTitle}>Додати екіпаж ({aircraftType})</Text>

          {/* Існуючий екіпаж */}
          {crew.length > 0 && (
            <View style={{ marginBottom: Spacing.md }}>
              <Text style={s.crewModalLabel}>Додані члени екіпажу:</Text>
              {crew.map((member, index) => (
                <View key={index} style={s.crewModalItem}>
                  <Text style={s.crewModalRole}>{member.role}:</Text>
                  <Text style={s.crewModalName}>{member.name}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Вибір ролі */}
          {availableRoles.length > 0 && (
            <>
              <Text style={s.crewModalLabel}>Роль:</Text>
              <TouchableOpacity
                style={s.select}
                onPress={() => setShowRolePicker(true)}
                activeOpacity={0.85}
              >
                <Text style={[s.selectText, !selectedRole && { color: Colors.textTertiary }]}>
                  {selectedRole || 'Оберіть роль'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={Colors.textTertiary} />
              </TouchableOpacity>

              <Modal visible={showRolePicker} transparent animationType="fade" onRequestClose={() => setShowRolePicker(false)}>
                <View style={s.modalBackdrop}>
                  <View style={s.modalCard}>
                    <Text style={s.modalTitle}>Оберіть роль</Text>
                    <FlatList
                      data={availableRoles}
                      keyExtractor={(item) => item}
                      style={{ maxHeight: 240 }}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          onPress={() => { setSelectedRole(item); setShowRolePicker(false); }}
                          style={s.optionRow}
                        >
                          <Text style={s.optionText}>{item}</Text>
                        </TouchableOpacity>
                      )}
                    />
                    <SecondaryButton title="Закрити" onPress={() => setShowRolePicker(false)} style={{ marginTop: Spacing.sm }} />
                  </View>
                </View>
              </Modal>
            </>
          )}

          {/* Вибір прізвища або введення */}
          {selectedRole && (
            <>
              <Text style={s.crewModalLabel}>Прізвище:</Text>

              <TouchableOpacity
                style={s.select}
                onPress={() => setShowNamePicker(true)}
                activeOpacity={0.85}
              >
                <Text style={[s.selectText, !selectedPilot && { color: Colors.textTertiary }]}>
                  {selectedPilot?.name || 'Оберіть зі списку'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={Colors.textTertiary} />
              </TouchableOpacity>

              <Modal visible={showNamePicker} transparent animationType="fade" onRequestClose={() => setShowNamePicker(false)}>
                <View style={s.modalBackdrop}>
                  <View style={s.modalCard}>
                    <Text style={s.modalTitle}>Оберіть пілота</Text>
                    <FlatList
                      data={pilots}
                      keyExtractor={(item) => item.id}
                      style={{ maxHeight: 300 }}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          onPress={() => { setSelectedPilot(item); setShowNamePicker(false); }}
                          style={s.optionRow}
                        >
                          <Text style={s.optionText}>{item.name}</Text>
                        </TouchableOpacity>
                      )}
                    />
                    <SecondaryButton title="Закрити" onPress={() => setShowNamePicker(false)} style={{ marginTop: Spacing.sm }} />
                  </View>
                </View>
              </Modal>

              <Text style={[s.crewModalLabel, { marginTop: Spacing.sm }]}>Або введіть вручну:</Text>
              <TextInput
                style={[s.input, s.inputText]}
                placeholder="Прізвище Ім'я"
                placeholderTextColor={Colors.textTertiary}
                value={customName}
                onChangeText={setCustomName}
              />

              <DarkButton
                title="Додати"
                onPress={handleAddMember}
                style={{ marginTop: Spacing.md }}
                disabled={!customName.trim() && !selectedPilot}
              />
            </>
          )}

          {/* Бортовий технік для Мі-8 */}
          {showTechnician && !crew.some(m => m.role === technicianRole) && (
            <View style={{ marginTop: Spacing.lg, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.borderLight }}>
              <Text style={s.crewModalLabel}>Бортовий технік:</Text>

              <TouchableOpacity
                style={s.select}
                onPress={() => setShowTechNamePicker(true)}
                activeOpacity={0.85}
              >
                <Text style={[s.selectText, !technicianPilot && { color: Colors.textTertiary }]}>
                  {technicianPilot?.name || 'Оберіть зі списку'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={Colors.textTertiary} />
              </TouchableOpacity>

              <Modal visible={showTechNamePicker} transparent animationType="fade" onRequestClose={() => setShowTechNamePicker(false)}>
                <View style={s.modalBackdrop}>
                  <View style={s.modalCard}>
                    <Text style={s.modalTitle}>Оберіть техніка</Text>
                    <FlatList
                      data={pilots}
                      keyExtractor={(item) => item.id}
                      style={{ maxHeight: 300 }}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          onPress={() => { setTechnicianPilot(item); setShowTechNamePicker(false); }}
                          style={s.optionRow}
                        >
                          <Text style={s.optionText}>{item.name}</Text>
                        </TouchableOpacity>
                      )}
                    />
                    <SecondaryButton title="Закрити" onPress={() => setShowTechNamePicker(false)} style={{ marginTop: Spacing.sm }} />
                  </View>
                </View>
              </Modal>

              <Text style={[s.crewModalLabel, { marginTop: Spacing.sm }]}>Або введіть вручну:</Text>
              <TextInput
                style={[s.input, s.inputText]}
                placeholder="Прізвище Ім'я"
                placeholderTextColor={Colors.textTertiary}
                value={technicianCustom}
                onChangeText={setTechnicianCustom}
              />

              <DarkButton
                title="Додати техніка"
                onPress={handleAddTechnician}
                style={{ marginTop: Spacing.sm }}
                disabled={!technicianCustom.trim() && !technicianPilot}
              />
            </View>
          )}

          <SecondaryButton title="Готово" onPress={onClose} style={{ marginTop: Spacing.lg }} />
        </View>
      </View>
    </Modal>
  );
}

// ─── Модальне вікно зворотного зв'язку після польоту ───

function FlightFeedbackModal({ visible, data, onClose }) {
  const [lpTypes, setLpTypes] = useState([]);
  const [checkedLp, setCheckedLp] = useState({});
  const [aiSuggested, setAiSuggested] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [loadingLp, setLoadingLp] = useState(true);

  useEffect(() => {
    if (!visible || !data) return;
    const kbpDocs = ['КБП ВА', 'КБП БА/РА', 'КБПВ'];
    if (data.docSource && kbpDocs.includes(data.docSource)) {
      loadLpData();
    } else {
      setLoadingLp(false);
      setLpTypes([]);
      setCheckedLp({});
      setAiSuggested(new Set());
    }
  }, [visible, data]);

  const loadLpData = async () => {
    setLoadingLp(true);
    try {
      // Get pilot's military class
      const { data: user } = await supabase
        .from('users')
        .select('military_class')
        .eq('id', data.userId)
        .single();
      const milClass = user?.military_class || 2;

      // Load all LP types for this KBP
      const { data: bpData } = await supabase
        .from('break_periods_lp')
        .select('lp_type, lp_type_normalized')
        .eq('kbp_document', data.docSource)
        .eq('military_class', milClass)
        .order('lp_type_normalized');

      const seen = new Set();
      const types = [];
      (bpData || []).forEach(t => {
        if (!seen.has(t.lp_type_normalized)) {
          seen.add(t.lp_type_normalized);
          types.push({ normalized: t.lp_type_normalized, display: t.lp_type });
        }
      });
      setLpTypes(types);

      // AI suggestions from exercises.lp_types + exercise_lp_votes
      const aiChecked = {};
      const exerciseIds = data.exerciseIds || [];
      if (exerciseIds.length > 0) {
        const { data: exData } = await supabase
          .from('exercises')
          .select('lp_types')
          .in('id', exerciseIds);
        (exData || []).forEach(ex => {
          (ex.lp_types || []).forEach(lp => { aiChecked[lp] = true; });
        });

        const { data: votes } = await supabase
          .from('exercise_lp_votes')
          .select('lp_type_normalized')
          .in('exercise_id', exerciseIds);
        (votes || []).forEach(v => { aiChecked[v.lp_type_normalized] = true; });
      }

      setAiSuggested(new Set(Object.keys(aiChecked)));
      setCheckedLp({ ...aiChecked });
    } catch (err) {
      console.warn('Error loading LP data:', err);
      setLpTypes([]);
    } finally {
      setLoadingLp(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const selectedLp = Object.entries(checkedLp)
        .filter(([, v]) => v)
        .map(([k]) => k);

      // Визначаємо тип подовження на основі flight_type та наявності інструктора
      const extensionType = getExtensionType(data.flightType, data.hasInstructor);

      // Update lp_break_dates via RPC
      for (const lp of selectedLp) {
        await supabase.rpc('upsert_lp_break', {
          p_user_id: data.userId,
          p_lp_type: lp,
          p_aircraft_type_id: data.aircraftTypeId,
          p_date: data.flightDate,
          p_extension_type: extensionType,
        });
      }

      // Оновити LP для членів екіпажу
      const { data: crewMembers } = await supabase
        .from('flight_crew')
        .select('user_id, role')
        .eq('flight_id', data.flightId);

      if (crewMembers && crewMembers.length > 0) {
        for (const member of crewMembers) {
          // Визначаємо extension_type для ролі
          let crewExtensionType = 'none';
          switch (member.role) {
            case 'Інструктор':
            case 'Штурман':
              crewExtensionType = 'full';
              break;
            case 'Правий пілот':
              crewExtensionType = 'control';
              break;
            case 'У складі екіпажу':
            default:
              crewExtensionType = 'none';
              break;
          }

          // Оновлюємо LP для члена екіпажу з тими ж LP типами
          for (const lp of selectedLp) {
            await supabase.rpc('upsert_lp_break', {
              p_user_id: member.user_id,
              p_lp_type: lp,
              p_aircraft_type_id: data.aircraftTypeId,
              p_date: data.flightDate,
              p_extension_type: crewExtensionType,
            });
          }
        }
      }

      // AI learning: vote for single-exercise flights
      if ((data.exerciseIds || []).length === 1) {
        for (const lp of selectedLp) {
          await supabase.rpc('vote_exercise_lp', {
            p_exercise_id: data.exerciseIds[0],
            p_lp_type: lp,
          });
        }
      }

      // Store AI lesson for multi-exercise flights (if pilot changed something)
      if ((data.exerciseIds || []).length > 1 && selectedLp.length > 0) {
        const aiArr = [...aiSuggested];
        const added = selectedLp.filter(lp => !aiSuggested.has(lp));
        const removed = aiArr.filter(lp => !checkedLp[lp]);

        if (added.length > 0 || removed.length > 0) {
          await supabase.from('ai_lessons').insert({
            lesson_text: `Льотчик обрав ЛП: [${selectedLp.join(', ')}]. AI: [${aiArr.join(', ')}]. +[${added.join(', ')}] -[${removed.join(', ')}].`,
            context: JSON.stringify({
              flight_id: data.flightId,
              exercise_ids: data.exerciseIds,
              selected_lp: selectedLp,
              ai_suggested: aiArr,
            }),
            source: 'pilot_lp_feedback',
            user_id: data.userId,
          });
        }
      }

      // Update flight_updates_log
      if (data.logId) {
        await supabase
          .from('flight_updates_log')
          .update({ detected_lp: selectedLp, confirmed: true })
          .eq('id', data.logId);
      }

      onClose();
    } catch (err) {
      ThemedAlert.alert('Помилка', String(err.message || err));
    } finally {
      setSaving(false);
    }
  };

  if (!data) return null;

  const muList = data.detectedMu || [];
  const hasLpTypes = lpTypes.length > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.modalBackdrop}>
        <View style={[s.modalCard, { maxHeight: '85%' }]}>
          {/* Header */}
          <View style={{ alignItems: 'center', marginBottom: Spacing.md }}>
            <Ionicons name="checkmark-circle-outline" size={40} color={Colors.primary} />
            <Text style={[s.modalTitle, { marginTop: Spacing.sm }]}>Запис додано</Text>
          </View>

          {/* MU info */}
          {muList.length > 0 && (
            <View style={s.feedbackSection}>
              <Text style={s.feedbackSectionTitle}>МУ подовжено:</Text>
              <Text style={s.feedbackItems}>{muList.join(', ')}</Text>
            </View>
          )}

          {/* LP checkboxes */}
          {loadingLp ? (
            <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: Spacing.md }} />
          ) : hasLpTypes ? (
            <>
              <Text style={s.feedbackLabel}>
                Перерви за видами ЛП ({data.docSource})
              </Text>
              <Text style={s.feedbackNote}>
                Відмітьте види ЛП, де ви продовжили терміни
              </Text>
              <ScrollView style={{ maxHeight: 300, marginVertical: Spacing.sm }}>
                {lpTypes.map((lp, i) => {
                  const isChecked = !!checkedLp[lp.normalized];
                  const isAi = aiSuggested.has(lp.normalized);
                  return (
                    <TouchableOpacity
                      key={i}
                      style={s.checkRow}
                      onPress={() => setCheckedLp(prev => ({ ...prev, [lp.normalized]: !prev[lp.normalized] }))}
                    >
                      <Ionicons
                        name={isChecked ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={isChecked ? Colors.primary : Colors.textTertiary}
                      />
                      <Text style={s.checkLabel}>{lp.display}</Text>
                      {isAi && <Text style={s.aiTag}>AI</Text>}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          ) : null}

          {/* Save / OK button */}
          <View style={{ marginTop: Spacing.md }}>
            {hasLpTypes ? (
              <TouchableOpacity
                style={[s.btn, s.btnPrimary]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.btnText}>Зберегти</Text>
                }
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[s.btn, s.btnPrimary]}
                onPress={onClose}
              >
                <Text style={s.btnText}>OK</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Функція визначення типу подовження ───

function getExtensionType(flightType, hasInstructor) {
  switch (flightType) {
    case 'Контрольний':
      return 'control'; // +10 днів
    case 'Тренувальний':
    case 'За інструктора':
      return 'full'; // повний термін
    case 'У складі екіпажу':
      return 'none'; // нічого
    case 'На випробування':
    case 'За методиками ЛВ':
      return hasInstructor ? 'control' : 'full';
    default:
      return 'full';
  }
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

  // Режим редагування
  const [editMode, setEditMode] = useState(false);
  const [editFlightId, setEditFlightId] = useState(null);

  // Екіпаж
  const [showCrewModal, setShowCrewModal] = useState(false);
  const [crewMembers, setCrewMembers] = useState([]); // [{role: 'Інструктор', name: 'Іванов', userId: 'uuid'}]
  const [allPilots, setAllPilots] = useState([]); // [{name: 'Іванов', id: 'uuid'}]

  // Конфігурація ролей за типом ПС
  const CREW_ROLES_CONFIG = {
    'Су-27': ['Інструктор', 'В складі екіпажу'],
    'Міг-29': ['Інструктор', 'В складі екіпажу'],
    'Л-39': ['Інструктор', 'В складі екіпажу'],
    'Су-24': ['Штурман', 'Інструктор'],
    'Мі-8': ['Правий пілот', 'Штурман', 'Інструктор'],
    'Мі-24': ['Штурман', 'Інструктор'],
    'Мі-2': ['Правий пілот', 'Штурман', 'Інструктор'],
  };

  const HELICOPTER_TECHNICIAN = ['Мі-8']; // Для цих вертольотів додається бортовий технік

  // Завантажити вправи та налаштування записів з Supabase
  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('exercises')
          .select('id, number, name, document, task, category, flights_count, is_control, lp_types')
          .order('id');
        if (error) throw error;
        setAllExercises(data || []);

        // Завантажити список пілотів для вибору екіпажу
        const { data: pilotsData } = await supabase
          .from('users')
          .select('id, name')
          .order('name');
        if (pilotsData) {
          setAllPilots(pilotsData.filter(p => p.name));
        }

        // Завантажити налаштування записів пілота
        if (auth?.email) {
          const { data: pilot } = await supabase
            .from('pilots')
            .select('entry_settings')
            .eq('email', auth.email)
            .maybeSingle();
          if (pilot?.entry_settings) {
            const parsed = typeof pilot.entry_settings === 'string' ? JSON.parse(pilot.entry_settings) : pilot.entry_settings;
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

  // Заповнення форми при редагуванні
  useEffect(() => {
    if (!route?.params?.edit) return;
    const { id, data } = route.params.edit;
    setEditMode(true);
    setEditFlightId(id);

    // Дата (ISO format: "2025-01-21")
    if (data.date) {
      const d = new Date(data.date + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        setDateObj(d);
        setDate(ddmmyyyy(d));
      }
    }

    // Тип ПС — з joined aircraft_types
    setTypePs(data.aircraft_types?.name || '');

    // Час доби + МУ (об'єднати: "Д" + "ПМУ" → "ДПМУ")
    setTimeDayMu((data.time_of_day || '') + (data.weather_conditions || ''));

    // Вид польоту (зворотній маппінг для форми)
    const rawFT = data.flight_type || '';
    if (rawFT === 'Тренувальний') {
      setFlightType('Тренувальний');
    } else {
      setFlightType(rawFT);
    }

    setTestTopic(data.test_flight_topic || '');
    setDocSource(data.document_source || '');

    // Наліт: interval "01:30:00" → "1.30"
    if (data.flight_time) {
      const timeMatch = String(data.flight_time).match(/(\d{1,2}):(\d{2})/);
      if (timeMatch) {
        setNalit(`${parseInt(timeMatch[1])}.${timeMatch[2]}`);
      }
    }

    setCombatApps(String(data.combat_applications || ''));

    // Паливо з joined fuel_records
    const fuelRec = data.fuel_records?.[0];
    if (fuelRec) {
      setFuel({ airfield: fuelRec.airfield || '', amount: String(fuelRec.fuel_amount || '') });
    }

    setFlightPurpose(data.flight_purpose || '');

    navigation.setParams({ edit: undefined });
  }, [route?.params?.edit]);

  // Фільтр вправ по обраному документу
  const filteredExercises = useMemo(() => {
    if (!docSource) return allExercises;
    return allExercises.filter(e => e.document === docSource);
  }, [allExercises, docSource]);

  // Скидання вправ при зміні документу
  useEffect(() => {
    setSelectedExercises([]);
  }, [docSource]);

  // Скидання екіпажу при зміні типу ПС
  useEffect(() => {
    setCrewMembers([]);
  }, [typePs]);

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
    setCrewMembers([]);
    setEditMode(false);
    setEditFlightId(null);
  };

  const submit = async () => {
    if (!date) return ThemedAlert.alert('Увага', 'Вкажи дату');
    if (!typePs) return ThemedAlert.alert('Увага', 'Вкажи тип ПС');
    if (!timeDayMu) return ThemedAlert.alert('Увага', 'Вкажи час доби та МУ');
    if (!flightType) return ThemedAlert.alert('Увага', 'Вкажи вид польоту');

    try {
      setSubmitting(true);

      // Режим редагування — оновити в Supabase
      if (editMode && editFlightId) {
        const dbFlightType = flightType;

        const time_of_day = timeDayMu[0];
        const weather_conditions = timeDayMu.substring(1);

        // Знайти aircraft_type_id
        const { data: atData, error: atErr } = await supabase
          .from('aircraft_types').select('id').eq('name', typePs).single();
        if (atErr || !atData) throw new Error('Тип ПС не знайдено');

        // Формуємо YYYY-MM-DD без зміщення timezone
        const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
        const { error: updateErr } = await supabase
          .from('flights')
          .update({
            date: dateStr,
            aircraft_type_id: atData.id,
            time_of_day,
            weather_conditions,
            flight_type: dbFlightType,
            test_flight_topic: dbFlightType === 'На випробування' ? testTopic : null,
            document_source: docSource || null,
            flight_time: toHhMmSs(nalit),
            combat_applications: parseInt(combatApps) || 0,
            flight_purpose: flightPurpose || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editFlightId);
        if (updateErr) throw updateErr;

        // Оновити паливо
        await supabase.from('fuel_records').delete().eq('flight_id', editFlightId);
        if (fuel.airfield && fuel.amount) {
          await supabase.from('fuel_records').insert({
            flight_id: editFlightId,
            airfield: fuel.airfield,
            fuel_amount: parseFloat(fuel.amount) || 0,
          });
        }

        ThemedAlert.alert('Готово', 'Запис оновлено');
        resetForm();
        tabNavigate('MyRecords');
        return;
      }

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
      const dbFlightType = flightType;

      // Формуємо YYYY-MM-DD без зміщення timezone
      const flightDateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;

      // Insert flight
      const { data: flight, error: flightErr } = await supabase
        .from('flights')
        .insert({
          user_id: userData.id,
          date: flightDateStr,
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
      } else {
        // No exercises — dummy UPDATE to trigger MU processing
        await supabase.from('flights').update({ updated_at: new Date().toISOString() }).eq('id', flight.id);
      }

      // Insert fuel
      if (fuel.airfield && fuel.amount) {
        await supabase.from('fuel_records').insert({
          flight_id: flight.id,
          airfield: fuel.airfield,
          fuel_amount: parseFloat(fuel.amount) || 0,
        });
      }

      // Зберегти членів екіпажу в flight_crew та створити для них польоти
      const crewWithUserId = crewMembers.filter(m => m.userId);
      for (const member of crewWithUserId) {
        // Створюємо політ для члена екіпажу
        const { data: crewFlight } = await supabase
          .from('flights')
          .insert({
            user_id: member.userId,
            date: flightDateStr,
            aircraft_type_id: atData.id,
            time_of_day,
            weather_conditions,
            flight_type: 'У складі екіпажу',
            document_source: docSource || null,
            flight_time: toHhMmSs(nalit),
            combat_applications: 0,
            flight_purpose: `${member.role}: ${member.name}`,
            flights_count: 1,
          })
          .select()
          .maybeSingle();

        // Зберігаємо роль в flight_crew
        if (crewFlight) {
          await supabase.from('flight_crew').insert({
            flight_id: flight.id,
            user_id: member.userId,
            role: member.role,
          });
        }

        // Копіюємо вправи в політ члена екіпажу
        if (crewFlight && selectedExercises.length > 0) {
          await supabase
            .from('flight_exercises')
            .insert(selectedExercises.map(ex => ({
              flight_id: crewFlight.id,
              exercise_id: ex.id,
            })));
        }
      }

      // Small delay for triggers to complete, then get detection log
      await new Promise(r => setTimeout(r, 300));
      const { data: log } = await supabase
        .from('flight_updates_log')
        .select('*')
        .eq('flight_id', flight.id)
        .maybeSingle();

      const detectedMu = log?.detected_mu || [];

      // Визначаємо ролі екіпажу та наявність інструктора
      const crewRoles = crewMembers.map(m => m.role);
      const hasInstructor = crewRoles.includes('Інструктор');

      // Визначаємо extension_type для МУ на основі flight_type
      const muExtensionType = getExtensionType(dbFlightType, hasInstructor);

      // Оновлюємо МУ для пілота (автоматично, без popup)
      if (detectedMu.length > 0 && muExtensionType !== 'none') {
        await supabase.rpc('upsert_mu_break', {
          p_user_id: userData.id,
          p_aircraft_type_id: atData.id,
          p_mu_conditions: detectedMu,
          p_date: flightDateStr,
          p_extension_type: muExtensionType,
        });
      }

      // Оновлюємо МУ для членів екіпажу
      for (const member of crewWithUserId) {
        // Визначаємо extension_type для ролі
        let crewMuExtensionType = 'none';
        switch (member.role) {
          case 'Інструктор':
          case 'Штурман':
            crewMuExtensionType = 'full';
            break;
          case 'Правий пілот':
            crewMuExtensionType = 'control';
            break;
          case 'У складі екіпажу':
          default:
            crewMuExtensionType = 'none';
            break;
        }

        if (detectedMu.length > 0 && crewMuExtensionType !== 'none') {
          await supabase.rpc('upsert_mu_break', {
            p_user_id: member.userId,
            p_aircraft_type_id: atData.id,
            p_mu_conditions: detectedMu,
            p_date: flightDateStr,
            p_extension_type: crewMuExtensionType,
          });
        }
      }

      // Show popup when KBP selected or MU detected
      const kbpDocs = ['КБП ВА', 'КБП БА/РА', 'КБПВ'];
      if (kbpDocs.includes(docSource) || detectedMu.length > 0) {
        setFeedbackData({
          flightId: flight.id,
          userId: userData.id,
          docSource: docSource || null,
          exerciseIds: selectedExercises.map(e => e.id),
          aircraftTypeId: atData.id,
          flightDate: flightDateStr,
          flightType: dbFlightType, // Вид польоту
          crewRoles, // Ролі екіпажу
          hasInstructor, // Чи є інструктор
          detectedMu,
          logId: log?.id,
        });
        setShowFeedback(true);
      } else {
        ThemedAlert.alert('Готово', 'Запис додано');
      }

      resetForm();
    } catch (err) {
      ThemedAlert.alert('Помилка', String(err.message || err));
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
                  options={['Контрольний', 'Тренувальний', 'За інструктора', 'У складі екіпажу', 'На випробування', 'За методиками ЛВ']}
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

            {/* Кнопка додавання екіпажу */}
            {CREW_ROLES_CONFIG[typePs] && (
              <TouchableOpacity
                style={s.addCrewBtn}
                onPress={() => setShowCrewModal(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="people-outline" size={18} color={Colors.textSecondary} />
                <Text style={s.addCrewBtnText}>
                  {crewMembers.length > 0 ? `Екіпаж (${crewMembers.length})` : '+ Додати екіпаж'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Відображення доданого екіпажу */}
            {crewMembers.length > 0 && (
              <View style={s.crewList}>
                {crewMembers.map((member, index) => (
                  <View key={index} style={s.crewItem}>
                    <Text style={s.crewRole}>{member.role}</Text>
                    <Text style={s.crewName}>{member.name}</Text>
                    <TouchableOpacity
                      onPress={() => setCrewMembers(prev => prev.filter((_, i) => i !== index))}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={s.crewRemove}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
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
                  options={settingsSources.length > 0 ? settingsSources : ['КБП ВА', 'КЛПВ', 'КБПВ', 'КБП БА/РА']}
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
            <PrimaryButton title={editMode ? "Зберегти зміни" : "Додати запис"} onPress={submit} loading={submitting} style={{ width: '60%' }} />
          </View>

          <View style={{ height: Spacing.xl }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <FlightFeedbackModal
        visible={showFeedback}
        data={feedbackData}
        onClose={() => { setShowFeedback(false); setFeedbackData(null); }}
      />

      <CrewModal
        visible={showCrewModal}
        aircraftType={typePs}
        roles={CREW_ROLES_CONFIG[typePs] || []}
        showTechnician={HELICOPTER_TECHNICIAN.includes(typePs)}
        pilots={allPilots}
        crew={crewMembers}
        onSave={setCrewMembers}
        onClose={() => setShowCrewModal(false)}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    gap: 8,
    ...Shadows.medium,
  },
  btnIcon: {
    marginRight: 4,
  },
  btnPrimary: {
    backgroundColor: '#D9DBDE',
    borderWidth: 1,
    borderColor: '#B0B3B8',
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
    color: '#555860',
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
  aiTag: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '400',
    color: Colors.primary,
    backgroundColor: Colors.bgTertiary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  btnOutline: {
    backgroundColor: Colors.bgPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  // Crew styles
  addCrewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  addCrewBtnText: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '400',
    color: Colors.textSecondary,
  },
  crewList: {
    marginTop: Spacing.sm,
  },
  crewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSecondary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginBottom: 6,
  },
  crewRole: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '400',
    color: Colors.textSecondary,
    width: 110,
  },
  crewName: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textPrimary,
    flex: 1,
  },
  crewRemove: {
    fontFamily: FONT,
    fontSize: 14,
    color: Colors.textTertiary,
    marginLeft: Spacing.sm,
  },
  crewModalLabel: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '400',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  crewModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  crewModalRole: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textSecondary,
    width: 120,
  },
  crewModalName: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textPrimary,
  },
});
