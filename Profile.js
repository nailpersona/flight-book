import React, { useContext, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { AuthCtx } from './App';
import api from './api';

const FONT = 'NewsCycle-Regular';
const DARK = '#333333';
const LIGHT = '#ffffff';
const SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.18,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
};

const DarkButton = ({ title, onPress, style }) => (
  <TouchableOpacity 
    onPress={onPress} 
    activeOpacity={0.9} 
    style={[styles.btn, styles.btnDark, style]}
  >
    <Text style={styles.btnText}>{title}</Text>
  </TouchableOpacity>
);

const LightButton = ({ title, onPress, style }) => (
  <TouchableOpacity 
    onPress={onPress} 
    activeOpacity={0.9} 
    style={[styles.btn, styles.btnLight, style]}
  >
    <Text style={styles.btnTextDark}>{title}</Text>
  </TouchableOpacity>
);

const ProfileButton = ({ title, onPress, style }) => (
  <TouchableOpacity 
    onPress={onPress} 
    activeOpacity={0.9} 
    style={[styles.profileBtn, style]}
  >
    <Text style={styles.profileBtnText}>{title}</Text>
  </TouchableOpacity>
);

export default function Profile({ navigation }) {
  const { auth, logout } = useContext(AuthCtx);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updating, setUpdating] = useState(false);

  const handlePasswordChange = async () => {
    if (!newPassword.trim()) {
      Alert.alert('Помилка', 'Введіть новий пароль');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Помилка', 'Пароль має містити мінімум 6 символів');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Помилка', 'Паролі не співпадають');
      return;
    }

    try {
      setUpdating(true);
      const result = await api.updateProfile(auth.token, {
        newPassword: newPassword,
      });

      if (result?.ok) {
        Alert.alert('Успіх', 'Пароль змінено успішно', [
          {
            text: 'OK',
            onPress: () => {
              setNewPassword('');
              setConfirmPassword('');
              setShowPasswordChange(false);
            },
          },
        ]);
      } else {
        Alert.alert('Помилка', result?.error || 'Не вдалося змінити пароль');
      }
    } catch (error) {
      Alert.alert('Помилка', 'Не вдалося змінити пароль');
    } finally {
      setUpdating(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Вихід', 'Ви впевнені що хочете вийти?', [
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Профіль</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Назад</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Навігаційні кнопки */}
        <View style={styles.navigationSection}>
          <DarkButton
            title="Перерви за МУ"
            onPress={() =>
              navigation.navigate('BreaksMU', {
                pib: auth?.pib,
                isAdmin: auth?.role === 'admin',
              })
            }
            style={styles.navButton}
          />

          <LightButton
            title="Перерви за видами ЛП"
            onPress={() =>
              navigation.navigate('BreaksLP', {
                pib: auth?.pib,
                isAdmin: auth?.role === 'admin',
              })
            }
            style={styles.navButton}
          />

          <DarkButton
            title="Таблиця комісування"
            onPress={() =>
              navigation.navigate('CommissionTable', {
                pib: auth?.pib,
                isAdmin: auth?.role === 'admin',
              })
            }
            style={styles.navButton}
          />
        </View>

        {/* Зміна пароля */}
        <View style={styles.passwordSection}>
          {!showPasswordChange ? (
            <LightButton
              title="Змінити пароль"
              onPress={() => setShowPasswordChange(true)}
              style={styles.navButton}
            />
          ) : (
            <View style={styles.passwordForm}>
              <Text style={styles.formTitle}>Зміна пароля</Text>

              {/* Email (тільки для читання) */}
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Email:</Text>
                <View style={styles.disabledInput}>
                  <Text style={styles.disabledInputText}>
                    {auth?.email || 'Не вказано'}
                  </Text>
                </View>
              </View>

              {/* Новий пароль */}
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Введіть новий пароль:</Text>
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Мінімум 6 символів"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Підтвердження пароля */}
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Повторіть новий пароль:</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Повторіть пароль"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Кнопки */}
              <View style={styles.formButtons}>
                <TouchableOpacity
                  style={[styles.formBtn, styles.cancelBtn]}
                  onPress={() => {
                    setShowPasswordChange(false);
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  disabled={updating}
                >
                  <Text style={styles.formBtnText}>Скасувати</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.formBtn, styles.saveBtn]}
                  onPress={handlePasswordChange}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={[styles.formBtnText, { color: '#FFFFFF' }]}>
                      Зберегти
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Кнопка виходу */}
        <View style={styles.logoutSection}>
          <ProfileButton
            title="ВИЙТИ"
            onPress={handleLogout}
            style={[styles.navButton, { backgroundColor: '#DC2626' }]}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F5F9',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#F3F5F9',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    fontFamily: FONT,
  },
  backButton: {
    backgroundColor: DARK,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    ...SHADOW,
  },
  backButtonText: {
    color: LIGHT,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FONT,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  navigationSection: {
    marginTop: 20,
    gap: 14,
  },
  passwordSection: {
    marginTop: 20,
  },
  logoutSection: {
    marginTop: 30,
    marginBottom: 40,
  },
  navButton: {
    marginBottom: 0,
  },
  btn: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    ...SHADOW,
  },
  btnDark: {
    backgroundColor: DARK,
  },
  btnLight: {
    backgroundColor: '#7B7B7B',
  },
  btnText: {
    color: LIGHT,
    fontFamily: FONT,
    fontSize: 18,
    fontWeight: '800',
  },
  btnTextDark: {
    color: LIGHT,
    fontFamily: FONT,
    fontSize: 18,
    fontWeight: '800',
  },
  profileBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    backgroundColor: '#D97706',
    ...SHADOW,
  },
  profileBtnText: {
    color: LIGHT,
    fontFamily: FONT,
    fontSize: 18,
    fontWeight: '800',
  },
  passwordForm: {
    backgroundColor: LIGHT,
    borderRadius: 12,
    padding: 20,
    ...SHADOW,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    fontFamily: FONT,
    marginBottom: 20,
    textAlign: 'center',
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    fontFamily: FONT,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: FONT,
    backgroundColor: LIGHT,
    color: '#111827',
  },
  disabledInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
  },
  disabledInputText: {
    fontSize: 16,
    fontFamily: FONT,
    color: '#6B7280',
  },
  formButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  formBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  saveBtn: {
    backgroundColor: '#10B981',
  },
  formBtnText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: FONT,
    color: '#374151',
  },
});