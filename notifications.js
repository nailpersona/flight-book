// notifications.js — локальні push-повідомлення про закінчення термінів
import * as Notifications from 'expo-notifications';
import { Platform, Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBreaksDataFromSupabase, getAnnualChecksFromSupabase } from './supabaseData';

// ─── Foreground handler: показувати банер навіть коли додаток відкритий ───
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch (e) {
  // Notifications not available in Expo Go - silent fail
}

// ─── Android канали ───
export async function setupChannels() {
  if (Platform.OS !== 'android') return;

  try {
    await Notifications.setNotificationChannelAsync('expired', {
      name: 'Прострочені терміни',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 300, 200, 300],
      enableVibrate: true,
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('expiring', {
      name: 'Скоро закінчуються',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 200],
      enableVibrate: true,
      sound: 'default',
    });
  } catch (e) {
    // setupChannels not available in Expo Go - silent fail
  }
}

// ─── Запит дозволу ───
export async function requestPermissions() {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    // requestPermissions not available in Expo Go - silent fail
    return false;
  }
}

// ─── Helpers ───

function parseDateStr(str) {
  if (!str || str === '—' || str === '') return null;
  const parts = str.split('.');
  if (parts.length !== 3) return null;
  return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
}

function daysUntil(expiryStr) {
  const expiry = parseDateStr(expiryStr);
  if (!expiry) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  return Math.floor((expiry - now) / (1000 * 60 * 60 * 24));
}

function addMonthsFmt(dateStr, months) {
  const d = parseDateStr(dateStr);
  if (!d) return null;
  d.setMonth(d.getMonth() + months);
  const day = d.getDate().toString().padStart(2, '0');
  const mon = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${day}.${mon}.${d.getFullYear()}`;
}

function daysWord(n) {
  const abs = Math.abs(n);
  const lastTwo = abs % 100;
  const lastOne = abs % 10;
  if (lastTwo >= 11 && lastTwo <= 19) return 'діб';
  if (lastOne === 1) return 'добу';
  if (lastOne >= 2 && lastOne <= 4) return 'доби';
  return 'діб';
}

// ─── Збирання повідомлень ───

function collectAlerts(breaksData, annualData) {
  const alerts = [];

  // МУ
  if (breaksData?.mu) {
    Object.entries(breaksData.mu).forEach(([muType, items]) => {
      items.forEach((item) => {
        if (item.color !== 'yellow' && item.color !== 'red') return;
        const rem = daysUntil(item.expiryDate);
        alerts.push({
          id: `mu|${muType}|${item.aircraft}`,
          type: item.color,
          body:
            item.color === 'red'
              ? `У Вас закінчився термін ${muType} на ${item.aircraft}`
              : `Через ${rem} ${daysWord(rem)} у Вас закінчиться термін ${muType} на ${item.aircraft}`,
        });
      });
    });
  }

  // ЛП
  if (breaksData?.lp) {
    Object.entries(breaksData.lp).forEach(([lpType, items]) => {
      if (!items.length) return;
      const first = items[0];
      if (first.color !== 'yellow' && first.color !== 'red') return;
      const rem = daysUntil(first.expiryDate);
      alerts.push({
        id: `lp|${lpType}`,
        type: first.color,
        body:
          first.color === 'red'
            ? `У Вас закінчився термін "${lpType}"`
            : `Через ${rem} ${daysWord(rem)} у Вас закінчиться термін "${lpType}"`,
      });
    });
  }

  // Commission
  if (breaksData?.commission) {
    const comm = breaksData.commission;

    const llkUmo = comm['ЛЛК/УМО'];
    if (llkUmo?.llk && (llkUmo.llk.color === 'yellow' || llkUmo.llk.color === 'red')) {
      const exp = addMonthsFmt(llkUmo.llk.date, 12);
      const rem = daysUntil(exp);
      alerts.push({
        id: 'comm|ЛЛК',
        type: llkUmo.llk.color,
        body:
          llkUmo.llk.color === 'red'
            ? 'У Вас закінчився термін ЛЛК'
            : `Через ${rem} ${daysWord(rem)} у Вас закінчиться термін ЛЛК`,
      });
    }

    if (llkUmo?.umo && (llkUmo.umo.color === 'yellow' || llkUmo.umo.color === 'red')) {
      const exp = addMonthsFmt(llkUmo.umo.date, 6);
      const rem = daysUntil(exp);
      alerts.push({
        id: 'comm|УМО',
        type: llkUmo.umo.color,
        body:
          llkUmo.umo.color === 'red'
            ? 'У Вас закінчився термін УМО'
            : `Через ${rem} ${daysWord(rem)} у Вас закінчиться термін УМО`,
      });
    }

    (comm['Ст. 205 ПРІАЗ'] || []).forEach((item) => {
      if (item.color !== 'yellow' && item.color !== 'red') return;
      const rem = daysUntil(item.expiryDate);
      alerts.push({
        id: `comm|ПРІАЗ|${item.aircraft}`,
        type: item.color,
        body:
          item.color === 'red'
            ? `У Вас закінчився термін Ст. 205 ПРІАЗ на ${item.aircraft}`
            : `Через ${rem} ${daysWord(rem)} у Вас закінчиться термін Ст. 205 ПРІАЗ на ${item.aircraft}`,
      });
    });

    ['Аварійне залишення', 'Відпустка', 'Стрибки з парашутом'].forEach((name) => {
      (comm[name] || []).forEach((item) => {
        if (item.color !== 'yellow' && item.color !== 'red') return;
        const rem = daysUntil(item.expiryDate);
        alerts.push({
          id: `comm|${name}`,
          type: item.color,
          body:
            item.color === 'red'
              ? `У Вас закінчився термін "${name}"`
              : `Через ${rem} ${daysWord(rem)} у Вас закінчиться термін "${name}"`,
        });
      });
    });
  }

  // Річні перевірки
  if (annualData?.checks) {
    annualData.checks.forEach((check) => {
      if (check.color !== 'yellow' && check.color !== 'red') return;
      const exp = addMonthsFmt(check.date, 12);
      const rem = daysUntil(exp);
      alerts.push({
        id: `annual|${check.check_type}`,
        type: check.color,
        body:
          check.color === 'red'
            ? `У Вас закінчився термін перевірки "${check.check_type}"`
            : `Через ${rem} ${daysWord(rem)} у Вас закінчиться термін перевірки "${check.check_type}"`,
      });
    });
  }

  return alerts;
}

// ─── Головна функція: перевірити та надіслати повідомлення ───

const STORAGE_KEY = 'last_notification_date';

export async function checkAndNotify(pib) {
  if (!pib) return 0;

  try {
    const [breaksRes, annualRes] = await Promise.all([
      getBreaksDataFromSupabase(pib),
      getAnnualChecksFromSupabase(pib),
    ]);

    const breaksData = breaksRes?.ok ? breaksRes.data : {};
    const annualData = annualRes?.ok ? annualRes : { checks: [] };
    const alerts = collectAlerts(breaksData, annualData);

    // Зберегти ID алертів для бейджа
    const alertIds = alerts.map((a) => a.id);
    await AsyncStorage.setItem('inbox_alert_ids', JSON.stringify(alertIds));

    // Порахувати непрочитані
    const unread = await getUnreadCount();

    // Push-повідомлення — максимум 1 раз на день
    const today = new Date().toISOString().split('T')[0];
    const lastDate = await AsyncStorage.getItem(STORAGE_KEY);

    if (lastDate !== today && alerts.length > 0) {
      try { await Notifications.dismissAllNotificationsAsync(); } catch (_) {}

      const redAlerts = alerts.filter((a) => a.type === 'red');
      const yellowAlerts = alerts.filter((a) => a.type === 'yellow');

      if (redAlerts.length > 0) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `Прострочено: ${redAlerts.length}`,
            body: redAlerts.map((a) => a.body).join('\n'),
            sound: 'default',
            ...(Platform.OS === 'android' && { channelId: 'expired' }),
          },
          trigger: null,
        });
      }

      if (yellowAlerts.length > 0) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `Скоро закінчується: ${yellowAlerts.length}`,
            body: yellowAlerts.map((a) => a.body).join('\n'),
            sound: 'default',
            ...(Platform.OS === 'android' && { channelId: 'expiring' }),
          },
          trigger: null,
        });
      }

      Vibration.vibrate(redAlerts.length > 0 ? [0, 300, 200, 300] : [0, 200]);
      await AsyncStorage.setItem(STORAGE_KEY, today);
    }

    return unread;
  } catch (e) {
    console.warn('checkAndNotify error:', e);
    return 0;
  }
}

// ─── Отримати кількість непрочитаних ───

export async function getUnreadCount() {
  try {
    const [alertsRaw, readRaw] = await Promise.all([
      AsyncStorage.getItem('inbox_alert_ids'),
      AsyncStorage.getItem('inbox_read_ids'),
    ]);
    const alerts = alertsRaw ? JSON.parse(alertsRaw) : [];
    const readSet = new Set(readRaw ? JSON.parse(readRaw) : []);
    return alerts.filter((id) => !readSet.has(id)).length;
  } catch {
    return 0;
  }
}
