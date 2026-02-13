import React, { useContext, useEffect, useState } from 'react';
import {
  SafeAreaView, View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Modal, FlatList
} from 'react-native';
import CustomCalendar from './components/CustomCalendar';
import { Ionicons } from '@expo/vector-icons';
import { AuthCtx } from './contexts';
import { getBreaksDataFromSupabase, getAllPilotsFromSupabase, updateCommissionDateInSupabase } from './supabaseData';
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

// Simple commission categories (single-row or multi-row)
const SIMPLE_CATEGORIES = [
  'Аварійне залишення',
  'Ст. 205 ПРІАЗ',
  'Відпустка',
  'Стрибки з парашутом',
];

const MULTI_ROW = new Set(['Ст. 205 ПРІАЗ']);

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

const CommissionTable = ({ navigation, route }) => {
  const { auth } = useContext(AuthCtx);
  const { pib: routePib, isAdmin } = route?.params || {};

  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [pilots, setPilots] = useState([]);
  const [showPilotSelector, setShowPilotSelector] = useState(false);
  const [selectedPilot, setSelectedPilot] = useState(routePib || auth?.pib || '');

  // Date editing
  const [editingItem, setEditingItem] = useState(null);
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
      const res = await getBreaksDataFromSupabase(selectedPilot);
      if (!res?.ok) throw new Error(res?.error || 'Помилка');
      setData(res.data || {});
    } catch (e) {
      ThemedAlert.alert('Помилка', String(e.message || e));
      setData({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [selectedPilot]);

  const cleanName = (n) => n.replace(/^.*?\d{4}\s*\d{2}:\d{2}:\d{2}.*?\)\s*/, '').trim();
  const currentIsAdmin = isAdmin || (auth?.role === 'admin');
  const commission = data.commission || {};

  // Date editing handlers
  const handleEditDate = (category, aircraft, currentDate) => {
    setEditingItem({ category, aircraft });
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
    if (!date || !editingItem) return;
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const formatted = `${day}.${month}.${year}`;
    setShowDatePicker(false);
    setEditingItem(null);
    try {
      const result = await updateCommissionDateInSupabase(
        selectedPilot, editingItem.category, formatted,
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

  // ЛЛК/УМО data
  const llkUmo = commission['ЛЛК/УМО'] || {};
  const llkData = llkUmo.llk;
  const umoData = llkUmo.umo;
  const llkStatus = getStatus(llkData?.color);
  const umoStatus = getStatus(umoData?.color);
  const nextStatus = getStatus(llkUmo.nextColor);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Таблиця комісування</Text>
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
        <Text style={styles.headerTitle}>Таблиця комісування</Text>
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
        <Text style={styles.colHeaderLeft}></Text>
        <Text style={styles.colHeaderCenter}>Дата</Text>
        <Text style={styles.colHeaderRight}>Дiйсний до</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Simple categories before ЛЛК/УМО */}
        {['Аварійне залишення', 'Ст. 205 ПРІАЗ'].map((cat) => renderSimpleSection(cat, commission, handleEditDate))}

        {/* ЛЛК / УМО — special block */}
        <View style={styles.section}>
          {/* Section header with ЛЛК / УМО labels */}
          <View style={styles.llkUmoSectionHeader}>
            <View style={{ flex: 1 }} />
            <View style={styles.llkUmoLabelGroup}>
              <Text style={styles.llkUmoHeaderLabel}>ЛЛК</Text>
              <View style={{ width: 28 }} />
            </View>
            <View style={styles.llkUmoLabelGroup}>
              <Text style={styles.llkUmoHeaderLabel}>ПМО</Text>
              <View style={{ width: 28 }} />
            </View>
          </View>

          {/* Dates row */}
          <View style={styles.llkUmoRow}>
            <View style={styles.rowLeft}>
              <View style={[styles.dot, { backgroundColor: (llkData || umoData) ? nextStatus.dot : STATUS.gray.dot }]} />
            </View>
            <View style={styles.llkUmoDates}>
              {/* ЛЛК date + edit */}
              <View style={styles.llkUmoDateItem}>
                <TouchableOpacity
                  style={[styles.dateBox, { backgroundColor: llkStatus.bg }]}
                  onPress={() => handleEditDate('ЛЛК', null, llkData?.date || '')}
                >
                  <Text style={[styles.dateText, { color: llkStatus.text }]}>
                    {llkData?.date || '—'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => handleEditDate('ЛЛК', null, llkData?.date || '')}
                >
                  <Ionicons name="create-outline" size={14} color={Colors.textTertiary} />
                </TouchableOpacity>
              </View>

              {/* УМО date + edit */}
              <View style={styles.llkUmoDateItem}>
                <TouchableOpacity
                  style={[styles.dateBox, { backgroundColor: umoStatus.bg }]}
                  onPress={() => handleEditDate('УМО', null, umoData?.date || '')}
                >
                  <Text style={[styles.dateText, { color: umoStatus.text }]}>
                    {umoData?.date || '—'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => handleEditDate('УМО', null, umoData?.date || '')}
                >
                  <Ionicons name="create-outline" size={14} color={Colors.textTertiary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Next due line */}
          {llkUmo.nextType && (
            <Text style={styles.nextDueText}>
              Наступне {llkUmo.nextType}: {llkUmo.nextDate}
            </Text>
          )}
        </View>

        {/* Simple categories after ЛЛК/УМО */}
        {['Відпустка', 'Стрибки з парашутом'].map((cat) => renderSimpleSection(cat, commission, handleEditDate))}

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
        onClose={() => { setShowDatePicker(false); setEditingItem(null); }}
      />
    </SafeAreaView>
  );
};

// Render a simple (non-ЛЛК/УМО) section
function renderSimpleSection(cat, commission, handleEditDate) {
  const items = commission[cat] || [];
  const isMulti = MULTI_ROW.has(cat);

  return (
    <View key={cat} style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{cat}</Text>
      </View>

      {isMulti ? (
        items.length > 0 ? items.map((item, idx) => {
          const s = getStatus(item.color);
          return (
            <View key={idx} style={[styles.row, idx === items.length - 1 && styles.rowLast]}>
              <View style={styles.rowLeft}>
                <View style={[styles.dot, { backgroundColor: s.dot }]} />
                <Text style={styles.labelText}>{item.aircraft || '—'}</Text>
              </View>
              <View style={styles.rowRight}>
                <View style={[styles.dateBox, { backgroundColor: s.bg }]}>
                  <Text style={[styles.dateText, { color: s.text }]}>{item.date || '—'}</Text>
                </View>
                <View style={[styles.dateBox, { backgroundColor: s.bg }]}>
                  <Text style={[styles.dateText, { color: s.text }]}>{item.expiryDate || '—'}</Text>
                </View>
                <TouchableOpacity style={styles.editBtn} onPress={() => handleEditDate(cat, item.aircraft, item.date)}>
                  <Ionicons name="create-outline" size={16} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          );
        }) : (
          <View style={styles.emptyRow}>
            <Text style={styles.emptyText}>Немає даних</Text>
          </View>
        )
      ) : (
        (() => {
          const item = items.length > 0 ? items[0] : null;
          const s = getStatus(item?.color);
          return (
            <View style={[styles.row, styles.rowLast]}>
              <View style={styles.rowLeft}>
                <View style={[styles.dot, { backgroundColor: s.dot }]} />
              </View>
              <View style={styles.rowRight}>
                <View style={[styles.dateBox, { backgroundColor: s.bg }]}>
                  <Text style={[styles.dateText, { color: s.text }]}>{item?.date || '—'}</Text>
                </View>
                <View style={[styles.dateBox, { backgroundColor: s.bg }]}>
                  <Text style={[styles.dateText, { color: s.text }]}>{item?.expiryDate || '—'}</Text>
                </View>
                <TouchableOpacity style={styles.editBtn} onPress={() => handleEditDate(cat, null, item?.date || '')}>
                  <Ionicons name="create-outline" size={16} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })()
      )}
    </View>
  );
}

export default CommissionTable;

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
  colHeaderCenter: { width: 100, fontFamily: FONT, fontSize: 12, fontWeight: '400', color: Colors.textTertiary, textAlign: 'center' },
  colHeaderRight: { width: 100, fontFamily: FONT, fontSize: 12, fontWeight: '400', color: Colors.textTertiary, textAlign: 'center', marginLeft: 6 },

  scroll: { flex: 1 },

  // Section
  section: {
    marginHorizontal: Spacing.lg, marginBottom: Spacing.sm,
    backgroundColor: Colors.bgPrimary, borderRadius: BorderRadius.md, ...Shadows.small, overflow: 'hidden',
  },
  sectionHeader: {
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    backgroundColor: Colors.bgTertiary, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  sectionTitle: { fontFamily: FONT, fontSize: 14, fontWeight: '400', color: Colors.textPrimary, letterSpacing: 0.5 },

  // Row
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  labelText: { fontFamily: FONT, fontSize: 14, fontWeight: '400', color: Colors.textPrimary },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // Date box
  dateBox: { width: 100, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 6, alignItems: 'center' },
  dateText: { fontFamily: FONT, fontSize: 13, fontWeight: '400' },

  // Edit button
  editBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },

  // ЛЛК/УМО special
  llkUmoSectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    backgroundColor: Colors.bgTertiary, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  llkUmoHeaderLabel: {
    width: 100, fontFamily: FONT, fontSize: 14, fontWeight: '400',
    color: Colors.textPrimary, textAlign: 'center', letterSpacing: 0.5,
  },
  llkUmoRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 6,
  },
  llkUmoLabelGroup: { flexDirection: 'row', alignItems: 'center' },
  llkUmoDateItem: { flexDirection: 'row', alignItems: 'center' },
  llkUmoDates: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // Next due text
  nextDueText: {
    fontFamily: FONT, fontSize: 13, fontWeight: '400',
    color: Colors.textSecondary, textAlign: 'center',
    paddingVertical: 8, paddingHorizontal: Spacing.md,
  },

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
