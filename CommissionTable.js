import React, { useContext, useEffect, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Platform,
  ScrollView,
  ActivityIndicator,
  Modal,
  FlatList
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AuthCtx } from './App';
import api from './api';

const FONT = 'NewsCycle-Regular';

const CommissionTable = ({ navigation, route }) => {
  const { auth } = useContext(AuthCtx);
  const { pib: routePib, isAdmin } = route?.params || {};
  
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [allRecords, setAllRecords] = useState([]);
  const [showPilotModal, setShowPilotModal] = useState(false);
  const [selectedPilot, setSelectedPilot] = useState(routePib || auth?.pib || '');
  const [editingItem, setEditingItem] = useState(null);
  const [editDate, setEditDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Список категорій комісування з правильними назвами для API
  const commissionCategories = [
    'Аварійне залишення',
    'Ст. 205 ПРІАЗ',
    'Льотна комісія',        // Окрема категорія
    'Поглиблений огляд',     // Окрема категорія
    'Відпустка',
    'Стрибки з парашутом'
  ];

  useEffect(() => {
    loadPilots();
  }, []);

  useEffect(() => {
    if (selectedPilot) {
      loadData();
    }
  }, [selectedPilot]);

  const loadPilots = async () => {
    const currentIsAdmin = isAdmin || (auth?.role === 'admin');
    
    if (!currentIsAdmin) {
      setAllRecords([auth?.pib || '']);
      return;
    }

    try {
      // Спочатку пробуємо завантажити з валідації
      const result = await api.getValidationPilots(auth.token);
      if (result?.ok && result.pilots) {
        setAllRecords(result.pilots);
        return;
      }
      
      // Fallback до getAllPilots
      const fallbackResult = await api.getAllPilots(auth.token);
      if (fallbackResult?.ok && fallbackResult.pilots) {
        setAllRecords(fallbackResult.pilots);
      }
    } catch (error) {
      console.error('Помилка завантаження льотчиків:', error);
      setAllRecords([auth?.pib || '']);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await api.getBreaksData(auth.token, selectedPilot);
      
      if (result?.ok) {
        console.log('Дані комісування:', JSON.stringify(result.data?.commission, null, 2));
        setData(result.data || {});
      } else {
        Alert.alert('Помилка', result?.error || 'Помилка завантаження даних');
      }
    } catch (error) {
      console.error('Помилка завантаження даних комісування:', error);
      Alert.alert('Помилка', 'Не вдалося завантажити дані');
    } finally {
      setLoading(false);
    }
  };

  const handleEditDate = (category, aircraft, currentDate) => {
    console.log('Відкриваємо редагування:', category, aircraft, currentDate);
    setEditingItem({ category, aircraft });
    
    // Парсимо поточну дату або встановлюємо сьогоднішню
    if (currentDate && currentDate.trim()) {
      try {
        const parts = currentDate.split('.');
        if (parts.length === 3) {
          const day = parseInt(parts[0]);
          const month = parseInt(parts[1]) - 1; // Місяці в JS починаються з 0
          const year = parseInt(parts[2]);
          setSelectedDate(new Date(year, month, day));
        } else {
          setSelectedDate(new Date());
        }
      } catch (e) {
        setSelectedDate(new Date());
      }
    } else {
      setSelectedDate(new Date());
    }
    
    setEditDate(currentDate || '');
    setShowDatePicker(true);
  };

  const onDateChange = (event, date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    
    if (date) {
      setSelectedDate(date);
      // Форматуємо дату в ДД.ММ.РРРР 
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      setEditDate(`${day}.${month}.${year}`);
    }
  };

  const saveDate = async () => {
    if (!editingItem) return;
    
    try {
      // ВИПРАВЛЕНА логіка для передачі правильної категорії
      let categoryToSend = editingItem.category;
      
      // Для складних категорій додаємо тип ЛА
      if (editingItem.aircraft && editingItem.category === 'Ст. 205 ПРІАЗ') {
        categoryToSend = `${editingItem.category}_${editingItem.aircraft}`;
      }
      
      console.log('Відправляємо на сервер:', {
        pib: selectedPilot,
        category: categoryToSend,
        date: editDate
      });
      
      const result = await api.updateCommissionDate(auth.token, selectedPilot, categoryToSend, editDate);
      
      if (result?.ok) {
        Alert.alert('Успіх', 'Дату відредаговано', [
          { text: 'OK', onPress: () => {
            setEditingItem(null);
            setEditDate('');
            setShowDatePicker(false);
            loadData(); // Перезавантажуємо дані
          }}
        ]);
      } else {
        Alert.alert('Помилка', result?.error || 'Не вдалося оновити дату');
      }
    } catch (error) {
      console.error('Помилка оновлення дати:', error);
      Alert.alert('Помилка', 'Не вдалося оновити дату');
    }
  };

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

  const formatDate = (dateStr) => {
    if (!dateStr || dateStr.trim() === '') return '';
    
    try {
      if (dateStr.includes('GMT')) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('uk-UA');
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  };

  const cleanPilotName = (name) => {
    return name.replace(/^.*?\d{4}\s*\d{2}:\d{2}:\d{2}.*?\)\s*/, '').trim();
  };

  // Компонент для відображення складних категорій (як в BreaksMU)
  const ComplexDataCard = ({ title, items }) => (
    <View style={styles.card}>
      <Text style={[styles.cardTitle, { fontFamily: FONT }]}>{title}</Text>
      <View style={styles.itemsContainer}>
        {items.map((item, index) => {
          const hasDate = item.date && item.date.trim() !== '';
          const colorStyle = getColorStyle(item.color);
          
          return (
            <View key={index} style={styles.itemRow}>
              <Text style={[styles.aircraftText, { fontFamily: FONT }]}>
                {item.aircraft || 'Загальний'}
              </Text>
              
              <View style={styles.dateSection}>
                {hasDate ? (
                  <TouchableOpacity 
                    style={[styles.dateChip, colorStyle]}
                    onPress={() => handleEditDate(title, item.aircraft, item.date)}
                  >
                    <Text style={[styles.dateText, { 
                      fontFamily: FONT, 
                      color: colorStyle.color 
                    }]}>
                      {formatDate(item.date)}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity 
                    style={styles.emptyDateChip}
                    onPress={() => handleEditDate(title, item.aircraft, '')}
                  >
                    <Text style={[styles.dashText, { fontFamily: FONT }]}>—</Text>
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity 
                  style={styles.editIcon}
                  onPress={() => handleEditDate(title, item.aircraft, item.date)}
                >
                  <Text style={styles.pencilIcon}>✎</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
        
        {items.length === 0 && (
          <TouchableOpacity 
            style={styles.itemRow}
            onPress={() => handleEditDate(title, null, '')}
          >
            <Text style={[styles.noDataText, { fontFamily: FONT }]}>
              Немає даних
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  // Компонент для звичайних категорій (одна дата)
  const SimpleDataCard = ({ title }) => {
    // Отримуємо дані для простих категорій
    let commissionData = [];
    
    if (title === 'Льотна комісія') {
      // Перший елемент з ЛЛК/УМО
      const llkData = data?.commission?.['ЛЛК/УМО'] || [];
      commissionData = llkData.length > 0 ? [llkData[0]] : [];
    } else if (title === 'Поглиблений огляд') {
      // Другий елемент з ЛЛК/УМО
      const llkData = data?.commission?.['ЛЛК/УМО'] || [];
      commissionData = llkData.length > 1 ? [llkData[1]] : [];
    } else {
      // Звичайні категорії
      commissionData = data?.commission?.[title] || [];
    }
    
    const mainData = commissionData.length > 0 ? commissionData[0] : {};
    const hasDate = mainData.date && typeof mainData.date === 'string' && mainData.date.trim() !== '';
    
    return (
      <View style={styles.card}>
        <Text style={[styles.cardTitle, { fontFamily: FONT }]}>{title}</Text>
        
        <View style={styles.dateSection}>
          {hasDate ? (
            <TouchableOpacity 
              style={[styles.dateChip, getColorStyle(mainData.color)]}
              onPress={() => handleEditDate(title, null, mainData.date)}
            >
              <Text style={[styles.dateText, { 
                fontFamily: FONT, 
                color: getColorStyle(mainData.color).color 
              }]}>
                {formatDate(mainData.date)}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.emptyDateChip}
              onPress={() => handleEditDate(title, null, '')}
            >
              <Text style={[styles.dashText, { fontFamily: FONT }]}>—</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            style={styles.editIcon}
            onPress={() => handleEditDate(title, null, mainData.date)}
          >
            <Text style={styles.pencilIcon}>✎</Text>
          </TouchableOpacity>
        </View>
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

  const EditDateModal = () => (
    <Modal visible={!!editingItem} transparent animationType="slide">
      <View style={styles.modalBackdrop}>
        <View style={styles.editModalCard}>
          <Text style={[styles.editModalTitle, { fontFamily: FONT }]}>
            Вибір дати
          </Text>
          <Text style={[styles.editModalSubtitle, { fontFamily: FONT }]}>
            {editingItem?.category}
            {editingItem?.aircraft && ` (${editingItem.aircraft})`}
          </Text>
          
          {/* Показуємо календар */}
          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onDateChange}
              style={styles.datePicker}
            />
          )}
          
          {/* Показуємо вибрану дату */}
          {editDate && (
            <View style={styles.selectedDateContainer}>
              <Text style={[styles.selectedDateLabel, { fontFamily: FONT }]}>
                Вибрана дата:
              </Text>
              <Text style={[styles.selectedDateText, { fontFamily: FONT }]}>
                {editDate}
              </Text>
            </View>
          )}
          
          {/* На iOS показуємо кнопку для відкриття календаря */}
          {Platform.OS === 'ios' && !showDatePicker && (
            <TouchableOpacity
              style={styles.showCalendarButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={[styles.showCalendarButtonText, { fontFamily: FONT }]}>
                Відкрити календар
              </Text>
            </TouchableOpacity>
          )}
          
          <View style={styles.editButtonsRow}>
            <TouchableOpacity
              style={[styles.editButton, styles.cancelButton]}
              onPress={() => {
                setEditingItem(null);
                setEditDate('');
                setShowDatePicker(false);
              }}
            >
              <Text style={[styles.editButtonText, { fontFamily: FONT }]}>Скасувати</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.editButton, styles.saveButton]}
              onPress={saveDate}
              disabled={!editDate}
            >
              <Text style={[styles.editButtonText, { fontFamily: FONT, color: '#FFFFFF' }]}>
                Підтвердити
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.title, { fontFamily: FONT }]}>Таблиця комісування</Text>
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
            Завантаження даних комісування...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentIsAdmin = isAdmin || (auth?.role === 'admin');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { fontFamily: FONT }]}>Таблиця комісування</Text>
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
            onPress={() => setShowPilotModal(true)}
          >
            <Text style={[styles.filterButtonText, { fontFamily: FONT }]}>
              {cleanPilotName(selectedPilot) || 'Оберіть льотчика'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          {commissionCategories.map((category, index) => {
            // Складна категорія - показуємо типи ЛА
            if (category === 'Ст. 205 ПРІАЗ') {
              const categoryData = (data.commission && data.commission[category]) ? data.commission[category] : [];
              return (
                <ComplexDataCard
                  key={index}
                  title={category}
                  items={categoryData}
                />
              );
            }
            
            // Прості категорії
            return (
              <SimpleDataCard key={index} title={category} />
            );
          })}
        </View>
      </ScrollView>

      <PilotSelector
        pilots={allRecords}
        selectedPilot={selectedPilot}
        onSelect={(pilot) => {
          setSelectedPilot(pilot);
          setShowPilotModal(false);
        }}
        visible={showPilotModal}
        onClose={() => setShowPilotModal(false)}
      />

      <EditDateModal />
    </SafeAreaView>
  );
};

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
  itemsContainer: {
    width: '100%',
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  aircraftText: {
    fontSize: 16,
    color: '#374151',
    flex: 1,
  },
  dateSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  editIcon: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#374151',
  },
  pencilIcon: {
    fontSize: 16,
    color: '#374151',
    fontWeight: 'bold',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '500',
  },
  dashText: {
    fontSize: 24,
    color: '#9CA3AF',
  },
  noDataText: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    fontStyle: 'italic',
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
  editModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    margin: 20,
    maxWidth: '90%',
    minWidth: '80%',
  },
  editModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  editModalSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  editButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  editButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  saveButton: {
    backgroundColor: '#10B981',
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  datePicker: {
    width: '100%',
    marginVertical: 20,
  },
  selectedDateContainer: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 8,
    marginVertical: 16,
    alignItems: 'center',
  },
  selectedDateLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  selectedDateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  showCalendarButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 16,
  },
  showCalendarButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default CommissionTable;