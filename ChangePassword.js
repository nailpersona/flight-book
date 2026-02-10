import React, { useContext, useState } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, Platform
} from 'react-native';
import { AuthCtx } from './contexts';
import api from './api';

const FONT = 'NewsCycle-Regular';
const DARK = '#333';

const ActionButton = ({ title, style, onPress, disabled }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.9} disabled={disabled}
    style={[styles.btn, style, disabled && { opacity: 0.6 }]}>
    <Text style={styles.btnText}>{title}</Text>
  </TouchableOpacity>
);

export default function ChangePassword({ navigation }) {
  const { auth, setAuth } = useContext(AuthCtx);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleChangePassword = async () => {
    if (!auth?.token) {
      Alert.alert('Помилка', 'Немає токена сесії. Увійдіть заново.');
      return navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    }

    if (!currentPassword.trim()) {
      return Alert.alert('Увага', 'Введіть поточний пароль');
    }

    if (!newPassword.trim() || !confirmPassword.trim()) {
      return Alert.alert('Увага', 'Заповніть всі поля нового пароля');
    }

    if (newPassword.trim().length < 6) {
      return Alert.alert('Увага', 'Новий пароль має містити мінімум 6 символів');
    }

    if (newPassword.trim() !== confirmPassword.trim()) {
      return Alert.alert('Увага', 'Нові паролі не збігаються');
    }

    try {
      setBusy(true);
      
      // Спочатку перевіряємо поточний пароль через логін
      const loginCheck = await api.login(auth.email, currentPassword.trim());
      if (!loginCheck?.ok) {
        throw new Error('Неправильний поточний пароль');
      }

      // Тепер змінюємо пароль
      const result = await api.profileUpdate(auth.token, newPassword.trim());
      if (!result?.ok) {
        throw new Error(result?.error || 'Не вдалося змінити пароль');
      }

      // Очищуємо поля
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Продовжуємо локальну сесію ще на тиждень
      if (auth?.token) {
        const WEEK = 7 * 24 * 60 * 60 * 1000;
        const updatedAuth = { ...auth, expires: Date.now() + WEEK };
        setAuth(updatedAuth);
      }

      Alert.alert('Готово', 'Пароль успішно змінено');
    } catch (error) {
      Alert.alert('Помилка', String(error.message || error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Зміна пароля</Text>

        <Text style={styles.label}>Поточний пароль</Text>
        <View style={{ position: 'relative' }}>
          <TextInput
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Введіть поточний пароль"
            placeholderTextColor="#9AA0A6"
            secureTextEntry={!showCurrent}
            style={[styles.input, { paddingRight: 42 }]}
          />
          <TouchableOpacity
            onPress={() => setShowCurrent(s => !s)}
            style={styles.eyeBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.eyeText}>{showCurrent ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Новий пароль</Text>
        <View style={{ position: 'relative' }}>
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Мінімум 6 символів"
            placeholderTextColor="#9AA0A6"
            secureTextEntry={!showNew}
            style={[styles.input, { paddingRight: 42 }]}
          />
          <TouchableOpacity
            onPress={() => setShowNew(s => !s)}
            style={styles.eyeBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.eyeText}>{showNew ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Підтвердження нового пароля</Text>
        <View style={{ position: 'relative' }}>
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Повторіть новий пароль"
            placeholderTextColor="#9AA0A6"
            secureTextEntry={!showConfirm}
            style={[styles.input, { paddingRight: 42 }]}
          />
          <TouchableOpacity
            onPress={() => setShowConfirm(s => !s)}
            style={styles.eyeBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.eyeText}>{showConfirm ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>

        <ActionButton
          title={busy ? 'ЗБЕРЕЖЕННЯ...' : 'ЗМІНИТИ ПАРОЛЬ'}
          onPress={handleChangePassword}
          disabled={busy}
          style={{ marginTop: 20 }}
        />

        <ActionButton
          title="НАЗАД"
          onPress={() => navigation.goBack()}
          style={{ backgroundColor: '#7B7B7B', marginTop: 10 }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F6F8' },
  container: { 
    flex: 1,
    paddingHorizontal: 16, 
    paddingTop: Platform.OS === 'android' ? 8 : 6 
  },
  title: { 
    fontFamily: FONT, 
    fontSize: 28, 
    fontWeight: '800', 
    color: '#111827', 
    marginBottom: 18,
    textAlign: 'center'
  },
  label: { 
    fontFamily: FONT, 
    fontSize: 15, 
    color: '#111827', 
    marginTop: 15, 
    marginBottom: 6,
    fontWeight: '600'
  },
  input: {
    fontFamily: FONT, 
    fontSize: 16, 
    color: '#111',
    backgroundColor: '#fff', 
    borderRadius: 12, 
    paddingHorizontal: 14, 
    paddingVertical: 12,
    borderWidth: 1, 
    borderColor: '#E1E5EA'
  },
  eyeBtn: { 
    position: 'absolute', 
    right: 10, 
    top: 0, 
    bottom: 0, 
    justifyContent: 'center', 
    paddingHorizontal: 6 
  },
  eyeText: { fontSize: 18 },

  btn: {
    backgroundColor: DARK,
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
    fontFamily: FONT,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});