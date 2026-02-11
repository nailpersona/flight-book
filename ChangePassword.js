import React, { useContext, useState } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity, Alert,
  StyleSheet, Platform, ActivityIndicator, KeyboardAvoidingView, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthCtx } from './contexts';
import { Colors, FONT, Shadows, BorderRadius, Spacing } from './theme';
import { supabase } from './supabase';

export default function ChangePassword({ navigation }) {
  const { auth, setAuth } = useContext(AuthCtx);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(null);

  const handleChangePassword = async () => {
    if (!auth?.email) {
      Alert.alert('Помилка', 'Сесія не активна. Увійдіть заново.');
      return navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    }

    if (!newPassword || !confirmPassword) {
      return Alert.alert('Увага', 'Заповніть всі поля нового пароля');
    }

    if (newPassword.length < 6) {
      return Alert.alert('Увага', 'Новий пароль має містити мінімум 6 символів');
    }

    if (newPassword !== confirmPassword) {
      return Alert.alert('Увага', 'Нові паролі не збігаються');
    }

    try {
      setBusy(true);

      const { data: result, error: rpcErr } = await supabase.rpc('fn_change_password', {
        p_email: auth.email,
        p_new_password: newPassword,
      });
      if (rpcErr) throw new Error(rpcErr.message);
      if (!result?.ok) {
        throw new Error(result?.error || 'Не вдалося змінити пароль');
      }

      setNewPassword('');
      setConfirmPassword('');

      if (auth?.userId) {
        const WEEK = 7 * 24 * 60 * 60 * 1000;
        setAuth({ ...auth, expires: Date.now() + WEEK });
      }

      Alert.alert('Готово', 'Пароль успішно змінено');
    } catch (error) {
      Alert.alert('Помилка', String(error.message || error));
    } finally {
      setBusy(false);
    }
  };

  const renderPasswordField = (label, value, onChange, placeholder, showFlag, toggleShow, focusKey) => (
    <>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, focused === focusKey && styles.inputFocused]}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={Colors.textTertiary}
          secureTextEntry={!showFlag}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          textContentType="oneTimeCode"
          style={styles.input}
          onFocus={() => setFocused(focusKey)}
          onBlur={() => setFocused(null)}
        />
        <TouchableOpacity
          onPress={toggleShow}
          style={styles.eyeBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.eyeText}>{showFlag ? '🙈' : '👁️'}</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Зміна пароля</Text>
          <Text style={styles.subtitle}>Введіть новий пароль</Text>

          {renderPasswordField(
            'Новий пароль', newPassword, setNewPassword,
            'Мінімум 6 символів', showNew,
            () => setShowNew(s => !s), 'new'
          )}
          {renderPasswordField(
            'Підтвердження', confirmPassword, setConfirmPassword,
            'Повторіть новий пароль', showConfirm,
            () => setShowConfirm(s => !s), 'confirm'
          )}

          <View style={styles.btnWrap}>
            <TouchableOpacity
              style={[styles.btn, busy && { opacity: 0.6 }]}
              onPress={handleChangePassword}
              activeOpacity={0.7}
              disabled={busy}
            >
              {busy
                ? <ActivityIndicator color="#555860" />
                : <>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#555860" style={styles.btnIcon} />
                    <Text style={styles.btnText}>Змінити пароль</Text>
                  </>
              }
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back-outline" size={18} color="#555860" style={styles.btnIcon} />
              <Text style={styles.btnText}>Назад</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgTertiary },
  container: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Platform.OS === 'android' ? 12 : 10,
    paddingBottom: 40,
  },
  title: {
    fontFamily: FONT,
    fontSize: 26,
    fontWeight: '400',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  label: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 14,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputFocused: {
    borderColor: Colors.primary,
  },
  input: {
    flex: 1,
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '400',
    color: Colors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
  },
  eyeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  eyeText: { fontSize: 18 },
  btnWrap: {
    alignItems: 'center',
    gap: 16,
    marginTop: 24,
  },
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
});