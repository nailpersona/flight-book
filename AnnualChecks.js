import React, { useContext, useEffect, useState } from 'react';
import {
  SafeAreaView, View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Modal, FlatList
} from 'react-native';
import CustomCalendar from './components/CustomCalendar';
import { Ionicons } from '@expo/vector-icons';
import { AuthCtx } from './contexts';
import { getAnnualChecksFromSupabase, updateAnnualCheckDateInSupabase, getAllPilotsFromSupabase } from './supabaseData';
import { Colors, Shadows, BorderRadius, Spacing, FONT } from './theme';
import ThemedAlert from './ThemedAlert';

// Soft status colors
const STATUS = {
  green: { bg: '#E8F5E9', text: '#2E7D32', dot: '#4CAF50' },
  yellow: { bg: '#FFF8E1', text: '#F57F17', dot: '#FFC107' },
  red: { bg: '#FFEBEE', text: '#C62828', dot: '#EF5350' },
  gray: { bg: Colors.bgTertiary, text: Colors.textTertiary, dot: '#D1D5DB' },
};

const getStatus = (color) => STATUS[color] || STATUS.gray;

// Display labels for check types
const CHECK_LABELS = {
  'ТП': 'Техніка пілотування',
  'Захід за приладами': 'Захід за приладами',
  'ТП_дублюючі': 'ТП за дублюючими',
  'ТП з ІВД': 'ТП з ІВД',
  'навігація': 'Навігація',
  'БЗ': 'Бойове застосування',
  'інструкторська': 'Інструкторська перевірка',
};

// Order of check types
const CHECK_ORDER = [
  'ТП',
  'Захід за приладами',
  'ТП_дублюючі',
  'ТП з ІВД',
  'навігація',
  'БЗ',
  'інструкторська',
];

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

export default function AnnualChecks({ navigation, route }) {
  const { auth } = useContext(AuthCtx);
  const { pib: routePib, isAdmin } = route?.params || {};

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pilots, setPilots] = useState([]);
  const [showPilotSelector, setShowPilotSelector] = useState(false);
  const [selectedPilot, setSelectedPilot] = useState(routePib || auth?.pib || '');

  // Date editing
  const [editingCheckType, setEditingCheckType] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    const currentIsAdmin = isAdmin || (auth?.role === 'admin');
    if (!currentIsAdmin) return;
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
      const res = await getAnnualChecksFromSupabase(selectedPilot);
      if (!res?.ok) throw new Error(res?.error || 'Помилка');
      setData(res.checks || []);
    } catch (e) {
      ThemedAlert.alert('Помилка', String(e.message || e));
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [selectedPilot]);

  const cleanName = (n) => n.replace(/^.*?\d{4}\s*\d{2}:\d{2}:\d{2}.*?\)\s*/, '').trim();
  const currentIsAdmin = isAdmin || (auth?.role === 'admin');

  // Date editing handlers
  const handleEditDate = (checkType, currentDate) => {
    setEditingCheckType(checkType);
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
    if (!date || !editingCheckType) return;
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const formatted = `${day}.${month}.${year}`;
    setShowDatePicker(false);
    setEditingCheckType(null);
    try {
      const result = await updateAnnualCheckDateInSupabase(
        selectedPilot, editingCheckType, formatted,
      );
      if (result?.ok) {
        loadData();
      } else {
        ThemedAlert.alert('Помилка', result?.error || 'Не вдалося оновити дату');
      }
    } catch (_) {
      ThemedAlert.alert('Помилка', 'Не вдалося оновити дату');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Рiчнi перевiрки</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.textTertiary} />
        </View>
      </SafeAreaView>
    );
  }

  // Build a map from check_type to data for quick lookup
  const dataMap = {};
  data.forEach(item => { dataMap[item.check_type] = item; });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Рiчнi перевiрки</Text>
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
        <Text style={styles.colHeaderLeft}>Перевiрка</Text>
        <Text style={styles.colHeaderRight}>Дата</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          {CHECK_ORDER.map((checkType, idx) => {
            const item = dataMap[checkType];
            const s = getStatus(item?.color || 'gray');
            const label = CHECK_LABELS[checkType] || checkType;
            const isLast = idx === CHECK_ORDER.length - 1;

            return (
              <View key={checkType} style={[styles.row, isLast && styles.rowLast]}>
                {/* Check name with status dot */}
                <View style={styles.rowLeft}>
                  <View style={[styles.dot, { backgroundColor: s.dot }]} />
                  <Text style={styles.checkName}>{label}</Text>
                </View>

                {/* Date + edit */}
                <View style={styles.rowRight}>
                  <TouchableOpacity
                    style={[styles.dateBox, { backgroundColor: s.bg }]}
                    onPress={() => handleEditDate(checkType, item?.date || '')}
                  >
                    <Text style={[styles.dateText, { color: s.text }]}>
                      {item?.date || '—'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => handleEditDate(checkType, item?.date || '')}
                  >
                    <Ionicons name="create-outline" size={16} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

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
        onClose={() => { setShowDatePicker(false); setEditingCheckType(null); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgSecondary },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.bgPrimary, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.sm },
  headerTitle: { fontFamily: FONT, fontSize: 18, fontWeight: '400', color: Colors.textPrimary },

  // Pilot selector
  pilotSelector: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: Spacing.lg, marginTop: Spacing.sm, marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    backgroundColor: Colors.bgPrimary, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.border,
  },
  pilotSelectorText: { flex: 1, fontFamily: FONT, fontSize: 15, fontWeight: '400', color: Colors.textPrimary },

  // Column headers
  columnHeaders: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, marginTop: Spacing.sm,
  },
  colHeaderLeft: { flex: 1, fontFamily: FONT, fontSize: 12, fontWeight: '400', color: Colors.textTertiary },
  colHeaderRight: { width: 100, fontFamily: FONT, fontSize: 12, fontWeight: '400', color: Colors.textTertiary, textAlign: 'center' },

  scroll: { flex: 1 },

  // Section
  section: {
    marginHorizontal: Spacing.lg, marginBottom: Spacing.sm,
    backgroundColor: Colors.bgPrimary, borderRadius: BorderRadius.md, ...Shadows.small, overflow: 'hidden',
  },

  // Row
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  checkName: { fontFamily: FONT, fontSize: 14, fontWeight: '400', color: Colors.textPrimary },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // Date box
  dateBox: { width: 100, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 6, alignItems: 'center' },
  dateText: { fontFamily: FONT, fontSize: 13, fontWeight: '400' },

  // Edit button
  editBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },

  // Empty
  emptyRow: { paddingVertical: 12, alignItems: 'center' },
  emptyText: { fontFamily: FONT, fontSize: 13, fontWeight: '400', color: Colors.textTertiary, fontStyle: 'italic' },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', paddingHorizontal: 24 },
  modalCard: { backgroundColor: Colors.bgPrimary, borderRadius: BorderRadius.xl, padding: Spacing.lg, ...Shadows.large },
  modalTitle: { fontFamily: FONT, fontSize: 16, fontWeight: '400', color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.md },
  pilotRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 11, paddingHorizontal: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  pilotRowActive: { backgroundColor: Colors.bgTertiary },
  pilotText: { fontFamily: FONT, fontSize: 15, fontWeight: '400', color: Colors.textPrimary },
  pilotTextActive: { color: Colors.primary },
  modalClose: { marginTop: Spacing.md, paddingVertical: 11, borderRadius: BorderRadius.sm, backgroundColor: Colors.bgTertiary, alignItems: 'center' },
  modalCloseText: { fontFamily: FONT, fontSize: 15, fontWeight: '400', color: Colors.textPrimary },
});
