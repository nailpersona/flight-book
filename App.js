// App.js — стабільна версія + збереження сесії на 7 днів і відновлення email
import React, { useEffect, useState, createContext } from 'react';
import { View, ActivityIndicator, Platform, StatusBar, Text, TextInput } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Font from 'expo-font';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Екрани
import MainScreen from './Main';
import ProfileScreen from './Profile';
import SettingsScreen from './Settings';
import AdminUsersScreen from './AdminUsers';
import AdminSettingsScreen from './AdminSettings';
import LoginScreen from './Login';
import MyRecordsScreen from './MyRecords';
import BreaksMUScreen from './BreaksMU';
import BreaksLPScreen from './BreaksLP';
import CommissionTableScreen from './CommissionTable';

// ====== КОНТЕКСТ АВТЕНТИФІКАЦІЇ ======
export const AuthCtx = createContext({ auth: null, setAuth: () => {} });

const Stack = createNativeStackNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: '#F4F6F8' },
};

const FONT = 'NewsCycle-Regular';

export default function App() {
  const [ready, setReady] = useState(false);
  const [auth, setAuth] = useState(null); // {token, role, pib, email, expires}

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

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F6F8' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <AuthCtx.Provider value={{ auth, setAuth }}>
      <NavigationContainer theme={navTheme}>
        <StatusBar
          barStyle={Platform.OS === 'ios' ? 'dark-content' : 'light-content'}
          backgroundColor="#222"
        />
        <Stack.Navigator
          initialRouteName={auth?.token ? 'Main' : 'Login'}
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: '#F4F6F8',
              paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 6 : 6,
            },
          }}
        >
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Main" component={MainScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="AdminUsers" component={AdminUsersScreen} />
          <Stack.Screen name="AdminSettings" component={AdminSettingsScreen} />
          <Stack.Screen name="MyRecords" component={MyRecordsScreen} />
          <Stack.Screen name="BreaksMU" component={BreaksMUScreen} />
          <Stack.Screen name="BreaksLP" component={BreaksLPScreen} />
          <Stack.Screen name="CommissionTable" component={CommissionTableScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </AuthCtx.Provider>
  );
}