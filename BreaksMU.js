import React, { useContext, useEffect, useState } from 'react';
import {
  SafeAreaView, View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Modal, FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthCtx } from './contexts';
import { getBreaksDataFromSupabase, getAllPilotsFromSupabase } from './supabaseData';
import { Colors, Shadows, BorderRadius, Spacing, FONT } from './theme';
import ThemedAlert from './ThemedAlert';

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

export default function BreaksMU({ route, navigation }) {
  const { auth } = useContext(AuthCtx);
  const { pib: routePib, isAdmin } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({});
  const [selectedPilot, setSelectedPilot] = useState(routePib || auth?.pib || '');
  const [pilots, setPilots] = useState([]);
  const [showPilotSelector, setShowPilotSelector] = useState(false);

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
      ThemedAlert.alert('Помилка', String(e.message || e));
      setData({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [selectedPilot]);

  const cleanName = (n) => n.replace(/^.*?\d{4}\s*\d{2}:\d{2}:\d{2}.*?\)\s*/, '').trim();
  const currentIsAdmin = isAdmin || (auth?.role === 'admin');
  const muData = data.mu || {};
  const muTypes = ['ДПМУ', 'ДСМУ', 'ДВМП', 'НПМУ', 'НСМУ', 'НВМП'];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Перерви за МУ</Text>
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
        <Text style={styles.headerTitle}>Перерви за МУ</Text>
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
        <Text style={styles.colHeaderLeft}>Тип ЛА</Text>
        <Text style={styles.colHeaderCenter}>Останнiй полiт</Text>
        <Text style={styles.colHeaderRight}>Дiйсний до</Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {muTypes.map((muType) => {
          const items = muData[muType] || [];
          return (
            <View key={muType} style={styles.section}>
              {/* Section title */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{muType}</Text>
              </View>

              {/* Items */}
              {items.length > 0 ? items.map((item, idx) => {
                const s = getStatus(item.color);
                return (
                  <View
                    key={idx}
                    style={[styles.row, idx === items.length - 1 && styles.rowLast]}
                  >
                    {/* Status dot + aircraft */}
                    <View style={styles.rowLeft}>
                      <View style={[styles.dot, { backgroundColor: s.dot }]} />
                      <Text style={styles.aircraftText}>
                        {item.aircraft || '—'}
                      </Text>
                    </View>

                    {/* Dates */}
                    <View style={styles.rowRight}>
                      <View style={[styles.dateBox, { backgroundColor: s.bg }]}>
                        <Text style={[styles.dateText, { color: s.text }]}>
                          {item.date || '—'}
                        </Text>
                      </View>
                      <View style={[styles.dateBox, styles.expiryBox, { backgroundColor: s.bg }]}>
                        <Text style={[styles.dateText, { color: s.text }]}>
                          {item.expiryDate || '—'}
                        </Text>
                      </View>
                    </View>
                  </View>
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

  // Section (one MU type)
  section: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.bgPrimary,
    borderRadius: BorderRadius.md,
    ...Shadows.small,
    overflow: 'hidden',
  },
  sectionHeader: {
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
  expiryBox: {
    // slightly different styling can go here if needed
  },
  dateText: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '400',
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
