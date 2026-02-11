import React, { useContext, useEffect, useState } from 'react';
import {
  SafeAreaView, View, Text, TouchableOpacity, Alert, StyleSheet,
  ScrollView, ActivityIndicator, Modal, FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CustomCalendar from './components/CustomCalendar';
import { AuthCtx } from './contexts';
import { getBreaksDataFromSupabase, getAllPilotsFromSupabase, updateLpBreakDateInSupabase } from './supabaseData';
import { Colors, Shadows, BorderRadius, Spacing, FONT } from './theme';

// Soft status colors — muted pastel tones
const STATUS = {
  green: { bg: '#E8F5E9', text: '#2E7D32', dot: '#4CAF50' },
  yellow: { bg: '#FFF8E1', text: '#F57F17', dot: '#FFC107' },
  red: { bg: '#FFEBEE', text: '#C62828', dot: '#EF5350' },
  gray: { bg: Colors.bgTertiary, text: Colors.textTertiary, dot: '#D1D5DB' },
};

const getStatus = (color) => STATUS[color] || STATUS.gray;

// Pilot selector modal
const PilotSelector = ({ pilots, selectedPilot, onSelect, visible, onClose }) => {
  const cleanName = (n) => n.replace(/^.*?\d{4}\s*\d{2}:\d{2}:\d{2}.*?\)\s*/, '').trim();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Оберiть льотчика</Text>
          <FlatList
            data={pilots}
            keyExtractor={(item, i) => item + '_' + i}
            style={{ maxHeight: 400 }}
            renderItem={({ item }) => {
              const active = selectedPilot === item;
              return (
                <TouchableOpacity
                  onPress={() => onSelect(item)}
                  style={[styles.pilotRow, active && styles.pilotRowActive]}
                >
                  <Text style={[styles.pilotText, active && styles.pilotTextActive]}>
                    {cleanName(item)}
                  </Text>
                  {active && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
                </TouchableOpacity>
              );
            }}
          />
          <TouchableOpacity style={styles.modalClose} onPress={onClose}>
            <Text style={styles.modalCloseText}>Закрити</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default function BreaksLP({ route, navigation }) {
  const { auth } = useContext(AuthCtx);
  const { pib: routePib, isAdmin } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({});
  const [selectedPilot, setSelectedPilot] = useState(routePib || auth?.pib || '');
  const [pilots, setPilots] = useState([]);
  const [showPilotSelector, setShowPilotSelector] = useState(false);

  // Date editing
  const [editingLpType, setEditingLpType] = useState(null);
  const [editingAircraftTypeId, setEditingAircraftTypeId] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const res = await getAllPilotsFromSupabase();
        if (res?.ok) setPilots(res.pilots);
      } catch (_) { setPilots([]); }
    })();
  }, [isAdmin]);

  const loadData = async () => {
    if (!selectedPilot) return;
    try {
      setLoading(true);
      const res = await getBreaksDataFromSupabase(selectedPilot);
      if (!res?.ok) throw new Error(res?.error || 'Помилка');
      setData(res.data || {});
    } catch (e) {
      Alert.alert('Помилка', String(e.message || e));
      setData({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [selectedPilot]);

  const cleanName = (n) => n.replace(/^.*?\d{4}\s*\d{2}:\d{2}:\d{2}.*?\)\s*/, '').trim();
  const currentIsAdmin = isAdmin || (auth?.role === 'admin');
  const lpSections = data.lpSections || [];

  // Date editing handlers
  const handleEditDate = (normalized, aircraftTypeId, currentDate) => {
    setEditingLpType(normalized);
    setEditingAircraftTypeId(aircraftTypeId);
    if (currentDate && currentDate.trim()) {
      try {
        const parts = currentDate.split('.');
        if (parts.length === 3) {
          setSelectedDate(new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])));
        } else { setSelectedDate(new Date()); }
      } catch (_) { setSelectedDate(new Date()); }
    } else { setSelectedDate(new Date()); }
    setShowDatePicker(true);
  };

  const onCalendarSelect = async (date) => {
    if (!date || !editingLpType) return;
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const formatted = `${day}.${month}.${year}`;
    setShowDatePicker(false);
    const lpType = editingLpType;
    const acTypeId = editingAircraftTypeId;
    setEditingLpType(null);
    setEditingAircraftTypeId(null);
    try {
      const result = await updateLpBreakDateInSupabase(selectedPilot, lpType, acTypeId, formatted);
      if (result?.ok) {
        loadData();
      } else {
        Alert.alert('Помилка', result?.error || 'Не вдалося оновити дату');
      }
    } catch (_) {
      Alert.alert('Помилка', 'Не вдалося оновити дату');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Перерви за видами ЛП</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.textTertiary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Перерви за видами ЛП</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Admin pilot selector */}
      {currentIsAdmin && (
        <TouchableOpacity
          style={styles.pilotSelector}
          onPress={() => setShowPilotSelector(true)}
        >
          <Ionicons name="person-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.pilotSelectorText}>
            {cleanName(selectedPilot) || 'Оберiть льотчика'}
          </Text>
          <Ionicons name="chevron-down" size={16} color={Colors.textTertiary} />
        </TouchableOpacity>
      )}

      {/* Column headers */}
      <View style={styles.columnHeaders}>
        <Text style={styles.colHeaderLeft}>Тип ПС</Text>
        <Text style={styles.colHeaderCenter}>Крайнiй полiт</Text>
        <Text style={styles.colHeaderRight}>Дiйсний до</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {lpSections.map((section, idx) => {
          // КЛПВ header separator
          if (section.type === 'klpv_header') {
            return (
              <View key={`s-${idx}`} style={styles.klpvHeaderContainer}>
                <View style={styles.klpvHeaderLine} />
                <Text style={styles.klpvHeaderText}>Згідно КЛПВ</Text>
                <View style={styles.klpvHeaderLine} />
              </View>
            );
          }

          const items = section.items || [];

          return (
            <View key={`s-${idx}`} style={styles.section}>
              {/* Section title */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.name}</Text>
              </View>

              {/* Items */}
              {items.length > 0 ? items.map((item, i) => {
                const s = getStatus(item.color);
                const isLast = i === items.length - 1;
                const hasKlpv = !!item.klpvExpiryDate;
                return (
                  <React.Fragment key={i}>
                    <View
                      style={[styles.row, isLast && !hasKlpv && styles.rowLast]}
                    >
                      {/* Status dot + aircraft */}
                      <View style={styles.rowLeft}>
                        <View style={[styles.dot, { backgroundColor: s.dot }]} />
                        <Text style={styles.aircraftText}>
                          {item.aircraft || '—'}
                        </Text>
                      </View>

                      {/* Dates + edit */}
                      <View style={styles.rowRight}>
                        <TouchableOpacity
                          style={[styles.dateBox, { backgroundColor: s.bg }]}
                          onPress={() => handleEditDate(section.normalized, item.aircraftTypeId, item.date)}
                        >
                          <Text style={[styles.dateText, { color: s.text }]}>
                            {item.date || '—'}
                          </Text>
                        </TouchableOpacity>
                        <View style={[styles.dateBox, { backgroundColor: s.bg }]}>
                          <Text style={[styles.dateText, { color: s.text }]}>
                            {item.expiryDate || '—'}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.editBtn}
                          onPress={() => handleEditDate(section.normalized, item.aircraftTypeId, item.date)}
                        >
                          <Ionicons name="create-outline" size={15} color={Colors.textTertiary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    {/* КЛПВ sub-row */}
                    {hasKlpv && (() => {
                      const ks = getStatus(item.klpvColor);
                      return (
                        <View style={[styles.klpvRow, isLast && styles.rowLast]}>
                          <View style={styles.rowLeft} />
                          <View style={styles.rowRight}>
                            <View style={styles.klpvLabelBox}>
                              <Text style={styles.klpvLabel}>КЛПВ</Text>
                            </View>
                            <View style={[styles.dateBox, { backgroundColor: ks.bg }]}>
                              <Text style={[styles.dateText, { color: ks.text }]}>
                                {item.klpvExpiryDate}
                              </Text>
                            </View>
                            <View style={{ width: 28 }} />
                          </View>
                        </View>
                      );
                    })()}
                  </React.Fragment>
                );
              }) : (
                <View style={styles.emptyRow}>
                  <Text style={styles.emptyText}>Немає даних</Text>
                </View>
              )}
            </View>
          );
        })}
        <View style={{ height: 32 }} />
      </ScrollView>

      <PilotSelector
        pilots={pilots}
        selectedPilot={selectedPilot}
        onSelect={(p) => { setSelectedPilot(p); setShowPilotSelector(false); }}
        visible={showPilotSelector}
        onClose={() => setShowPilotSelector(false)}
      />

      {/* Date calendar */}
      <CustomCalendar
        visible={showDatePicker}
        value={selectedDate}
        onSelect={onCalendarSelect}
        onClose={() => { setShowDatePicker(false); setEditingLpType(null); setEditingAircraftTypeId(null); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgSecondary,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.bgPrimary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.sm,
  },
  headerTitle: {
    fontFamily: FONT,
    fontSize: 18,
    fontWeight: '400',
    color: Colors.textPrimary,
  },

  // Pilot selector
  pilotSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    backgroundColor: Colors.bgPrimary,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pilotSelectorText: {
    flex: 1,
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '400',
    color: Colors.textPrimary,
  },

  // Column headers
  columnHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
  },
  colHeaderLeft: {
    flex: 1,
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '400',
    color: Colors.textTertiary,
  },
  colHeaderCenter: {
    width: 100,
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '400',
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  colHeaderRight: {
    width: 100,
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '400',
    color: Colors.textTertiary,
    textAlign: 'center',
    marginLeft: 6,
  },

  // Scroll
  scroll: {
    flex: 1,
  },

  // Section (one LP type)
  section: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.bgPrimary,
    borderRadius: BorderRadius.md,
    ...Shadows.small,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    backgroundColor: Colors.bgTertiary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  sectionTitle: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },

  // Edit button
  editBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },

  // Row — one aircraft
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  aircraftText: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textPrimary,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  // Date boxes
  dateBox: {
    width: 100,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  dateText: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '400',
  },

  // КЛПВ sub-row (under matching KBP item)
  klpvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  klpvLabelBox: {
    width: 100,
    paddingVertical: 3,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  klpvLabel: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '400',
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },

  // КЛПВ header separator
  klpvHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    gap: 10,
  },
  klpvHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.borderLight,
  },
  klpvHeaderText: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '400',
    color: Colors.textTertiary,
  },

  // Empty
  emptyRow: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '400',
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },

  // Centered loading
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 24,
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
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  pilotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  pilotRowActive: {
    backgroundColor: Colors.bgTertiary,
  },
  pilotText: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '400',
    color: Colors.textPrimary,
  },
  pilotTextActive: {
    color: Colors.primary,
  },
  modalClose: {
    marginTop: Spacing.md,
    paddingVertical: 11,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.bgTertiary,
    alignItems: 'center',
  },
  modalCloseText: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '400',
    color: Colors.textPrimary,
  },
});
