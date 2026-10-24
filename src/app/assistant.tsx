import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  Banner,
  Button,
  Chip,
  ChipRow,
  EmptyState,
  Screen,
  errorMessage,
  useTheme,
} from '@/components/rantau-kit';
import { askRantauAssistant, type AIMessage } from '@/services/ai.service';

type Message = { id: string; role: 'user' | 'assistant'; content: string };

const SUGGESTIONS = [
  'Ide menu makan hemat untuk anak kost',
  'Cara mengatur uang bulanan supaya tidak habis di tengah bulan',
  'Olahraga 15 menit di kamar kost',
  'Cara mengatasi kangen rumah',
];

// Dibaca saat build. Ubah di .env lalu restart dengan: npx expo start -c
const CONFIGURED = Boolean(process.env.EXPO_PUBLIC_AI_API_URL);

export default function AssistantScreen() {
  const t = useTheme();
  const listRef = useRef<FlatList<Message>>(null);
  const counter = useRef(0);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextId = () => `m${++counter.current}`;

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || sending || !CONFIGURED) return;

    // Kirim 10 pesan terakhir sebagai konteks percakapan.
    const history: AIMessage[] = messages
      .slice(-10)
      .map((message) => ({ role: message.role, content: message.content }));

    const userMessage: Message = { id: nextId(), role: 'user', content: question };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setError(null);
    setSending(true);

    try {
      const answer = await askRantauAssistant(question, history);
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'assistant', content: answer },
      ]);
    } catch (err) {
      // Kembalikan pertanyaan ke kolom ketik agar bisa dikirim ulang.
      setMessages((prev) => prev.filter((message) => message.id !== userMessage.id));
      setInput(question);
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const canSend = CONFIGURED && !sending && input.trim().length > 0;

  return (
    <Screen
      icon="sparkles-outline"
      title="Rantau AI"
      subtitle="Asisten pribadi anak rantau."
      scroll={false}>
      {!CONFIGURED ? (
        <Banner tone="warn">
          AI belum terhubung. Isi EXPO_PUBLIC_AI_API_URL di file .env dengan
          alamat backend AI-mu, lalu jalankan ulang Expo dengan npx expo start -c.
        </Banner>
      ) : null}

      <FlatList
        ref={listRef}
        style={{ flex: 1 }}
        data={messages}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, gap: 10, paddingVertical: 8 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={{ gap: 12 }}>
            <EmptyState
              icon="chatbubbles-outline"
              title="Tanya apa saja"
              hint="Dari resep hemat sampai tips bertahan di perantauan."
            />
            <ChipRow>
              {SUGGESTIONS.map((text) => (
                <Chip key={text} label={text} onPress={() => send(text)} />
              ))}
            </ChipRow>
          </View>
        }
        ListFooterComponent={
          sending ? (
            <View
              style={{
                alignSelf: 'flex-start',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                padding: 12,
              }}>
              <ActivityIndicator size="small" color={t.primary} />
              <Text style={{ color: t.muted, fontSize: 14 }}>Sedang menjawab...</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const mine = item.role === 'user';
          return (
            <View
              style={{
                alignSelf: mine ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 16,
                backgroundColor: mine ? t.primary : t.surface,
                borderWidth: mine ? 0 : 1,
                borderColor: t.border,
              }}>
              <Text
                selectable
                style={{
                  color: mine ? t.onPrimary : t.text,
                  fontSize: 15,
                  lineHeight: 22,
                }}>
                {item.content}
              </Text>
            </View>
          );
        }}
      />

      {error ? <Banner tone="error">{error}</Banner> : null}

      {messages.length > 0 ? (
        <Button
          label="Percakapan baru"
          icon="add"
          variant="ghost"
          disabled={sending}
          onPress={() => {
            setMessages([]);
            setError(null);
          }}
        />
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Tulis pertanyaanmu"
          placeholderTextColor={t.muted}
          multiline
          maxLength={1000}
          editable={CONFIGURED}
          style={{
            flex: 1,
            minHeight: 48,
            maxHeight: 120,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: t.border,
            backgroundColor: t.surface,
            color: t.text,
            fontSize: 16,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 12,
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kirim"
          disabled={!canSend}
          onPress={() => send(input)}
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: t.primary,
            opacity: canSend ? 1 : 0.4,
          }}>
          <Ionicons name="arrow-up" size={22} color={t.onPrimary} />
        </Pressable>
      </View>
    </Screen>
  );
}