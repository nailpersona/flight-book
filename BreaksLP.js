import React, { useContext, useEffect, useState } from 'react';
import {
  SafeAreaView, View, Text, TouchableOpacity, Alert, StyleSheet, Platform,
  ScrollView, ActivityIndicator, Modal, FlatList
} from 'react-native';
import { AuthCtx } from './App';
import api from './api';

const FONT = 'NewsCycle-Regular';
const DARK = '#333';

// Колір фону залежно від статусу
const getColorStyle = (color) => {
  switch (color) {
    case 'green': return { backgroundColor: '#10B981', color: '#fff' };
    case 'yellow': return { backgroundColor: '#F59E0B', color: '#fff' };
    case 'red': return { backgroundColor: '#EF4444', color: '#fff' };
    default: return { backgroundColor: '#E5E7EB', color: '#374151' };
  }
};

const ActionButton = ({ title, style, onPress, disabled }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.9} disabled={disabled}
    style={[styles.btn, style, disabled && { opacity: 0.6 }]}>
    <Text style={[styles.btnText, { fontFamily: FONT }]}>{title}</Text>
  </TouchableOpacity>
);

const DataCard = ({ title, items }) => {
  // Беремо перший елемент для показу однієї дати
  const mainItem = items.length > 0 ? items[0] : null;
  const hasDate = mainItem && mainItem.date && mainItem.date.trim() !== '';
  
  return (
    <View style={styles.card}>
      {/* Тільки назва виду ЛП по центру */}
      <Text style={[styles.cardTitle, { fontFamily: FONT }]}>{title}</Text>
      
      {/* Тільки дата з кольором або прочерк - БЕЗ НАЗВ ЛІТАКІВ */}
      {hasDate ? (
        <View style={[styles.dateChip, getColorStyle(mainItem.color)]}>
          <Text style={[styles.dateText, { 
            fontFamily: FONT, 
            color: getColorStyle(mainItem.color).color 
          }]}>
            {mainItem.date}
          </Text>
        </View>
      ) : (
        <Text style={[styles.dashText, { fontFamily: FONT }]}>—</Text>
      )}
    </View>
  );
};

const PilotSelector = ({ pilots, selectedPilot, onSelect, visible, onClose }) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.modalBackdrop}>
      <View style={styles.modalCard}>
  <FlatList
          data={pilots}
          keyExtractor={(item, idx) => item + '_' + idx}
          style={{ maxHeight: 400 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => onSelect(item)}
              style={[
                styles.pilotRow,
                selectedPilot === item && styles.selectedPilotRow
              ]}
            >
              <Text style={[
                styles.pilotText,
                { fontFamily: FONT },
                selectedPilot === item && styles.selectedPilotText
              ]}>
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />

        <ActionButton
          title="ЗАКРИТИ"
          onPress={onClose}
          style={{ backgroundColor: '#7B7B7B', marginTop: 10 }}
        />
      </View>
    </View>
  </Modal>
);

export default function BreaksLP({ route, navigation }) {
  const { auth } = useContext(AuthCtx);
  const { pib: routePib, isAdmin } = route.params || {};
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({});
  const [selectedPilot, setSelectedPilot] = useState(routePib || auth?.pib || '');
  const [pilots, setPilots] = useState([]);
  const [showPilotSelector, setShowPilotSelector] = useState(false);

  // Завантаження списку пілотів для адміна
 
useEffect(() => {
  const loadPilots = async () => {
    if (!isAdmin || !auth?.token) return;
    
    try {
      // Спочатку пробуємо завантажити з валідації
      const result = await api.getValidationPilots(auth.token);
      if (result?.ok && result.pilots) {
        setPilots(result.pilots);
        return;
      }
      
      // Fallback до getAllPilots
      const fallbackResult = await api.getAllPilots(auth.token);
      if (fallbackResult?.ok && fallbackResult.pilots) {
        setPilots(fallbackResult.pilots);
      }
    } catch (error) {
      console.warn('Помилка завантаження списку пілотів:', error);
      setPilots([]);
    }
  };
  
  loadPilots();
}, [isAdmin, auth?.token]);

  // Завантаження даних перерв
  const loadData = async () => {
    if (!auth?.token || !selectedPilot) return;

    try {
      setLoading(true);
      const result = await api.getBreaksData(auth.token, selectedPilot);
      
      if (!result?.ok) {
        throw new Error(result?.error || 'Помилка завантаження даних');
      }
      
      // Логування для діагностики
      console.log('Дані з API (BreaksLP):', JSON.stringify(result.data, null, 2));
      
      setData(result.data || {});
    } catch (error) {
      Alert.alert('Помилка', String(error.message || error));
      setData({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedPilot, auth?.token]);

  const handlePilotSelect = (pilot) => {
    setSelectedPilot(pilot);
    setShowPilotSelector(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={DARK} />
          <Text style={[styles.loadingText, { fontFamily: FONT }]}>
            Завантаження даних перерв за видами ЛП...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Змінено: використовуємо data.lp замість data.mu
  const lpData = data.lp || {};
  // Змінено: категорії для льотної практики
  const lpTypes = [
    'Складний пілотаж',
    'Мала висота', 
    'Гр. мала висота (ОНБ)',
    'Бойове застосування',
    'Групова злітаність',
    'На десантування'
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        {/* Змінено заголовок */}
        <Text style={[styles.title, { fontFamily: FONT }]}>Перерви за видами ЛП</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { fontFamily: FONT }]}>Назад</Text>
        </TouchableOpacity>
      </View>

      {isAdmin && (
        <View style={styles.pilotSelectorContainer}>
          <Text style={[styles.selectorLabel, { fontFamily: FONT }]}>Льотчик:</Text>
          <TouchableOpacity 
            style={styles.pilotSelectorBtn}
            onPress={() => setShowPilotSelector(true)}
          >
            <Text style={[styles.pilotSelectorText, { fontFamily: FONT }]}>
              {selectedPilot || 'Оберіть льотчика'}
            </Text>
            <Text style={styles.selectorCaret}>▾</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Змінено: використовуємо lpTypes та lpData */}
        {lpTypes.map(lpType => (
          <DataCard
            key={lpType}
            title={lpType}
            items={lpData[lpType] || []}
          />
        ))}
        
        <View style={{ height: 20 }} />
      </ScrollView>

      <PilotSelector
        pilots={pilots}
        selectedPilot={selectedPilot}
        onSelect={handlePilotSelect}
        visible={showPilotSelector}
        onClose={() => setShowPilotSelector(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F6F8' },
  
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6B7280',
  },

  header: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 8 : 6,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  backBtn: {
    backgroundColor: DARK,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  pilotSelectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  selectorLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  pilotSelectorBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pilotSelectorText: {
    fontSize: 16,
    color: '#111827',
  },
  selectorCaret: {
    fontSize: 16,
    color: '#6B7280',
  },

  content: {
    flex: 1,
    paddingHorizontal: 16,
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    alignItems: 'center', // Центруємо вміст
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center', // Назва по центру
  },
  
  // Новий контейнер для дати
  dateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  dateChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 120,
    alignItems: 'center',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Стиль для прочерка
  dashText: {
    fontSize: 24,
    color: '#9CA3AF',
    textAlign: 'center',
  },

  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    color: '#111827',
    textAlign: 'center',
  },
  
  pilotRow: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  selectedPilotRow: {
    backgroundColor: '#EBF8FF',
  },
  pilotText: {
    fontSize: 16,
    color: '#111827',
  },
  selectedPilotText: {
    fontWeight: '600',
    color: '#1D4ED8',
  },

  btn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  btnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});