import React, { useContext, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Alert, StyleSheet,
  Platform, SafeAreaView, ActivityIndicator, Image
} from 'react-native';
import { AuthCtx } from './App';
import api from './api';

const FONT = 'NewsCycle-Regular';
const DARK = '#333';

export default function Login({ navigation }) {
  const { setAuth } = useContext(AuthCtx);
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);

  const onLogin = async () => {
    if (!email.trim() || !pass.trim()) {
      return Alert.alert('Увага', 'Введіть email і пароль');
    }
    try {
      setBusy(true);
      const j = await api.login(email.trim(), pass.trim());
      if (!j?.ok) throw new Error(j?.error || 'Помилка входу');

      // зберігаємо сесію на 7 днів локально
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
        routes: [{
          name: 'Main',
          params: { token: j.token, email: authObj.email, role: authObj.role, pib: authObj.pib }
        }]
      });
    } catch (e) {
      Alert.alert('Помилка', String(e.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* ЛОГОТИП */}
        <View style={styles.logoWrap}>
          <Image source={require('./assets/logo.png')} style={styles.logo} resizeMode="contain" />
        </View>

        <Text style={styles.title}>Вхід</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor="#9AA0A6"
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />

        <Text style={styles.label}>Пароль</Text>
        <View style={{ position: 'relative' }}>
          <TextInput
            value={pass}
            onChangeText={setPass}
            placeholder="********"
            placeholderTextColor="#9AA0A6"
            secureTextEntry={!showPass}
            style={[styles.input, { paddingRight: 42 }]}
          />
          <TouchableOpacity
            onPress={() => setShowPass(s => !s)}
            style={styles.eyeBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.eyeText}>{showPass ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.btn} onPress={onLogin} activeOpacity={0.9} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>УВІЙТИ</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F6F8' },
  container: { paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? 8 : 6 },

  logoWrap: { alignItems: 'center', marginTop: 12, marginBottom: 8 },
  logo: { width: 140, height: 140 },

  title: { fontFamily: FONT, fontSize: 28, fontWeight: '800', color: '#111827', marginBottom: 18, textAlign: 'center' },
  label: { fontFamily: FONT, fontSize: 15, color: '#111827', marginTop: 10, marginBottom: 6 },
  input: {
    fontFamily: FONT, fontSize: 16, color: '#111',
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: '#E1E5EA'
  },
  eyeBtn: { position: 'absolute', right: 10, top: 0, bottom: 0, justifyContent: 'center', paddingHorizontal: 6 },
  eyeText: { fontSize: 18 },

  btn: {
    marginTop: 16, backgroundColor: DARK, borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }, elevation: 3
  },
  btnText: { color: '#fff', fontFamily: FONT, fontSize: 18, fontWeight: '800', letterSpacing: 0.3 }
});
