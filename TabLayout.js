// TabLayout.js — сучасні таби у стилі beauty-persona
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Spacing, FONT } from './theme';

import MainScreen from './Main';
import ProfileScreen from './Profile';

const TABS = [
  { key: 'records', label: 'Записи', icon: 'document-text-outline' },
  { key: 'inbox', label: 'Вхідні', icon: 'mail-outline' },
  { key: 'chat', label: 'Посібник', icon: 'chatbubble-outline' },
  { key: 'profile', label: 'Профіль', icon: 'person-outline' },
];

function InboxPlaceholder() {
  return (
    <View style={ph.container}>
      <Ionicons name="mail-outline" size={48} color={Colors.textTertiary} />
      <Text style={ph.text}>Вхідні — скоро</Text>
    </View>
  );
}

function ChatPlaceholder() {
  return (
    <View style={ph.container}>
      <Ionicons name="chatbubble-outline" size={48} color={Colors.textTertiary} />
      <Text style={ph.text}>Посібник — скоро</Text>
    </View>
  );
}

const ph = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bgTertiary },
  text: { fontFamily: FONT, fontSize: 16, color: Colors.textTertiary, marginTop: 12, fontWeight: '400' },
});

export default function TabLayout({ route, navigation }) {
  const [activeTab, setActiveTab] = useState('records');

  const renderContent = () => {
    switch (activeTab) {
      case 'records':
        return <MainScreen route={route} navigation={navigation} />;
      case 'inbox':
        return <InboxPlaceholder />;
      case 'chat':
        return <ChatPlaceholder />;
      case 'profile':
        return <ProfileScreen route={route} navigation={navigation} />;
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgPrimary }} edges={['bottom']}>
      {/* Header з табами — як у beauty-persona */}
      <View style={styles.header}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tab}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <View style={{ position: 'relative' }}>
                <Ionicons
                  name={tab.icon}
                  size={22}
                  color={isActive ? Colors.primary : Colors.textTertiary}
                />
              </View>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Контент активного табу */}
      <View style={{ flex: 1, backgroundColor: Colors.bgTertiary }}>
        {renderContent()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgPrimary,
    paddingTop: Platform.OS === 'android' ? 35 : 45,
    paddingHorizontal: 4,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.primary,
  },
  tabLabel: {
    fontFamily: FONT,
    fontSize: 10,
    fontWeight: '400',
    color: Colors.textTertiary,
    marginTop: 4,
  },
  tabLabelActive: {
    color: Colors.primary,
  },
});
