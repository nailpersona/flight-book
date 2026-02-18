import React, { useContext, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Platform, SafeAreaView, ActivityIndicator, Image, KeyboardAvoidingView,
  ScrollView, Modal, FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthCtx } from './contexts';
import { Colors, FONT, Shadows, BorderRadius, Spacing } from './theme';
import { supabase } from './supabase';
import ThemedAlert from './ThemedAlert';

export default function Login({ navigation }) {
  const { setAuth } = useContext(AuthCtx);
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(null);
  const [isRegister, setIsRegister] = useState(false);
  const [crewRole, setCrewRole] = useState('');
  const [showRoleModal, setShowRoleModal] = useState(false);

  const CREW_ROLES = ['Пілот', 'Штурман', 'Бортовий технік'];

  const onLogin = async () => {
    if (!email.trim() || !pass.trim()) {
      return ThemedAlert.alert('Увага', 'Введіть email і пароль');
    }
    try {
      setBusy(true);
      const { data: j, error: rpcErr } = await supabase.rpc('fn_login', {
        p_email: email.trim(),
        p_password: pass.trim(),
      });
      if (rpcErr) throw new Error(rpcErr.message);
      if (!j?.ok) throw new Error(j?.error || 'Помилка входу');

      const authObj = {
        userId: j.id,
        role: j.role || 'user',
        pib: j.pib || '',
        email: j.email || email.trim(),
        canEditReadiness: j.can_edit_readiness || false,
        expires: Date.now() + 8 * 60 * 60 * 1000, // 8 hours
      };
      setAuth(authObj);

      navigation.reset({
        index: 0,
        routes: [{ name: 'Tabs' }],
      });
    } catch (e) {
      ThemedAlert.alert('Помилка', String(e.message || e));
    } finally {
      setBusy(false);
    }
  };

  const onRegister = async () => {
    if (!email.trim() || !pass.trim() || !name.trim() || !inviteCode.trim() || !crewRole) {
      return ThemedAlert.alert('Увага', 'Заповніть усі поля');
    }
    try {
      setBusy(true);
      console.log('=== REGISTER DEBUG ===');
      console.log('email:', email.trim());
      console.log('name:', name.trim());
      console.log('inviteCode:', inviteCode.trim());
      console.log('crewRole:', crewRole);
      console.log('password length:', pass.trim().length);

      const { data: j, error: rpcErr } = await supabase.rpc('fn_register_with_position_invite', {
        p_email: email.trim(),
        p_password: pass.trim(),
        p_name: name.trim(),
        p_invite_code: inviteCode.trim(),
        p_crew_role: crewRole,
      });

      console.log('RPC response:', JSON.stringify(j, null, 2));
      console.log('RPC error:', rpcErr);

      if (rpcErr) throw new Error(rpcErr.message);
      if (!j?.ok) throw new Error(j?.error || 'Помилка реєстрації');

      const authObj = {
        userId: j.id,
        role: j.role || 'user',
        pib: j.pib || '',
        email: j.email || email.trim(),
        canEditReadiness: j.can_edit_readiness || false,
        expires: Date.now() + 8 * 60 * 60 * 1000, // 8 hours
      };
      setAuth(authObj);

      navigation.reset({
        index: 0,
        routes: [{ name: 'Tabs' }],
      });
    } catch (e) {
      ThemedAlert.alert('Помилка', String(e.message || e));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = () => {
    console.log('=== handleSubmit called ===');
    console.log('isRegister:', isRegister);
    if (isRegister) {
      onRegister();
    } else {
      onLogin();
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
            <View style={styles.modeSwitch}>
              <TouchableOpacity
                style={[styles.modeBtn, !isRegister && styles.modeBtnActive]}
                onPress={() => setIsRegister(false)}
              >
                <Text style={[styles.modeBtnText, !isRegister && styles.modeBtnTextActive]}>Вхід</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, isRegister && styles.modeBtnActive]}
                onPress={() => setIsRegister(true)}
              >
                <Text style={[styles.modeBtnText, isRegister && styles.modeBtnTextActive]}>Реєстрація</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.subtitle}>{isRegister ? 'Реєстрація з кодом запрошення' : 'Авторизуйтесь для продовження'}</Text>

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
                placeholder={isRegister ? 'Придумайте пароль' : 'Введіть пароль'}
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
                <Ionicons
                  name={showPass ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={Colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* ПІБ (тільки для реєстрації) */}
            {isRegister && (
              <>
                <Text style={styles.label}>Звання та ПІБ</Text>
                <View style={[
                  styles.inputWrap,
                  focused === 'name' && styles.inputFocused,
                ]}>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="п-к Пілот П.П."
                    placeholderTextColor={Colors.textTertiary}
                    style={styles.input}
                    onFocus={() => setFocused('name')}
                    onBlur={() => setFocused(null)}
                  />
                </View>

                <Text style={styles.label}>Роль в екіпажі</Text>
                <TouchableOpacity
                  style={styles.roleSelect}
                  onPress={() => setShowRoleModal(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.roleSelectText, !crewRole && styles.roleSelectPlaceholder]}>
                    {crewRole || 'Оберіть роль'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
                </TouchableOpacity>

                <Modal
                  visible={showRoleModal}
                  transparent
                  animationType="fade"
                  onRequestClose={() => setShowRoleModal(false)}
                >
                  <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                      <Text style={styles.modalTitle}>Роль в екіпажі</Text>
                      <FlatList
                        data={CREW_ROLES}
                        keyExtractor={(item) => item}
                        style={{ maxHeight: 240 }}
                        renderItem={({ item }) => (
                          <TouchableOpacity
                            style={[styles.optionRow, crewRole === item && styles.optionRowSelected]}
                            onPress={() => { setCrewRole(item); setShowRoleModal(false); }}
                          >
                            <Text style={[styles.optionText, crewRole === item && styles.optionTextSelected]}>
                              {item}
                            </Text>
                            {crewRole === item && <Text style={styles.selectedMark}>✓</Text>}
                          </TouchableOpacity>
                        )}
                      />
                      <TouchableOpacity
                        style={styles.modalCloseBtn}
                        onPress={() => setShowRoleModal(false)}
                      >
                        <Text style={styles.modalCloseBtnText}>Закрити</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </Modal>

                <Text style={styles.label}>Код від адміна</Text>
                <View style={[
                  styles.inputWrap,
                  focused === 'invite' && styles.inputFocused,
                ]}>
                  <TextInput
                    value={inviteCode}
                    onChangeText={setInviteCode}
                    placeholder="Введіть код від адміна"
                    placeholderTextColor={Colors.textTertiary}
                    autoCapitalize="characters"
                    style={styles.input}
                    onFocus={() => setFocused('invite')}
                    onBlur={() => setFocused(null)}
                  />
                </View>
              </>
            )}

            {/* Login/Register button */}
            <TouchableOpacity
              style={[styles.btn, busy && { opacity: 0.7 }]}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={busy}
            >
              {busy
                ? <ActivityIndicator color="#555860" />
                : (
                  <>
                    <Ionicons
                      name={isRegister ? 'person-add-outline' : 'log-in-outline'}
                      size={18}
                      color="#555860"
                      style={styles.btnIcon}
                    />
                    <Text style={styles.btnText}>{isRegister ? 'Зареєструватися' : 'Увійти'}</Text>
                  </>
                )
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

  // Mode switch
  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: Colors.bgSecondary,
    borderRadius: BorderRadius.md,
    padding: 4,
    marginBottom: 16,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
  },
  modeBtnActive: {
    backgroundColor: Colors.bgPrimary,
    ...Shadows.small,
  },
  modeBtnText: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textSecondary,
  },
  modeBtnTextActive: {
    color: Colors.textPrimary,
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

  // Role selector
  roleSelect: {
    minHeight: 44,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roleSelectText: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '400',
    color: Colors.textPrimary,
    flex: 1,
  },
  roleSelectPlaceholder: {
    color: Colors.textTertiary,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  modalCard: {
    backgroundColor: Colors.bgPrimary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.large,
  },
  modalTitle: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '400',
    marginBottom: 12,
    color: Colors.textPrimary,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  optionRowSelected: {
    backgroundColor: Colors.bgSecondary,
  },
  optionText: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '400',
    color: Colors.textPrimary,
    flex: 1,
  },
  optionTextSelected: {
    color: Colors.primary,
  },
  selectedMark: {
    fontFamily: FONT,
    color: Colors.success,
    fontSize: 14,
    fontWeight: '400',
    marginLeft: 8,
  },
  modalCloseBtn: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: Colors.bgSecondary,
    borderRadius: BorderRadius.md,
  },
  modalCloseBtnText: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '400',
    color: Colors.textSecondary,
  },

  // Button
  btn: {
    marginTop: 24,
    backgroundColor: '#D9DBDE',
    borderRadius: BorderRadius.lg,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#B0B3B8',
    ...Shadows.medium,
  },
  btnIcon: {
    marginRight: 4,
  },
  btnText: {
    color: '#555860',
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: 0.3,
  },
});
