import React, { useContext, useEffect, useState, useCallback } from 'react';
import {
  SafeAreaView, View, Text, ScrollView, ActivityIndicator,
  RefreshControl, TouchableOpacity, StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { AuthCtx, InboxBadgeCtx, rootNavigationRef } from './contexts';
import { getBreaksDataFromSupabase, getAnnualChecksFromSupabase } from './supabaseData';
import { Colors, Shadows, BorderRadius, Spacing, FONT } from './theme';

// ---------- helpers ----------

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

function todayFormatted() {
  const d = new Date();
  const day = d.getDate().toString().padStart(2, '0');
  const mon = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${day}.${mon}.${d.getFullYear()}`;
}

// ---------- screen mapping ----------

const SCREEN_MAP = {
  'Перерви МУ': 'BreaksMU',
  'Перерви ЛП': 'BreaksLP',
  'Комісування': 'CommissionTable',
  'Річні перевірки': 'AnnualChecks',
};

// ---------- notification builder ----------

function buildNotifications(breaksData, annualData) {
  const items = [];
  const date = todayFormatted();

  // — МУ breaks —
  if (breaksData?.mu) {
    Object.entries(breaksData.mu).forEach(([muType, list]) => {
      list.forEach((item) => {
        if (item.color !== 'yellow' && item.color !== 'red') return;
        const rem = daysUntil(item.expiryDate);
        items.push({
          id: `mu|${muType}|${item.aircraft}`,
          type: item.color,
          category: 'Перерви МУ',
          screen: 'BreaksMU',
          date,
          message:
            item.color === 'red'
              ? `У Вас закінчився термін ${muType} на ${item.aircraft}`
              : `Через ${rem} ${daysWord(rem)} у Вас закінчиться термін ${muType} на ${item.aircraft}`,
          remaining: rem,
        });
      });
    });
  }

  // — ЛП breaks —
  if (breaksData?.lp) {
    Object.entries(breaksData.lp).forEach(([lpType, list]) => {
      if (!list.length) return;
      const first = list[0];
      if (first.color !== 'yellow' && first.color !== 'red') return;
      const rem = daysUntil(first.expiryDate);
      items.push({
        id: `lp|${lpType}`,
        type: first.color,
        category: 'Перерви ЛП',
        screen: 'BreaksLP',
        date,
        message:
          first.color === 'red'
            ? `У Вас закінчився термін "${lpType}"`
            : `Через ${rem} ${daysWord(rem)} у Вас закінчиться термін "${lpType}"`,
        remaining: rem,
      });
    });
  }

  // — Commission —
  if (breaksData?.commission) {
    const comm = breaksData.commission;

    const llkUmo = comm['ЛЛК/УМО'];
    if (llkUmo?.llk && (llkUmo.llk.color === 'yellow' || llkUmo.llk.color === 'red')) {
      const exp = addMonthsFmt(llkUmo.llk.date, 12);
      const rem = daysUntil(exp);
      items.push({
        id: 'comm|ЛЛК',
        type: llkUmo.llk.color,
        category: 'Комісування',
        screen: 'CommissionTable',
        date,
        message:
          llkUmo.llk.color === 'red'
            ? 'У Вас закінчився термін ЛЛК'
            : `Через ${rem} ${daysWord(rem)} у Вас закінчиться термін ЛЛК`,
        remaining: rem,
      });
    }

    if (llkUmo?.umo && (llkUmo.umo.color === 'yellow' || llkUmo.umo.color === 'red')) {
      const exp = addMonthsFmt(llkUmo.umo.date, 6);
      const rem = daysUntil(exp);
      items.push({
        id: 'comm|УМО',
        type: llkUmo.umo.color,
        category: 'Комісування',
        screen: 'CommissionTable',
        date,
        message:
          llkUmo.umo.color === 'red'
            ? 'У Вас закінчився термін УМО'
            : `Через ${rem} ${daysWord(rem)} у Вас закінчиться термін УМО`,
        remaining: rem,
      });
    }

    (comm['Ст. 205 ПРІАЗ'] || []).forEach((item) => {
      if (item.color !== 'yellow' && item.color !== 'red') return;
      const rem = daysUntil(item.expiryDate);
      items.push({
        id: `comm|ПРІАЗ|${item.aircraft}`,
        type: item.color,
        category: 'Комісування',
        screen: 'CommissionTable',
        date,
        message:
          item.color === 'red'
            ? `У Вас закінчився термін Ст. 205 ПРІАЗ на ${item.aircraft}`
            : `Через ${rem} ${daysWord(rem)} у Вас закінчиться термін Ст. 205 ПРІАЗ на ${item.aircraft}`,
        remaining: rem,
      });
    });

    ['Аварійне залишення', 'Відпустка', 'Стрибки з парашутом'].forEach((name) => {
      (comm[name] || []).forEach((item) => {
        if (item.color !== 'yellow' && item.color !== 'red') return;
        const rem = daysUntil(item.expiryDate);
        items.push({
          id: `comm|${name}`,
          type: item.color,
          category: 'Комісування',
          screen: 'CommissionTable',
          date,
          message:
            item.color === 'red'
              ? `У Вас закінчився термін "${name}"`
              : `Через ${rem} ${daysWord(rem)} у Вас закінчиться термін "${name}"`,
          remaining: rem,
        });
      });
    });
  }

  // — Annual checks —
  if (annualData?.checks) {
    annualData.checks.forEach((check) => {
      if (check.color !== 'yellow' && check.color !== 'red') return;
      const exp = addMonthsFmt(check.date, 12);
      const rem = daysUntil(exp);
      items.push({
        id: `annual|${check.check_type}`,
        type: check.color,
        category: 'Річні перевірки',
        screen: 'AnnualChecks',
        date,
        message:
          check.color === 'red'
            ? `У Вас закінчився термін перевірки "${check.check_type}"`
            : `Через ${rem} ${daysWord(rem)} у Вас закінчиться термін перевірки "${check.check_type}"`,
        remaining: rem,
      });
    });
  }

  // Sort: red first, then yellow; within group — by remaining ascending
  items.sort((a, b) => {
    if (a.type === 'red' && b.type !== 'red') return -1;
    if (a.type !== 'red' && b.type === 'red') return 1;
    return (a.remaining ?? -9999) - (b.remaining ?? -9999);
  });

  return items;
}

// ---------- card colours ----------

const CARD = {
  yellow: {
    bg: '#FFF8E1',
    border: '#FFE082',
    icon: '#F59E0B',
    text: '#92400E',
    category: '#B45309',
    eyeBg: '#FEF3C7',
  },
  red: {
    bg: '#FEF2F2',
    border: '#FECACA',
    icon: '#EF4444',
    text: '#991B1B',
    category: '#B91C1C',
    eyeBg: '#FEE2E2',
  },
};

const READ_STYLE = {
  bg: Colors.bgPrimary,
  border: Colors.border,
  icon: Colors.textTertiary,
  text: Colors.textSecondary,
  category: Colors.textTertiary,
  eyeBg: Colors.bgTertiary,
};

// ---------- read state helpers ----------

const READ_KEY = 'inbox_read_ids';

async function loadReadIds() {
  try {
    const raw = await AsyncStorage.getItem(READ_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

async function saveReadIds(set) {
  await AsyncStorage.setItem(READ_KEY, JSON.stringify([...set]));
}

// ---------- component ----------

export default function Inbox({ navigation }) {
  const { auth } = useContext(AuthCtx);
  const { setBadge } = useContext(InboxBadgeCtx);
  const pib = auth?.pib || '';
  const isAdmin = auth?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds] = useState(new Set());

  const updateBadge = useCallback((notifs, read) => {
    const unread = notifs.filter((n) => !read.has(n.id)).length;
    setBadge(unread);
  }, [setBadge]);

  const load = useCallback(async () => {
    if (!pib) return;
    try {
      const [breaksRes, annualRes, storedRead] = await Promise.all([
        getBreaksDataFromSupabase(pib),
        getAnnualChecksFromSupabase(pib),
        loadReadIds(),
      ]);
      const breaksData = breaksRes?.ok ? breaksRes.data : {};
      const annualData = annualRes?.ok ? annualRes : { checks: [] };
      const notifs = buildNotifications(breaksData, annualData);

      // Зберегти alert IDs для notifications.js бейджа
      const alertIds = notifs.map((n) => n.id);
      await AsyncStorage.setItem('inbox_alert_ids', JSON.stringify(alertIds));

      // Очистити прочитані які більше не актуальні
      const validIds = new Set(alertIds);
      const cleanRead = new Set([...storedRead].filter((id) => validIds.has(id)));
      if (cleanRead.size !== storedRead.size) {
        await saveReadIds(cleanRead);
      }

      setNotifications(notifs);
      setReadIds(cleanRead);
      updateBadge(notifs, cleanRead);
    } catch (e) {
      console.warn('Inbox load error', e);
      setNotifications([]);
    }
  }, [pib, updateBadge]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Натиск на картку → прочитано
  const markRead = useCallback(async (id) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveReadIds(next);
      updateBadge(notifications, next);
      return next;
    });
  }, [notifications, updateBadge]);

  // Натиск на око → перейти на екран
  const goToScreen = useCallback((screenName) => {
    if (rootNavigationRef.isReady()) {
      rootNavigationRef.navigate(screenName, { pib, isAdmin });
    }
  }, [pib, isAdmin]);

  // ---------- render ----------

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.textTertiary} />
        </View>
      </SafeAreaView>
    );
  }

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;
  const redCount = notifications.filter((n) => n.type === 'red').length;
  const yellowCount = notifications.filter((n) => n.type === 'yellow').length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Summary bar */}
      {notifications.length > 0 && (
        <View style={styles.summary}>
          {redCount > 0 && (
            <View style={styles.summaryChip}>
              <View style={[styles.summaryDot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.summaryText}>Прострочено: {redCount}</Text>
            </View>
          )}
          {yellowCount > 0 && (
            <View style={styles.summaryChip}>
              <View style={[styles.summaryDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.summaryText}>Скоро: {yellowCount}</Text>
            </View>
          )}
          {unreadCount > 0 && (
            <View style={[styles.summaryChip, { marginLeft: 'auto' }]}>
              <Text style={[styles.summaryText, { color: Colors.textTertiary }]}>
                Нових: {unreadCount}
              </Text>
            </View>
          )}
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.textTertiary} />
        }
      >
        {notifications.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="checkmark-circle-outline" size={52} color={Colors.success} />
            <Text style={styles.emptyTitle}>Все в порядку</Text>
            <Text style={styles.emptySubtitle}>Немає прострочених або скоро закінчуваних термінів</Text>
          </View>
        ) : (
          notifications.map((n) => {
            const isRead = readIds.has(n.id);
            const c = isRead ? READ_STYLE : CARD[n.type];
            return (
              <TouchableOpacity
                key={n.id}
                activeOpacity={0.7}
                onPress={() => markRead(n.id)}
                style={[
                  styles.card,
                  {
                    backgroundColor: c.bg,
                    borderLeftColor: c.border,
                    borderLeftWidth: 4,
                  },
                ]}
              >
                <View style={styles.cardRow}>
                  {/* Іконка статусу */}
                  <Ionicons
                    name={n.type === 'red' ? 'close-circle' : 'warning'}
                    size={22}
                    color={c.icon}
                    style={styles.cardIcon}
                  />

                  {/* Текст повідомлення */}
                  <View style={styles.cardContent}>
                    <Text style={[styles.cardMessage, { color: c.text }]}>{n.message}</Text>
                    <View style={styles.cardFooter}>
                      <Text style={[styles.cardCategory, { color: c.category }]}>{n.category}</Text>
                      <Text style={[styles.cardDate, { color: c.category }]}>{n.date}</Text>
                    </View>
                  </View>

                  {/* Око — перехід на сторінку */}
                  <TouchableOpacity
                    onPress={() => goToScreen(n.screen)}
                    style={[styles.eyeBtn, { backgroundColor: c.eyeBg }]}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="eye-outline" size={20} color={c.icon} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------- styles ----------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgSecondary,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Summary
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.bgPrimary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  summaryText: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textPrimary,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: 10,
  },

  // Card
  card: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Shadows.small,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardIcon: {
    marginTop: 1,
    marginRight: 10,
  },
  cardContent: {
    flex: 1,
  },
  cardMessage: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 21,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  cardCategory: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '400',
    opacity: 0.7,
  },
  cardDate: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '400',
    opacity: 0.5,
  },

  // Eye button
  eyeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  // Empty state
  emptyWrap: {
    alignItems: 'center',
    marginTop: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontFamily: FONT,
    fontSize: 18,
    fontWeight: '400',
    color: Colors.textPrimary,
    marginTop: 16,
  },
  emptySubtitle: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: 8,
  },
});
