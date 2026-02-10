// contexts.js — всі контексти в одному місці, щоб уникнути циклічних залежностей
import React, { createContext } from 'react';
import { createNavigationContainerRef } from '@react-navigation/native';

// Контекст автентифікації
export const AuthCtx = createContext({ auth: null, setAuth: () => {} });

// Контекст бейджа «Вхідні»
export const InboxBadgeCtx = createContext({ badge: 0, setBadge: () => {} });

// Глобальний navigation ref — доступний з будь-якого компоненту
export const rootNavigationRef = createNavigationContainerRef();
