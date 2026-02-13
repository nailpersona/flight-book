// AdminPanel.js — адмін панель з кнопками Підрозділи та Узагальнення
import React, { useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthCtx } from './contexts';
import { Colors, Shadows, BorderRadius, Spacing, FONT } from './theme';
import { TabNavigationContext } from './FixedTabNavigator';

// Кнопка адмін-панелі
const AdminButton = ({ title, icon, onPress, dark }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.7}
    style={[styles.btn, dark && styles.btnDark]}
  >
    <Ionicons name={icon} size={20} color={dark ? '#FFFFFF' : '#555860'} style={styles.btnIcon} />
    <Text style={[styles.btnText, dark && styles.btnTextDark]}>{title}</Text>
  </TouchableOpacity>
);

export default function AdminPanel({ navigation }) {
  const { auth } = useContext(AuthCtx);
  const { tabNavigate } = useContext(TabNavigationContext);

  if (auth?.role !== 'admin') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Доступ заборонено</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.buttonList}>
          <AdminButton
            icon="git-network-outline"
            title="Посади"
            onPress={() => tabNavigate('AdminPositions')}
          />

          <AdminButton
            icon="grid-outline"
            title="Узагальнення"
            onPress={() => Linking.openURL('https://fly-book.vercel.app/tabs/readiness')}
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgTertiary,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  errorText: {
    fontFamily: FONT,
    fontSize: 16,
    color: Colors.textTertiary,
    fontWeight: '400',
  },
  buttonList: {
    alignItems: 'center',
    gap: 16,
    marginBottom: Spacing.xl,
  },
  btn: {
    width: '80%',
    height: 54,
    borderRadius: BorderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D9DBDE',
    borderWidth: 1,
    borderColor: '#B0B3B8',
    ...Shadows.medium,
  },
  btnDark: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  btnIcon: {
    marginRight: 10,
  },
  btnText: {
    color: '#555860',
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '400',
  },
  btnTextDark: {
    color: '#FFFFFF',
  },
});
