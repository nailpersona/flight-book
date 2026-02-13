// Profile.js — сучасний дизайн у чоловічих сіро-чорних тонах
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
import ThemedAlert from './ThemedAlert';

// Кнопка профілю — єдиний стиль для всіх
const ProfileButton = ({ title, icon, onPress, style, dark }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={[styles.btn, style, dark && styles.btnDark]}>
    <Ionicons name={icon} size={18} color={dark ? '#FFFFFF' : '#555860'} style={styles.btnIcon} />
    <Text style={[styles.btnText, dark && styles.btnTextDark]}>{title}</Text>
  </TouchableOpacity>
);

export default function Profile({ navigation }) {
  const { auth, logout } = useContext(AuthCtx);
  const { tabNavigate } = useContext(TabNavigationContext);

  const handleLogout = () => {
    ThemedAlert.alert('Вихід', 'Ви впевнені що хочете вийти?', [
      { text: 'Скасувати', style: 'cancel' },
      {
        text: 'Вийти',
        style: 'destructive',
        onPress: logout,
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Кнопки */}
        <View style={styles.buttonList}>
          <ProfileButton
            icon="list-outline"
            title="Мої записи"
            onPress={() => tabNavigate('MyRecords')}
          />

          <ProfileButton
            icon="bar-chart-outline"
            title="Підсумки"
            onPress={() => tabNavigate('FlightSummary')}
          />

          <ProfileButton
            icon="timer-outline"
            title="Перерви за МУ"
            onPress={() =>
              tabNavigate('BreaksMU', undefined, {
                pib: auth?.pib,
                isAdmin: auth?.role === 'admin',
              })
            }
          />

          <ProfileButton
            icon="airplane-outline"
            title="Перерви за видами ЛП"
            onPress={() =>
              tabNavigate('BreaksLP', undefined, {
                pib: auth?.pib,
                isAdmin: auth?.role === 'admin',
              })
            }
          />

          <ProfileButton
            icon="document-text-outline"
            title="Таблиця комісування"
            onPress={() =>
              tabNavigate('CommissionTable', undefined, {
                pib: auth?.pib,
                isAdmin: auth?.role === 'admin',
              })
            }
          />

          <ProfileButton
            icon="calendar-outline"
            title="Рiчнi перевiрки"
            onPress={() =>
              tabNavigate('AnnualChecks', undefined, {
                pib: auth?.pib,
                isAdmin: auth?.role === 'admin',
              })
            }
          />

          <ProfileButton
            icon="settings-outline"
            title="Налаштування"
            onPress={() => tabNavigate('Settings')}
          />

          {auth?.role === 'admin' && (
            <ProfileButton
              icon="settings-outline"
              title="Адмін панель"
              onPress={() => tabNavigate('AdminPanel')}
              dark
            />
          )}

          <ProfileButton
            icon="log-out-outline"
            title="Вийти"
            onPress={handleLogout}
            style={styles.btnLogout}
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
  buttonList: {
    alignItems: 'center',
    gap: 16,
    marginBottom: Spacing.xl,
  },
  // Кнопки — однакові, сірі, фіксована ширина
  btn: {
    width: '80%',
    height: 50,
    borderRadius: BorderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D9DBDE',
    borderWidth: 1,
    borderColor: '#B0B3B8',
    ...Shadows.medium,
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
  btnDark: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  btnLogout: {
    borderWidth: 1,
    borderColor: '#E8B4B4',
  },
});
