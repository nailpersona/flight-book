import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthCtx } from '../contexts';
import { TabNavigationContext } from '../FixedTabNavigator';
import { Colors, FONT } from '../theme';

export default function TopBar({ navigation }) {
  const { auth } = useContext(AuthCtx);
  const { tabNavigate } = useContext(TabNavigationContext);
  const insets = useSafeAreaInsets();

  const isAdmin = auth?.role === 'admin';

  const onPress = () => {
    if (isAdmin) tabNavigate('AdminSettings');
    else tabNavigate('Profile', undefined, {});
  };

  return (
    <View style={[styles.wrap, { paddingTop: (insets.top || 0) + 6 }]}>
      <View style={styles.left}>
        <Text style={styles.role}>Роль: {auth?.role || '-'}</Text>
        {!!auth?.pib && <Text style={styles.pib}>{auth.pib}</Text>}
      </View>
      <TouchableOpacity style={styles.btn} onPress={onPress} activeOpacity={0.85}>
        <Text style={styles.btnText}>{isAdmin ? 'Адмінка' : 'Профіль'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.bgTertiary,
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  left: { flex: 1 },
  role: { fontFamily: FONT, fontSize: 16, fontWeight: '400', color: Colors.textPrimary },
  pib: { fontFamily: FONT, fontSize: 16, fontWeight: '400', color: Colors.textPrimary, marginTop: 2 },
  btn: {
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  btnText: { color: Colors.textInverse, fontFamily: FONT, fontSize: 15, fontWeight: '400', letterSpacing: 0.2, textAlign: 'center' },
});
