// FixedTabNavigator.js — таби зафіксовані зверху на всіх екранах
import React, { useState, useRef, createContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Colors, FONT } from './theme';
import { rootNavigationRef, InboxBadgeCtx } from './contexts';

// Екрани
import MainScreen from './Main';
import ProfileScreen from './Profile';
import SettingsScreen from './Settings';
import AdminUsersScreen from './AdminUsers';
import AdminSettingsScreen from './AdminSettings';
import MyRecordsScreen from './MyRecords';
import FlightSummaryScreen from './FlightSummary';
import BreaksMUScreen from './BreaksMU';
import BreaksLPScreen from './BreaksLP';
import CommissionTableScreen from './CommissionTable';
import AnnualChecksScreen from './AnnualChecks';
import InboxScreen from './Inbox';
import ChatScreen from './ChatScreen';

const TABS = [
  { key: 'records', label: 'Записи', icon: 'document-text-outline', screen: 'Main' },
  { key: 'inbox', label: 'Вхідні', icon: 'notifications-outline', screen: 'Inbox' },
  { key: 'chat', label: 'Чат', icon: 'chatbubble-outline', screen: 'Chat' },
  { key: 'profile', label: 'Профіль', icon: 'person-outline', screen: 'Profile' },
];

function ChatPlaceholder() {
  return (
    <View style={ph.container}>
      <Ionicons name="chatbubble-outline" size={48} color={Colors.textTertiary} />
      <Text style={ph.text}>Чат — скоро</Text>
    </View>
  );
}

const ph = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bgTertiary },
  text: { fontFamily: FONT, fontSize: 16, color: Colors.textTertiary, marginTop: 12, fontWeight: '400' },
});

// Контекст для активного табу
export const TabNavigationContext = createContext({
  activeTab: 'records',
  setActiveTab: () => {},
});

// Компонент табів
function TabBar() {
  const { activeTab, setActiveTab } = React.useContext(TabNavigationContext);
  const { badge } = React.useContext(InboxBadgeCtx);

  const handleTabPress = (tab) => {
    setActiveTab(tab.key);

    if (rootNavigationRef.isReady()) {
      rootNavigationRef.navigate(tab.screen);
    }
  };

  return (
    <View style={styles.header}>
      <View style={styles.tabRow}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const showBadge = tab.key === 'inbox' && badge > 0;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => handleTabPress(tab)}
              activeOpacity={0.7}
            >
              {showBadge ? (
                <View style={styles.badgeCircle}>
                  <Text style={styles.badgeCircleText}>
                    {badge > 99 ? '99+' : badge}
                  </Text>
                </View>
              ) : (
                <Ionicons
                  name={isActive ? tab.icon.replace('-outline', '') : tab.icon}
                  size={18}
                  color={isActive ? Colors.primary : Colors.textTertiary}
                />
              )}
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// Stack навігація з усіма екранами
const InnerStack = createNativeStackNavigator();

function AppStack() {
  return (
    <InnerStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: Colors.bgTertiary,
        },
      }}
    >
      <InnerStack.Screen name="Main" component={MainScreen} />
      <InnerStack.Screen name="Inbox" component={InboxScreen} />
      <InnerStack.Screen name="Chat" component={ChatScreen} />
      <InnerStack.Screen name="Profile" component={ProfileScreen} />
      <InnerStack.Screen name="Settings" component={SettingsScreen} />
      <InnerStack.Screen name="AdminUsers" component={AdminUsersScreen} />
      <InnerStack.Screen name="AdminSettings" component={AdminSettingsScreen} />
      <InnerStack.Screen name="MyRecords" component={MyRecordsScreen} />
      <InnerStack.Screen name="FlightSummary" component={FlightSummaryScreen} />
      <InnerStack.Screen name="BreaksMU" component={BreaksMUScreen} />
      <InnerStack.Screen name="BreaksLP" component={BreaksLPScreen} />
      <InnerStack.Screen name="CommissionTable" component={CommissionTableScreen} />
      <InnerStack.Screen name="AnnualChecks" component={AnnualChecksScreen} />
    </InnerStack.Navigator>
  );
}

// Головний компонент з табами і навігацією
export default function FixedTabNavigator() {
  const [activeTab, setActiveTab] = useState('records');

  // Створюємо tabNavigate для використання в екранах
  const tabNavigateRef = useRef((screenName, tabKey, params) => {
    if (tabKey) {
      setActiveTab(tabKey);
    } else {
      const tab = TABS.find(t => t.screen === screenName);
      if (tab) {
        setActiveTab(tab.key);
      }
    }
    if (rootNavigationRef.isReady()) {
      rootNavigationRef.navigate(screenName, params);
    }
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgPrimary }} edges={['top']}>
      <TabNavigationContext.Provider value={{
        activeTab,
        setActiveTab,
        tabNavigate: tabNavigateRef.current
      }}>
        {/* Таби зафіксовані зверху */}
        <TabBar />

        {/* Навігація для всіх екранів */}
        <View style={{ flex: 1 }}>
          <AppStack />
        </View>
      </TabNavigationContext.Provider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.bgPrimary,
    paddingTop: Platform.OS === 'android' ? 32 : 6,
    paddingHorizontal: 12,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    zIndex: 10,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgTertiary,
    borderRadius: 10,
    padding: 3,
    overflow: 'visible',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: Colors.bgPrimary,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  tabLabel: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '400',
    color: Colors.textTertiary,
  },
  tabLabelActive: {
    color: Colors.textPrimary,
  },
  badgeCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCircleText: {
    fontFamily: FONT,
    fontSize: 10,
    fontWeight: '400',
    color: '#FFFFFF',
  },
});
