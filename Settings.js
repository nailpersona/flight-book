// Settings.js Ч екран дл€ зм≥ни Web App URL
import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, TextInput, Button, Alert } from 'react-native';
import { getBaseUrl, setBaseUrl } from './api';

const S = {
  screen: { flex: 1, backgroundColor: '#fff' },
  pad: { padding: 16 },
  h1: { fontWeight: '800', fontSize: 18, marginBottom: 12 },
  label: { fontWeight: '700', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#DADADA', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
};

const isAppsScriptExec = (u) =>
  /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/i.test(u || '');

export default function Settings({ navigation, onConfigured }) {
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const curr = await getBaseUrl();
      setUrl(curr || '');
    })();
  }, []);

  const save = async () => {
    const trimmed = (url || '').trim();
    if (!trimmed) {
      Alert.alert('ѕерев≥рка', 'URL не може бути порожн≥м.');
      return;
    }
    if (!isAppsScriptExec(trimmed)) {
      Alert.alert('”вага', '—хоже, що це не Apps Script Web App (/exec). якщо впевнений Ч натисни ЂOKї ще раз ≥ збережи.');
      // залишаЇмо можлив≥сть зберегти будь-€кий URL
    }
    try {
      setSaving(true);
      await setBaseUrl(trimmed);
      onConfigured && onConfigured();           // пов≥домл€Їмо App, що конф≥гурац≥ю виконано
      Alert.alert('«бережено', 'Ќовий Web App URL застосовано.');
      // ѕереходимо на Login (чистий старт)
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (e) {
      Alert.alert('ѕомилка', String(e.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={S.screen}>
      <View style={S.pad}>
        <Text style={S.h1}>Ќалаштуванн€</Text>

        <Text style={S.label}>Web App URL</Text>
        <TextInput
          style={S.input}
          value={url}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="https://script.google.com/macros/s/Е/exec"
          onChangeText={setUrl}
        />

        <View style={{ height: 12 }} />
        <Button title={saving ? '«береженн€Е' : '«берегти'} onPress={save} disabled={saving} />
      </View>
    </SafeAreaView>
  );
}
