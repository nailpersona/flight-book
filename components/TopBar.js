import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthCtx } from '../App';

const FONT = 'NewsCycle-Regular';

export default function TopBar({ navigation }) {
  const { auth } = useContext(AuthCtx);
  const insets = useSafeAreaInsets();

  const isAdmin = auth?.role === 'admin';

  const onPress = () => {
    if (isAdmin) navigation.navigate('AdminSettings');
    else navigation.navigate('Profile', { token: auth?.token });
  };

  return (
    <View style={[styles.wrap, { paddingTop: (insets.top || 0) + 6 }]}>
      <View style={styles.left}>
        <Text style={styles.role}>–ÓÎ¸: {auth?.role || '-'}</Text>
        {!!auth?.pib && <Text style={styles.pib}>{auth.pib}</Text>}
      </View>
      <TouchableOpacity style={styles.btn} onPress={onPress} activeOpacity={0.85}>
        <Text style={styles.btnText}>{isAdmin ? 'Õ¿À¿ÿ“”¬¿ÕÕﬂ' : 'œ–Œ‘≤À‹'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#F4F6F8',
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  left: { flex: 1 },
  role: { fontFamily: FONT, fontSize: 16, color: '#111' },
  pib: { fontFamily: FONT, fontSize: 16, color: '#333', marginTop: 2 },
  btn: {
    backgroundColor: '#333',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  btnText: { color: '#fff', fontFamily: FONT, fontSize: 15, fontWeight: '700', letterSpacing: 0.2, textAlign: 'center' },
});
