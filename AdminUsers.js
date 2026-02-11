import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from './supabase';

const DARK = '#333'; const SHADOW = { shadowColor:'#000', shadowOpacity:0.18, shadowRadius:8, shadowOffset:{width:0,height:4}, elevation:3 };

export default function AdminUsers({ route, navigation }) {
  const { token } = route.params || {};
  const [email, setEmail] = useState('');
  const [pib, setPib] = useState('');
  const [role, setRole] = useState('user'); // 'user' | 'admin'
  const [password, setPassword] = useState('');

  const submit = async () => {
    try{
      if(!email || !password) return Alert.alert('Увага','Email і пароль обовʼязкові');
      const { data: j, error: rpcErr } = await supabase.rpc('fn_admin_create_user', {
        p_email: email.trim(),
        p_name: pib.trim(),
        p_role: role,
        p_password: password,
      });
      if(rpcErr) throw new Error(rpcErr.message);
      if(!j?.ok) throw new Error(j?.error || 'Помилка');
      Alert.alert('Готово','Користувача збережено');
      setEmail(''); setPib(''); setPassword('');
    }catch(err){ Alert.alert('Помилка', String(err.message||err)); }
  };

  return (
    <SafeAreaView style={{flex:1,backgroundColor:'#F3F5F9'}}>
      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
        <View style={{padding:16}}>
          <Text style={s.h1}>Користувачі (адмін)</Text>

          <Text style={s.label}>Email (логін)</Text>
          <TextInput style={s.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"/>

          <Text style={s.label}>ПІБ</Text>
          <TextInput style={s.input} value={pib} onChangeText={setPib} />

          <Text style={s.label}>Роль (user/admin)</Text>
          <TextInput style={s.input} value={role} onChangeText={(t)=>setRole((t||'').trim().toLowerCase()==='admin'?'admin':'user')} />

          <Text style={s.label}>Тимчасовий пароль</Text>
          <TextInput style={s.input} value={password} onChangeText={setPassword} secureTextEntry />

          <TouchableOpacity style={[s.btn, s.btnDark]} onPress={submit}>
            <Text style={s.btnText}>ЗБЕРЕГТИ</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[s.btn, s.btnGray]} onPress={()=>navigation.goBack()}>
            <Text style={[s.btnText, {color:'#fff'}]}>НАЗАД</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  h1:{ fontSize:20,fontWeight:'800', marginBottom:12, color:'#111827' },
  label:{ marginTop:8, marginBottom:6, fontWeight:'600', color:'#111827' },
  input:{ backgroundColor:'#fff', borderRadius:12, borderWidth:1, borderColor:'#E5E7EB', paddingHorizontal:12, height:44 },
  btn:{ height:48, borderRadius:12, alignItems:'center', justifyContent:'center', marginTop:14, ...SHADOW },
  btnDark:{ backgroundColor:DARK },
  btnGray:{ backgroundColor:'#7B7B7B' },
  btnText:{ color:'#fff', fontWeight:'800' },
});
