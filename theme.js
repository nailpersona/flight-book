// theme.js — Централізована тема для сучасного чоловічого дизайну
import { Platform } from 'react-native';

export const FONT = 'NewsCycle-Regular';

// Кольори — сіро-чорні чоловічі тони з теплим акцентом
export const Colors = {
  // Primary — майже чорний
  primary: '#111827',

  // Accent — теплий сіро-коричневий (taupe) для акцентів
  accent: '#78716C',

  // Backgrounds
  bgPrimary: '#FFFFFF',
  bgSecondary: '#F9FAFB',
  bgTertiary: '#F3F4F6',

  // Text
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textInverse: '#FFFFFF',

  // Borders
  border: '#E5E7EB',
  borderLight: '#F3F4F6',

  // Status
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // Buttons
  btnDark: '#1F2937',
  btnGray: '#6B7280',
  btnLight: '#F3F4F6',
};

// Тіні
export const Shadows = {
  small: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  large: {
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
};

// Border Radius
export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 14,
  xl: 16,
  round: 999,
};

// Spacing
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

// Tab bar styling (як у beauty-persona)
export const TabBarStyles = {
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgPrimary,
    paddingTop: Platform.OS === 'android' ? 35 : 45,
    paddingHorizontal: 4,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.primary,
  },
  tabIcon: {
    fontSize: 10,
    fontWeight: '400',
    color: Colors.textTertiary,
    marginTop: 4,
  },
  tabIconActive: {
    color: Colors.primary,
  },
};

// Common styles
export const commonStyles = {
  // Кнопки
  btn: {
    height: 48,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    ...Shadows.medium,
  },
  btnDark: {
    backgroundColor: Colors.btnDark,
  },
  btnPrimary: {
    backgroundColor: Colors.primary,
  },
  btnAccent: {
    backgroundColor: Colors.accent,
  },
  btnGray: {
    backgroundColor: Colors.btnGray,
  },
  btnLight: {
    backgroundColor: Colors.btnLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btnText: {
    color: Colors.textInverse,
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '400',
  },
  btnTextDark: {
    color: Colors.textPrimary,
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '400',
  },

  // Inputs
  input: {
    minHeight: 44,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bgPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputText: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '400',
    color: Colors.textPrimary,
  },
  label: {
    fontFamily: FONT,
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: 6,
    fontWeight: '400',
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: Colors.bgPrimary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    ...Shadows.large,
  },
  modalTitle: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '400',
    marginBottom: 10,
    color: Colors.textPrimary,
  },

  // Chips
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgTertiary,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  chipText: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '400',
    color: Colors.textPrimary,
    flexShrink: 1,
  },

  // Cards
  card: {
    backgroundColor: Colors.bgPrimary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.small,
  },
};
