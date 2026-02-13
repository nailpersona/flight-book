import React, { useContext, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthCtx } from './contexts';
import { supabase } from './supabase';
import ThemedAlert from './ThemedAlert';

const FONT = 'NewsCycle-Regular';
const DARK = '#333333';
const LIGHT = '#ffffff';

const AIRCRAFT_TYPES = {
  'Літаки': ['Л-39', 'Су-27', 'Су-24', 'Міг-29'],
  'Вертольоти': ['Мі-8', 'Мі-24', 'Мі-2'],
};

export default function Settings({ navigation }) {
  const { auth } = useContext(AuthCtx);
  const [entries, setEntries] = useState([{ id: 1, type: '', hours: '', showPlus: true }]);
  const [showModal, setShowModal] = useState(false);
  const [currentEntryId, setCurrentEntryId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // User info from DB
  const [userInfo, setUserInfo] = useState({ rank: '', position: '' });

  // Entry settings state
  const [selectedAircraftTypes, setSelectedAircraftTypes] = useState([]);
  const [selectedSources, setSelectedSources] = useState([]);
  const [showAircraftTypesModal, setShowAircraftTypesModal] = useState(false);
  const [showSourcesModal, setShowSourcesModal] = useState(false);

  const SOURCES = ['КБП ВА', 'КЛПВ', 'КБПВ', 'КБП БА/РА'];
  const ALL_AIRCRAFT_TYPES = [...AIRCRAFT_TYPES['Літаки'], ...AIRCRAFT_TYPES['Вертольоти']];

  // Parse "HH.MM" string to total minutes (e.g. "157.30" → 9450)
  const parseHHMM = (str) => {
    if (!str) return 0;
    const s = String(str);
    if (s.includes('.')) {
      const [h, m] = s.split('.');
      return (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0);
    }
    return (parseInt(s, 10) || 0) * 60;
  };
  // Format minutes to "HH.MM" string (e.g. 9450 → "157.30")
  const formatHHMM = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h + '.' + String(m).padStart(2, '0');
  };

  // Calculate total hours from entries in HH.MM format
  const totalMinutes = entries
    .filter(e => e.type && e.hours)
    .reduce((acc, e) => acc + parseHHMM(e.hours), 0);
  const totalHours = formatHHMM(totalMinutes);

  // Load pilot data from Supabase
  useEffect(() => {
    loadPilotData();
  }, []);

  const loadPilotData = async () => {
    try {
      setLoading(true);

      // Load rank & position from users table
      const { data: userData } = await supabase
        .from('users')
        .select('rank, position')
        .eq('email', auth?.email)
        .maybeSingle();

      if (userData) {
        setUserInfo({ rank: userData.rank || '', position: userData.position || '' });
      }

      const { data, error } = await supabase
        .from('pilots')
        .select('*')
        .eq('email', auth?.email)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        // Load flight hours by aircraft type
        if (data.flight_hours_by_type) {
          let parsed = data.flight_hours_by_type;
          if (typeof parsed === 'string') parsed = JSON.parse(parsed);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setEntries(parsed.map((item, index) => ({
              id: index + 1,
              type: item.type || '',
              hours: item.hours || '',
              showPlus: index === parsed.length - 1,
            })));
          }
        }

        // Load entry settings
        if (data.entry_settings) {
          let parsed = data.entry_settings;
          if (typeof parsed === 'string') parsed = JSON.parse(parsed);
          if (parsed.aircraft_types) {
            setSelectedAircraftTypes(parsed.aircraft_types);
          }
          if (parsed.sources) {
            setSelectedSources(parsed.sources);
          }
        }
      }
    } catch (error) {
      console.error('Error loading pilot data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addEntry = (aircraftType) => {
    setEntries(prev => {
      const updated = prev.map(entry => {
        if (entry.id === currentEntryId) {
          return { ...entry, type: aircraftType, showPlus: false };
        }
        return entry;
      });

      // Add new empty entry
      const newId = Math.max(...prev.map(e => e.id)) + 1;
      return [...updated, { id: newId, type: '', hours: '', showPlus: true }];
    });
    setShowModal(false);
  };

  const removeEntry = (id) => {
    setEntries(prev => {
      const filtered = prev.filter(entry => entry.id !== id);
      // If last entry was removed, add new empty one
      if (filtered.length === 0) {
        return [{ id: 1, type: '', hours: '', showPlus: true }];
      }
      // Make sure last entry has showPlus: true
      const last = filtered[filtered.length - 1];
      if (!last.showPlus && !last.type) {
        return filtered;
      }
      return filtered.map((e, i) => ({
        ...e,
        showPlus: i === filtered.length - 1,
      }));
    });
  };

  const updateHours = (id, hours) => {
    setEntries(prev => prev.map(entry => {
      if (entry.id === id) {
        return { ...entry, hours };
      }
      return entry;
    }));
  };

  const openModal = (id) => {
    setCurrentEntryId(id);
    setShowModal(true);
  };

  // Toggle aircraft type selection
  const toggleAircraftType = (type) => {
    setSelectedAircraftTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  // Toggle source selection
  const toggleSource = (source) => {
    setSelectedSources(prev =>
      prev.includes(source)
        ? prev.filter(s => s !== source)
        : [...prev, source]
    );
  };

  const handlePasswordChange = async () => {
    if (!newPassword.trim()) {
      ThemedAlert.alert('Помилка', 'Введіть новий пароль');
      return;
    }
    if (newPassword.length < 6) {
      ThemedAlert.alert('Помилка', 'Пароль має містити мінімум 6 символів');
      return;
    }
    if (newPassword !== confirmPassword) {
      ThemedAlert.alert('Помилка', 'Паролі не співпадають');
      return;
    }
    try {
      setUpdatingPassword(true);
      const { data: result, error: rpcErr } = await supabase.rpc('fn_change_password', {
        p_email: auth.email,
        p_old_password: '',
        p_new_password: newPassword.trim(),
      });
      if (rpcErr) throw new Error(rpcErr.message);
      if (result?.ok) {
        ThemedAlert.alert('Успіх', 'Пароль змінено успішно');
        setNewPassword('');
        setConfirmPassword('');
        setShowPasswordChange(false);
      } else {
        ThemedAlert.alert('Помилка', result?.error || 'Не вдалося змінити пароль');
      }
    } catch (error) {
      ThemedAlert.alert('Помилка', String(error.message || 'Не вдалося змінити пароль'));
    } finally {
      setUpdatingPassword(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);

      // Prepare flight hours data (only entries with type)
      const flightHoursData = entries
        .filter(e => e.type)
        .map(({ type, hours }) => ({ type, hours }));

      const total = Number(totalHours) || 0;

      // Update or insert pilot data
      const { error } = await supabase
        .from('pilots')
        .upsert({
          email: auth?.email,
          pib: auth?.pib,
          total_hours: total,
          flight_hours_by_type: flightHoursData,
          entry_settings: {
            aircraft_types: selectedAircraftTypes,
            sources: selectedSources,
          },
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'email'
        });

      if (error) throw error;

      ThemedAlert.alert('Успіх', 'Налаштування збережено');
      navigation.goBack();
    } catch (error) {
      console.error('Error saving settings:', error);
      ThemedAlert.alert('Помилка', 'Не вдалося зберегти налаштування');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={DARK} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Інформація про пілота */}
        <View style={styles.section}>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>ПІБ:</Text>
            <Text style={styles.fieldValue}>{auth?.pib || '-'}</Text>
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Посада:</Text>
            <Text style={styles.fieldValue}>{userInfo.position || '-'}</Text>
          </View>
        </View>

        {/* Наліт за типами ПС */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Наліт за типами ПС</Text>

          {/* Загальний наліт - автоматичний підрахунок */}
          <View style={styles.totalHoursRow}>
            <Text style={styles.totalHoursLabel}>Загальний наліт:</Text>
            <Text style={styles.totalHoursValue}>{totalHours}</Text>
            <Text style={styles.totalHoursUnit}>годин</Text>
          </View>

          {entries.map((entry) => (
            <View key={entry.id} style={styles.entryRow}>
              {entry.type ? (
                // Show selected type with hours input
                <>
                  <View style={styles.typeBox}>
                    <Text style={styles.typeText}>{entry.type}</Text>
                  </View>
                  <TextInput
                    style={styles.hoursInput}
                    value={entry.hours}
                    onChangeText={(h) => updateHours(entry.id, h)}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                  {entry.showPlus ? (
                    <TouchableOpacity
                      style={styles.iconBtn}
                      onPress={() => openModal(entry.id)}
                    >
                      <Text style={styles.plusIcon}>+</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.iconBtn}
                      onPress={() => removeEntry(entry.id)}
                    >
                      <Text style={styles.trashIcon}>🗑</Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                // Show + button to add new type
                <TouchableOpacity
                  style={styles.addTypeBtn}
                  onPress={() => openModal(entry.id)}
                >
                  <Text style={styles.addTypeText}>+ Додати тип ПС</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}

        </View>

        {/* Налаштування записів — окремий блок */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Налаштування записів</Text>

          {/* Типи ПС для відображення */}
          <TouchableOpacity
            style={styles.settingsRow}
            onPress={() => setShowAircraftTypesModal(true)}
          >
            <View style={styles.settingsRowLeft}>
              <Text style={styles.settingsLabel}>Типи ПС для відображення:</Text>
              <Text style={styles.settingsValue}>
                {selectedAircraftTypes.length > 0
                  ? selectedAircraftTypes.join(', ')
                  : 'Всі типи'
                }
              </Text>
            </View>
            <Text style={styles.settingsArrow}>›</Text>
          </TouchableOpacity>

          {/* Згідно */}
          <TouchableOpacity
            style={styles.settingsRow}
            onPress={() => setShowSourcesModal(true)}
          >
            <View style={styles.settingsRowLeft}>
              <Text style={styles.settingsLabel}>Згідно:</Text>
              <Text style={styles.settingsValue}>
                {selectedSources.length > 0
                  ? selectedSources.join(', ')
                  : 'Не вибрано'
                }
              </Text>
            </View>
            <Text style={styles.settingsArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Зміна пароля */}
        <View style={styles.section}>
          {!showPasswordChange ? (
            <TouchableOpacity
              style={styles.changePasswordBtn}
              onPress={() => setShowPasswordChange(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="lock-closed-outline" size={18} color="#555860" style={{ marginRight: 10 }} />
              <Text style={styles.changePasswordBtnText}>Змінити пароль</Text>
            </TouchableOpacity>
          ) : (
            <View>
              <Text style={styles.sectionTitle}>Зміна пароля</Text>

              <View style={styles.passwordField}>
                <Text style={styles.passwordLabel}>Новий пароль</Text>
                <TextInput
                  style={styles.passwordInput}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Мінімум 6 символів"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.passwordField}>
                <Text style={styles.passwordLabel}>Підтвердьте пароль</Text>
                <TextInput
                  style={styles.passwordInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Повторіть пароль"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.passwordButtons}>
                <TouchableOpacity
                  style={styles.passwordCancelBtn}
                  onPress={() => {
                    setShowPasswordChange(false);
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  disabled={updatingPassword}
                >
                  <Text style={styles.passwordCancelBtnText}>Скасувати</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.passwordSaveBtn}
                  onPress={handlePasswordChange}
                  disabled={updatingPassword}
                  activeOpacity={0.7}
                >
                  {updatingPassword ? (
                    <ActivityIndicator size="small" color="#555860" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-outline" size={18} color="#555860" style={{ marginRight: 8 }} />
                      <Text style={styles.passwordSaveBtnText}>Змінити</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Кнопка збереження */}
        <View style={styles.saveSection}>
          <TouchableOpacity style={styles.saveBtn} onPress={saveSettings} disabled={saving} activeOpacity={0.7}>
            {saving ? (
              <ActivityIndicator color="#555860" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color="#555860" style={{ marginRight: 10 }} />
                <Text style={styles.saveBtnText}>Зберегти</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal для вибору типу ПС */}
      <Modal
        visible={showModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Оберіть тип ПС</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {Object.entries(AIRCRAFT_TYPES).map(([category, types]) => (
                <View key={category} style={styles.categorySection}>
                  <Text style={styles.categoryTitle}>{category}</Text>
                  {types.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={styles.typeOption}
                      onPress={() => addEntry(type)}
                    >
                      <Text style={styles.typeOptionText}>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setShowModal(false)}
            >
              <Text style={styles.cancelBtnText}>Скасувати</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal для вибору типів ПС для записів */}
      <Modal
        visible={showAircraftTypesModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAircraftTypesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Типи ПС для відображення</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {Object.entries(AIRCRAFT_TYPES).map(([category, types]) => (
                <View key={category} style={styles.categorySection}>
                  <Text style={styles.categoryTitle}>{category}</Text>
                  {types.map((type) => {
                    const isSelected = selectedAircraftTypes.includes(type);
                    return (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.multiSelectOption,
                          isSelected && styles.multiSelectOptionSelected,
                        ]}
                        onPress={() => toggleAircraftType(type)}
                      >
                        <Text style={[
                          styles.multiSelectOptionText,
                          isSelected && styles.multiSelectOptionTextSelected,
                        ]}>
                          {type}
                        </Text>
                        {isSelected && <Text style={styles.checkmark}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setShowAircraftTypesModal(false)}
            >
              <Text style={styles.cancelBtnText}>Готово</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal для вибору джерел */}
      <Modal
        visible={showSourcesModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSourcesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Згідно</Text>

            <View style={styles.categorySection}>
              {SOURCES.map((source) => {
                const isSelected = selectedSources.includes(source);
                return (
                  <TouchableOpacity
                    key={source}
                    style={[
                      styles.multiSelectOption,
                      isSelected && styles.multiSelectOptionSelected,
                    ]}
                    onPress={() => toggleSource(source)}
                  >
                    <Text style={[
                      styles.multiSelectOptionText,
                      isSelected && styles.multiSelectOptionTextSelected,
                    ]}>
                      {source}
                    </Text>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setShowSourcesModal(false)}
            >
              <Text style={styles.cancelBtnText}>Готово</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F5F9',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    backgroundColor: LIGHT,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  fieldLabel: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '400',
    color: '#374151',
    width: 80,
  },
  fieldValue: {
    fontFamily: FONT,
    fontSize: 16,
    color: '#111827',
    flex: 1,
  },
  sectionTitle: {
    fontFamily: FONT,
    fontSize: 18,
    fontWeight: '400',
    color: '#111827',
    marginBottom: 16,
  },
  totalHoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  totalHoursLabel: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '400',
    color: '#374151',
  },
  totalHoursValue: {
    fontFamily: FONT,
    fontSize: 20,
    fontWeight: '400',
    color: '#10B981',
    marginLeft: 8,
  },
  totalHoursUnit: {
    fontFamily: FONT,
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 4,
  },
  inlineInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: FONT,
    fontSize: 16,
    color: '#111827',
    width: 80,
    textAlign: 'center',
    marginLeft: 8,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  typeBox: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  typeText: {
    fontFamily: FONT,
    fontSize: 15,
    color: '#111827',
  },
  hoursInput: {
    width: 70,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 10,
    fontFamily: FONT,
    fontSize: 15,
    textAlign: 'center',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusIcon: {
    fontSize: 20,
    color: '#10B981',
  },
  trashIcon: {
    fontSize: 16,
  },
  addTypeBtn: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#9CA3AF',
  },
  addTypeText: {
    fontFamily: FONT,
    fontSize: 15,
    color: '#6B7280',
  },
  saveSection: {
    marginTop: 10,
    marginBottom: 80,
  },
  saveBtn: {
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D9DBDE',
    borderWidth: 1,
    borderColor: '#B0B3B8',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  saveBtnText: {
    color: '#555860',
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '400',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: LIGHT,
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxHeight: '70%',
  },
  modalTitle: {
    fontFamily: FONT,
    fontSize: 20,
    fontWeight: '400',
    color: '#111827',
    marginBottom: 20,
    textAlign: 'center',
  },
  categorySection: {
    marginBottom: 16,
  },
  categoryTitle: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '400',
    color: '#6B7280',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  typeOption: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  typeOptionText: {
    fontFamily: FONT,
    fontSize: 16,
    color: '#111827',
  },
  cancelBtn: {
    marginTop: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontFamily: FONT,
    fontSize: 16,
    color: '#6B7280',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingsRowLeft: {
    flex: 1,
  },
  settingsLabel: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '400',
    color: '#111827',
    marginBottom: 4,
  },
  settingsValue: {
    fontFamily: FONT,
    fontSize: 14,
    color: '#6B7280',
  },
  settingsArrow: {
    fontFamily: FONT,
    fontSize: 24,
    color: '#9CA3AF',
    marginLeft: 8,
  },
  multiSelectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  multiSelectOptionSelected: {
    backgroundColor: '#10B981',
  },
  multiSelectOptionText: {
    fontFamily: FONT,
    fontSize: 16,
    color: '#111827',
  },
  multiSelectOptionTextSelected: {
    color: '#FFFFFF',
  },
  checkmark: {
    fontFamily: FONT,
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  entrySettingsDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginTop: 12,
    marginBottom: 12,
  },
  entrySettingsTitle: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '400',
    color: '#6B7280',
    marginBottom: 12,
  },
  changePasswordBtn: {
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D9DBDE',
    borderWidth: 1,
    borderColor: '#B0B3B8',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  changePasswordBtnText: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '400',
    color: '#555860',
  },
  passwordField: {
    marginBottom: 12,
  },
  passwordLabel: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '400',
    color: '#374151',
    marginBottom: 6,
  },
  passwordInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: FONT,
    backgroundColor: '#F9FAFB',
    color: '#111827',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  passwordButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  passwordCancelBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D9DBDE',
    borderWidth: 1,
    borderColor: '#B0B3B8',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  passwordCancelBtnText: {
    fontSize: 16,
    fontFamily: FONT,
    fontWeight: '400',
    color: '#555860',
  },
  passwordSaveBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D9DBDE',
    borderWidth: 1,
    borderColor: '#B0B3B8',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  passwordSaveBtnText: {
    fontSize: 16,
    fontFamily: FONT,
    fontWeight: '400',
    color: '#555860',
  },
});
