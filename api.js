// api.js
// УВАГА: URL веб-апки читаємо з app.json → expo.extra.webAppUrl

import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* ===== helpers ===== */

function readExtra() {
  // Працює у різних версіях Expo
  return (
    Constants?.expoConfig?.extra ||
    Constants?.manifest?.extra ||
    Constants?.manifest2?.extra ||
    {}
  );
}

export async function getBaseUrl() {
  // Спочатку дивимось в AsyncStorage (налаштування користувача)
  try {
    const stored = await AsyncStorage.getItem('webAppUrl');
    if (stored && stored.trim()) {
      return stored.trim();
    }
  } catch (error) {
    console.warn('Помилка читання webAppUrl з AsyncStorage:', error);
  }

  // Fallback до environment variable або app.json extra
  const extra = readExtra();
  const url = (extra && extra.webAppUrl) ? String(extra.webAppUrl).trim() :
    process.env.EXPO_PUBLIC_API_URL || '';
  return url;
}

export async function setBaseUrl(url) {
  // Зберігаємо URL в AsyncStorage
  try {
    await AsyncStorage.setItem('webAppUrl', url.trim());
  } catch (error) {
    throw new Error('Не вдалося зберегти URL: ' + error.message);
  }
}

async function ensureBase() {
  const base = await getBaseUrl();
  if (!base) {
    throw new Error('WEB_APP_URL порожній. Перевір app.json → expo.extra.webAppUrl або налаштування');
  }
  return base;
}

// універсальні запити
async function getJson(url, opts = {}) {
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  return res.json();
}

async function postJson(url, body = {}, opts = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    body: JSON.stringify(body),
    ...opts,
  });
  return res.json();
}

/* ===== API ===== */

const api = {
  // Логін
  async login(email, password) {
    const base = await ensureBase();
    return postJson(`${base}?action=login`, { email, password });
  },

  // Довідники для селектів
  async lists() {
    const base = await ensureBase();
    // cache-buster _ts
    return getJson(`${base}?type=lists&_ts=${Date.now()}`);
  },

  // Додати рядок
  async add(token, data) {
    const base = await ensureBase();
    return postJson(`${base}?action=add`, { token, data });
  },

  // Список рядків користувача (або всіх для admin). Повертає також rowIndex
  async rows(token) {
    const base = await ensureBase();
    return getJson(
      `${base}?type=rows&token=${encodeURIComponent(token)}&_ts=${Date.now()}`
    );
  },

  // Оновити існуючий рядок за 1-based rowIndex з GAS
  async updateRow(token, row, data) {
    const base = await ensureBase();
    return postJson(`${base}?action=update`, { token, row, data });
  },

  // Видалити рядок
  async deleteRow(token, row) {
    const base = await ensureBase();
    return postJson(`${base}?action=delete`, { token, row });
  },

  // Оновлення профілю (зміна пароля / за потреби email)
  async profileUpdate(token, newPassword) {
    const base = await ensureBase();
    return postJson(`${base}?action=profileUpdate`, {
      token,
      newPassword
    });
  },

  // Створення користувача адміном
  async adminCreateUser(token, userData) {
    const base = await ensureBase();
    return postJson(`${base}?action=adminCreateUser`, { 
      token, 
      ...userData 
    });
  },

  async getValidationPilots(token) {
  const base = await ensureBase();
  return getJson(
    `${base}?type=validationPilots&token=${encodeURIComponent(token)}&_ts=${Date.now()}`
  );
},

// Додати в api.js:
async updateCommissionDate(token, pib, category, date) {
  const base = await ensureBase();
  
  const formData = new FormData();
  formData.append('action', 'updateCommissionDate');
  formData.append('token', token);
  formData.append('pib', pib);
  formData.append('category', category);
  formData.append('date', date);
  
  const response = await fetch(base, {
    method: 'POST',
    body: formData
  });
  
  return await response.json();
},

async updateProfile(token, data) {
  const base = await ensureBase();
  
  const body = JSON.stringify({
    action: 'profileUpdate',
    token: token,
    newPassword: data.newPassword
  });
  
  const response = await fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body
  });
  
  return await response.json();
},

  // Отримання динамічних довідників з fallback
  async getDynamicLists() {
    try {
      const data = await this.lists();
      if (data?.ok && data.lists) {
        return data.lists;
      }
    } catch (error) {
      console.warn('Не вдалося завантажити динамічні списки:', error);
    }
    
    // Fallback до статичних списків
    return {
      'Тип ПС': ['Су-27', 'МіГ-29', 'Ми-8', 'Л-39', 'Су-24'],
      'Час доби МУ': ['ДПМУ', 'ДСМУ', 'ДВМП', 'НПМУ', 'НСМУ', 'НВМП'],
      'Вид пол.': ['Бойовий', 'Випробувальний', 'Учбово-тренув.', 'За методиками'],
      'Примітки': [
        'Вивід з-під удару', 'Складний пілотаж', 'Мала висота', 'Гр. мала висота (ОНБ)',
        'Бойове застосування', 'Групова злітаність', 'На десантування',
      ],
    };
  },

  // Отримання даних перерв для користувача
  async getBreaksData(token, pib) {
    const base = await ensureBase();
    return getJson(
      `${base}?type=breaks&token=${encodeURIComponent(token)}&pib=${encodeURIComponent(pib)}&_ts=${Date.now()}`
    );
  },

  // Оновлення дат комісування
  async updateCommissionDate(token, pib, category, date) {
    const base = await ensureBase();
    
    const formData = new FormData();
    formData.append('action', 'updateCommissionDate');
    formData.append('token', token);
    formData.append('pib', pib);
    formData.append('category', category);
    formData.append('date', date);
    
    const response = await fetch(base, {
      method: 'POST',
      body: formData
    });
    
    return await response.json();
  },

  // Отримання списку всіх ПІБ (для адміна)
  async getAllPilots(token) {
    const base = await ensureBase();
    return getJson(
      `${base}?type=pilots&token=${encodeURIComponent(token)}&_ts=${Date.now()}`
    );
  },

  // Оновлення дат комісування (альтернативний метод)
  async updateCommissionData(token, pib, field, date) {
    const base = await ensureBase();
    return postJson(`${base}?action=updateCommission`, { 
      token, 
      pib,
      field,
      date
    });
  },
};

export default api;