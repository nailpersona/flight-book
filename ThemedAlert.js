// ThemedAlert.js — Кастомний Alert у стилі теми застосунку
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Colors, Shadows, BorderRadius, Spacing, FONT } from './theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Глобальна черга для показу alert'ів
let alertQueue = [];
let currentAlert = null;
let setAlertVisible = null;
let setCurrentAlert = null;

export const ThemedAlert = {
  alert: (title, message, buttons = [], options = {}) => {
    const alertId = Date.now() + Math.random();

    // Default buttons if none provided
    if (buttons.length === 0) {
      buttons = [{ text: 'OK', onPress: () => {} }];
    }

    const alertData = {
      id: alertId,
      title,
      message,
      buttons,
      options,
    };

    alertQueue.push(alertData);
    processQueue();

    return alertId;
  },

  // Короткі методи для зручності
  success: (title, message) => {
    return ThemedAlert.alert(title, message, [{ text: 'OK' }]);
  },

  error: (title, message) => {
    return ThemedAlert.alert(title, message, [{ text: 'OK', style: 'destructive' }]);
  },

  confirm: (title, message, onConfirm, onCancel) => {
    return ThemedAlert.alert(title, message, [
      { text: 'Скасувати', onPress: onCancel, style: 'cancel' },
      { text: 'Так', onPress: onConfirm },
    ]);
  },
};

function processQueue() {
  if (currentAlert || alertQueue.length === 0) return;

  const nextAlert = alertQueue.shift();
  currentAlert = nextAlert;

  if (setCurrentAlert) {
    setCurrentAlert(nextAlert);
  }

  if (setAlertVisible) {
    setAlertVisible(true);
  }
}

function dismissAlert(result) {
  if (!currentAlert) return;

  const alertToDismiss = currentAlert;
  currentAlert = null;

  if (setCurrentAlert) {
    setCurrentAlert(null);
  }

  // Small delay before showing next alert
  setTimeout(() => {
    if (setAlertVisible) {
      setAlertVisible(false);
    }
    setTimeout(() => {
      processQueue();
    }, 300);
  }, 100);
}

export function ThemedAlertComponent() {
  const [visible, setVisible] = React.useState(false);
  const [alert, setAlert] = React.useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    setAlertVisible = setVisible;
    setCurrentAlert = setAlert;

    return () => {
      setAlertVisible = null;
      setCurrentAlert = null;
    };
  }, []);

  useEffect(() => {
    if (visible && alert) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 50,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (!visible) {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
    }
  }, [visible, alert]);

  const handleButtonPress = (button) => {
    if (button.onPress) {
      button.onPress();
    }
    dismissAlert();
  };

  const getButtonStyle = (style) => {
    switch (style) {
      case 'destructive':
        return styles.buttonDestructive;
      case 'cancel':
        return styles.buttonCancel;
      default:
        return styles.buttonDefault;
    }
  };

  const getButtonTextStyle = (style) => {
    switch (style) {
      case 'destructive':
        return styles.textDestructive;
      case 'cancel':
        return styles.textCancel;
      default:
        return styles.textDefault;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.card,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          {/* Title */}
          {alert?.title && (
            <Text style={styles.title}>{alert.title}</Text>
          )}

          {/* Message */}
          {alert?.message && (
            <Text style={styles.message}>{alert.message}</Text>
          )}

          {/* Buttons */}
          <View style={styles.buttonsContainer}>
            {alert?.buttons.map((button, index) => (
              <TouchableOpacity
                key={`${alert.id}-${index}`}
                style={[
                  styles.button,
                  index > 0 && styles.buttonSecondary,
                  getButtonStyle(button.style),
                ]}
                onPress={() => handleButtonPress(button)}
                activeOpacity={0.7}
              >
                <Text style={[styles.buttonText, getButtonTextStyle(button.style)]}>
                  {button.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },

  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: Colors.bgPrimary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    ...Shadows.large,
  },

  title: {
    fontFamily: FONT,
    fontSize: 18,
    fontWeight: '400',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },

  message: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '400',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },

  buttonsContainer: {
    gap: Spacing.sm,
  },

  button: {
    height: 46,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.btnDark,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.small,
  },

  buttonSecondary: {
    marginTop: Spacing.xs,
  },

  buttonDefault: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },

  buttonCancel: {
    backgroundColor: Colors.bgSecondary,
    borderColor: Colors.border,
  },

  buttonDestructive: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },

  buttonText: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '400',
    color: Colors.textInverse,
  },

  textDefault: {
    color: Colors.textInverse,
  },

  textCancel: {
    color: Colors.textPrimary,
  },

  textDestructive: {
    color: '#DC2626',
  },
});

export default ThemedAlert;
