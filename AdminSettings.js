import React, { useContext } from 'react';
import { SafeAreaView, View, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthCtx } from './App';

const FONT = 'NewsCycle-Regular';

const CardBtn = ({ title, onPress }) => (
  <Text onPress={onPress} style={styles.cardBtn}>{title}</Text>
);

export default function AdminSettings({ navigation }) {
  const { auth } = useContext(AuthCtx);
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:'#F4F6F8', paddingTop:(insets.top||0)+8 }}>
      <View style={{ paddingHorizontal:16 }}>
        <Text style={styles.h1}>Налаштування</Text>
        <Text style={styles.sub}>ПІБ: {auth?.pib || '-'}</Text>

        <CardBtn title="ПРОФІЛЬ" onPress={()=> navigation.navigate('Profile', { token: auth?.token })} />
        <CardBtn title="КОРИСТУВАЧІ" onPress={()=> navigation.navigate('AdminUsers', { token: auth?.token })} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: FONT, fontSize: 22, color: '#111', marginBottom: 6 },
  sub: { fontFamily: FONT, fontSize: 16, color: '#444', marginBottom: 18 },
  cardBtn: {
    fontFamily: FONT, fontSize: 18, color: '#fff', textAlign: 'center',
    backgroundColor:'#333', borderRadius:16, paddingVertical:16, marginBottom:12,
    shadowColor:'#000', shadowOpacity:0.22, shadowRadius:8, shadowOffset:{width:0,height:4}, elevation:4,
  },
});
