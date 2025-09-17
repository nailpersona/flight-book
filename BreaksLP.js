import React, { useContext, useEffect, useState } from 'react';
import {
  SafeAreaView, View, Text, TouchableOpacity, Alert, StyleSheet, Platform,
  ScrollView, ActivityIndicator, Modal, FlatList
} from 'react-native';
import { AuthCtx } from './App';
import api from './api';

const FONT = 'NewsCycle-Regular';

// Колір фону залежно від статусу - як у BreaksMU
const getColorStyle = (color) => {
  switch (color) {
    case 'red':
      return { backgroundColor: '#EF4444', color: '#FFFFFF' };
    case 'yellow':
      return { backgroundColor: '#F59E0B', color: '#000000' };
    case 'green':
      return { backgroundColor: '#10B981', color: '#FFFFFF' };
    default:
      return { backgroundColor: '#F3F4F6', color: '#6B7280' };
  }
};

const ActionButton = ({ title, style, onPress, disabled }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.9} disabled={disabled}
    style={[styles.btn, style, disabled && { opacity: 0.6 }]}>
    <Text style={[styles.btnText, { fontFamily: FONT }]}>{title}</Text>
  </TouchableOpacity>
);

// Оновлена DataCard за стилем BreaksMU
const DataCard = ({ title, items }) => {
  // Беремо перший елемент для показу однієї дати
  const mainItem = items.length > 0 ? items[0] : null;
  const hasDate = mainItem && mainItem.date && mainItem.date.trim() !== '' && mainItem.date !== 'Немає даних';
  const colorStyle = getColorStyle(mainItem?.color);

  return (
    <View style={styles.card}>
      <Text style={[styles.cardTitle, { fontFamily: FONT }]}>{title}</Text>
      
      <View style={styles.dateSection}>
        {hasDate ? (
          <View style={[styles.dateChip, colorStyle]}>
            <Text style={[styles.dateText, { 
              fontFamily: FONT, 
              color: colorStyle.color 
            }]}>
              {mainItem.date}
            </Text>
          </View>
        ) : (
          <View style={styles.emptyDateChip}>
            <Text style={[styles.dashText, { fontFamily: FONT }]}>—</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const PilotSelector = ({ pilots, selectedPilot, onSelect, visible, onClose }) => {
  const cleanPilotName = (name) => {
    return name.replace(/^.*?\d{4}\s*\d{2}:\d{2}:\d{2}.*?\)\s*/, '').trim();
  };

  return (
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
                  {cleanPilotName(item)}
                </Text>
              </TouchableOpacity>
            )}
          />

          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <Text style={[styles.closeButtonText, { fontFamily: FONT }]}>ЗАКРИТИ</Text>
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

  const cleanPilotName = (name) => {
    return name.replace(/^.*?\d{4}\s*\d{2}:\d{2}:\d{2}.*?\)\s*/, '').trim();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.title, { fontFamily: FONT }]}>Перерви за видами ЛП</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.backButtonText, { fontFamily: FONT }]}>Назад</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={[styles.loadingText, { fontFamily: FONT }]}>
            Завантаження даних перерв за видами ЛП...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Використовуємо data.lp замість data.mu
  const lpData = data.lp || {};
  // Категорії для льотної практики
  const lpTypes = [
    'Складний пілотаж',
    'Мала висота', 
    'Гр. мала висота (ОНБ)',
    'Бойове застосування',
    'Групова злітаність',
    'На десантування'
  ];
  const currentIsAdmin = isAdmin || (auth?.role === 'admin');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { fontFamily: FONT }]}>Перерви за видами ЛП</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.backButtonText, { fontFamily: FONT }]}>Назад</Text>
        </TouchableOpacity>
      </View>

      {currentIsAdmin && (
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowPilotSelector(true)}
          >
            <Text style={[styles.filterButtonText, { fontFamily: FONT }]}>
              {cleanPilotName(selectedPilot) || 'Оберіть льотчика'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          {lpTypes.map(lpType => (
            <DataCard
              key={lpType}
              title={lpType}
              items={lpData[lpType] || []}
            />
          ))}
        </View>
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
  container: {
    flex: 1,
    backgroundColor: '#F4F6F8',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1F2937',
  },
  backButton: {
    backgroundColor: '#6B7280',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  filterContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterButton: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
  },
  filterButtonText: {
    fontSize: 16,
    color: '#374151',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  dateSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  emptyDateChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '500',
  },
  dashText: {
    fontSize: 24,
    color: '#9CA3AF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    margin: 20,
    maxWidth: '90%',
    minWidth: '80%',
  },
  pilotRow: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  selectedPilotRow: {
    backgroundColor: '#EBF8FF',
  },
  pilotText: {
    fontSize: 16,
    color: '#374151',
  },
  selectedPilotText: {
    color: '#1D4ED8',
    fontWeight: '500',
  },
  closeButton: {
    backgroundColor: '#6B7280',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
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
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
});