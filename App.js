// App.js — стабільна версія + збереження сесії на 7 днів і відновлення email
import React, { useEffect, useState, createContext } from 'react';
import { View, ActivityIndicator, Platform, StatusBar, Text, TextInput } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Font from 'expo-font';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setupChannels, requestPermissions, checkAndNotify } from './notifications';

// Екрани
import LoginScreen from './Login';
import FixedTabNavigator from './FixedTabNavigator';

// Тема
import { Colors, FONT } from './theme';
// Контексти
import { AuthCtx, InboxBadgeCtx, rootNavigationRef } from './contexts';

const Stack = createNativeStackNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: Colors.bgTertiary },
};

export default function App() {
  const [ready, setReady] = useState(false);
  const [auth, setAuth] = useState(null); // {token, role, pib, email, expires}
  const [inboxBadge, setInboxBadge] = useState(0);

  // завантаження шрифту + відновлення сесії
  useEffect(() => {
    (async () => {
      try {
        await Font.loadAsync({
          [FONT]: require('./assets/fonts/NewsCycle-Regular.ttf'),
        });

        // Щоб шрифт був за замовчуванням у <Text> і <TextInput>
        const patch = (Comp) => {
          const orig = Comp.render;
          if (!orig) return;
          Comp.render = function (...args) {
            const el = orig.call(this, ...args);
            return React.cloneElement(el, {
              style: [{ fontFamily: FONT }, el.props?.style],
            });
          };
        };
        patch(Text);
        patch(TextInput);

        // Відновлення auth з AsyncStorage (і перевірка expires)
        const raw = await AsyncStorage.getItem('auth');
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed?.token) {
              const now = Date.now();
              // якщо немає expires — вважаємо валідним (задля сумісності),
              // якщо є — має бути > now
              if (!parsed.expires || parsed.expires > now) {
                // Оновлюємо expires на +7 днів від зараз (активність продовжує сесію)
                const WEEK = 7 * 24 * 60 * 60 * 1000;
                parsed.expires = now + WEEK;
                setAuth(parsed);
              }
            }
          } catch {}
        }
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // зберігати auth у сховище при зміні
  useEffect(() => {
    (async () => {
      if (auth?.token) {
        await AsyncStorage.setItem('auth', JSON.stringify(auth));
      } else {
        await AsyncStorage.removeItem('auth');
      }
    })();
  }, [auth]);

  // Push-повідомлення про закінчення термінів + бейдж
  useEffect(() => {
    if (!auth?.pib) return;
    (async () => {
      await setupChannels();
      const granted = await requestPermissions();
      if (granted) {
        const unread = await checkAndNotify(auth.pib);
        setInboxBadge(unread);
      }
    })();
  }, [auth?.pib]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgTertiary }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <AuthCtx.Provider value={{ auth, setAuth }}>
    <InboxBadgeCtx.Provider value={{ badge: inboxBadge, setBadge: setInboxBadge }}>
      <NavigationContainer ref={rootNavigationRef} theme={navTheme}>
        <StatusBar
          barStyle={Platform.OS === 'ios' ? 'dark-content' : 'light-content'}
          backgroundColor={Colors.primary}
        />
        <Stack.Navigator
          initialRouteName={auth?.token ? 'Tabs' : 'Login'}
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: Colors.bgTertiary,
            },
          }}
        >
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen
            name="Tabs"
            component={FixedTabNavigator}
            options={{
              contentStyle: {
                backgroundColor: Colors.bgTertiary,
              },
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </InboxBadgeCtx.Provider>
    </AuthCtx.Provider>
  );
}