import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FONT, BorderRadius, Spacing, Shadows } from './theme';
import { supabase } from './supabase';

// Speech recognition — optional native module
let SpeechModule = null;
let useSpeechEvent = () => {};
try {
  const sr = require('expo-speech-recognition');
  SpeechModule = sr.ExpoSpeechRecognitionModule;
  useSpeechEvent = sr.useSpeechRecognitionEvent;
} catch (_) {}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [speechAvailable, setSpeechAvailable] = useState(!!SpeechModule);
  const flatListRef = useRef(null);
  const inputRef = useRef(null);

  // --- Speech recognition events (no-op if module missing) ---
  useSpeechEvent('result', (ev) => {
    const transcript = ev.results[0]?.transcript || '';
    if (transcript) setInput(transcript);
  });

  useSpeechEvent('end', () => setRecording(false));
  useSpeechEvent('error', () => setRecording(false));

  const toggleRecording = useCallback(async () => {
    if (!SpeechModule) return;

    if (recording) {
      SpeechModule.stop();
      setRecording(false);
      return;
    }

    try {
      const { granted } = await SpeechModule.requestPermissionsAsync();
      if (!granted) return;

      SpeechModule.start({ lang: 'uk-UA', interimResults: true });
      setRecording(true);
    } catch (e) {
      setSpeechAvailable(false);
    }
  }, [recording]);

  // --- Send question ---
  const sendQuestion = async (text) => {
    const question = (text || input).trim();
    if (!question || loading) return;

    const userMsg = { id: Date.now().toString(), role: 'user', text: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ask', {
        body: { question },
      });

      if (error) throw error;

      const aiMsg = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: data.answer || 'Не вдалося отримати відповідь.',
        sources: data.sources || [],
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      const errMsg = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: 'Помилка при отриманні відповіді. Спробуйте ще раз.',
        isError: true,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  // --- Render ---
  const renderMessage = ({ item }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[s.msgRow, isUser && s.msgRowUser]}>
        {!isUser && (
          <View style={s.avatar}>
            <Ionicons name="sparkles" size={16} color={Colors.textInverse} />
          </View>
        )}
        <View
          style={[
            s.bubble,
            isUser ? s.bubbleUser : s.bubbleAi,
            item.isError && s.bubbleError,
          ]}
        >
          <Text style={[s.msgText, isUser && s.msgTextUser]}>{item.text}</Text>
          {item.sources && item.sources.length > 0 && (
            <View style={s.sourcesWrap}>
              <Text style={s.sourcesLabel}>Джерела:</Text>
              {[...new Set(item.sources.map((src) => src.document))].map(
                (doc, i) => (
                  <Text key={i} style={s.sourceItem}>
                    {doc}
                  </Text>
                )
              )}
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={s.emptyWrap}>
      <Ionicons name="chatbubble-outline" size={48} color={Colors.textTertiary} />
      <Text style={s.emptyTitle}>Задайте питання</Text>
      <Text style={s.emptySubtitle}>
        КБП, КЛПВ, ПЛВР, ПВП ДАУ та інші
      </Text>
    </View>
  );

  const bottomPadding = Math.max(insets.bottom, 16);

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 80}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          s.list,
          messages.length === 0 && s.listEmpty,
        ]}
        ListEmptyComponent={renderEmpty}
        onContentSizeChange={() => {
          if (messages.length > 0) {
            flatListRef.current?.scrollToEnd({ animated: true });
          }
        }}
      />

      {loading && (
        <View style={s.typingRow}>
          <View style={s.avatar}>
            <Ionicons name="sparkles" size={16} color={Colors.textInverse} />
          </View>
          <View style={s.typingBubble}>
            <ActivityIndicator size="small" color={Colors.textSecondary} />
            <Text style={s.typingText}>Шукаю відповідь...</Text>
          </View>
        </View>
      )}

      <View style={[s.inputRow, { paddingBottom: bottomPadding }]}>
        {speechAvailable && (
          <TouchableOpacity
            style={[s.micBtn, recording && s.micBtnActive]}
            onPress={toggleRecording}
            activeOpacity={0.7}
          >
            <Ionicons
              name={recording ? 'stop' : 'mic'}
              size={22}
              color={recording ? Colors.error : Colors.textSecondary}
            />
          </TouchableOpacity>
        )}
        <TextInput
          style={s.input}
          value={input}
          onChangeText={setInput}
          placeholder={recording ? 'Говоріть...' : 'Задайте питання...'}
          placeholderTextColor={Colors.textTertiary}
          multiline
          maxLength={500}
          editable={!loading}
          onSubmitEditing={() => sendQuestion()}
          blurOnSubmit
        />
        <TouchableOpacity
          style={[s.sendBtn, (!input.trim() || loading) && s.sendBtnDisabled]}
          onPress={() => sendQuestion()}
          disabled={!input.trim() || loading}
          activeOpacity={0.7}
        >
          <Ionicons
            name="send"
            size={20}
            color={!input.trim() || loading ? Colors.textTertiary : Colors.textInverse}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgTertiary,
  },
  list: {
    padding: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  listEmpty: {
    flex: 1,
    justifyContent: 'center',
  },

  // Messages
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  msgRowUser: {
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadows.small,
  },
  bubbleUser: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAi: {
    backgroundColor: Colors.bgPrimary,
    borderBottomLeftRadius: 4,
  },
  bubbleError: {
    backgroundColor: '#FEF2F2',
  },
  msgText: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '400',
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  msgTextUser: {
    color: Colors.textInverse,
  },

  // Sources
  sourcesWrap: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  sourcesLabel: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '400',
    color: Colors.textTertiary,
    marginBottom: 4,
  },
  sourceItem: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '400',
    color: Colors.textSecondary,
    marginLeft: 8,
    lineHeight: 18,
  },

  // Typing indicator
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.bgPrimary,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...Shadows.small,
  },
  typingText: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '400',
    color: Colors.textSecondary,
  },

  // Input
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bgPrimary,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.bgTertiary,
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '400',
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: Colors.bgTertiary,
  },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.bgTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  micBtnActive: {
    backgroundColor: '#FEF2F2',
    borderColor: Colors.error,
  },

  // Empty state
  emptyWrap: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontFamily: FONT,
    fontSize: 18,
    fontWeight: '400',
    color: Colors.textPrimary,
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
});
