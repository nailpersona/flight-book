'use client';
import { useRef, useState } from 'react';
import { IoSendOutline } from 'react-icons/io5';
import { useAuth } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import s from '../../../components/shared.module.css';

export default function ChatPage() {
  const { auth } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const scrollBottom = () => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);
    scrollBottom();

    try {
      const { data, error } = await supabase.functions.invoke('ask', {
        body: { question: text, pib: auth?.pib || '' },
      });
      if (error) throw error;
      const answer = data?.answer || 'Немає відповіді';
      setMessages(prev => [...prev, { role: 'bot', content: answer }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', content: `Помилка: ${err.message || err}` }]);
    } finally {
      setSending(false);
      scrollBottom();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className={s.chatWrap}>
      <div className={s.chatMessages}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#9CA3AF', paddingTop: 40 }}>
            Задайте питання про льотну підготовку
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`${s.chatBubble} ${m.role === 'user' ? s.chatUser : s.chatBot}`}>
            {m.content}
          </div>
        ))}
        {sending && (
          <div className={`${s.chatBubble} ${s.chatBot}`}>
            <div className={s.spinner} style={{ borderTopColor: '#111827', width: 16, height: 16 }} />
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className={s.chatInputRow}>
        <textarea
          className={s.chatInput}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Напишіть повідомлення..."
          rows={1}
        />
        <button className={s.chatSendBtn} onClick={send} disabled={sending || !input.trim()}>
          <IoSendOutline size={18} />
        </button>
      </div>
    </div>
  );
}
