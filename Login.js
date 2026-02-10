import React, { useContext, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Alert, StyleSheet,
  Platform, SafeAreaView, ActivityIndicator, Image, KeyboardAvoidingView,
  ScrollView
} from 'react-native';
import { AuthCtx } from './contexts';
import { Colors, FONT, Shadows, BorderRadius, Spacing } from './theme';
import api from './api';

export default function Login({ navigation }) {
  const { setAuth } = useContext(AuthCtx);
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(null);

  const onLogin = async () => {
    if (!email.trim() || !pass.trim()) {
      return Alert.alert('Увага', 'Введіть email і пароль');
    }
    try {
      setBusy(true);
      const j = await api.login(email.trim(), pass.trim());
      if (!j?.ok) throw new Error(j?.error || 'Помилка входу');

      const WEEK = 7 * 24 * 60 * 60 * 1000;
      const authObj = {
        token: j.token,
        role: j.role || 'user',
        pib: j.pib || '',
        email: j.email || email.trim(),
        expires: Date.now() + WEEK,
      };
      setAuth(authObj);

      navigation.reset({
        index: 0,
        routes: [{ name: 'Tabs' }],
      });
    } catch (e) {
      Alert.alert('Помилка', String(e.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={styles.logoWrap}>
            <Image
              source={require('./assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.title}>Вхід</Text>
            <Text style={styles.subtitle}>Авторизуйтесь для продовження</Text>

            {/* Email */}
            <Text style={styles.label}>Email</Text>
            <View style={[
              styles.inputWrap,
              focused === 'email' && styles.inputFocused,
            ]}>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
              />
            </View>

            {/* Password */}
            <Text style={styles.label}>Пароль</Text>
            <View style={[
              styles.inputWrap,
              focused === 'pass' && styles.inputFocused,
            ]}>
              <TextInput
                value={pass}
                onChangeText={setPass}
                placeholder="Введіть пароль"
                placeholderTextColor={Colors.textTertiary}
                secureTextEntry={!showPass}
                style={[styles.input, { flex: 1 }]}
                onFocus={() => setFocused('pass')}
                onBlur={() => setFocused(null)}
              />
              <TouchableOpacity
                onPress={() => setShowPass(s => !s)}
                style={styles.eyeBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.eyeText}>{showPass ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>

            {/* Login button */}
            <TouchableOpacity
              style={[styles.btn, busy && { opacity: 0.7 }]}
              onPress={onLogin}
              activeOpacity={0.85}
              disabled={busy}
            >
              {busy
                ? <ActivityIndicator color={Colors.textInverse} />
                : <Text style={styles.btnText}>Увійти</Text>
              }
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgTertiary,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: 40,
  },

  // Logo
  logoWrap: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 120,
    height: 120,
  },

  // Card
  card: {
    backgroundColor: Colors.bgPrimary,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 28,
    ...Shadows.large,
  },

  // Typography
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
    marginBottom: 24,
  },
  label: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 14,
  },

  // Inputs
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

  // Eye toggle
  eyeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  eyeText: {
    fontSize: 18,
  },

  // Button
  btn: {
    marginTop: 24,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.medium,
  },
  btnText: {
    color: Colors.textInverse,
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: 0.3,
  },
});
