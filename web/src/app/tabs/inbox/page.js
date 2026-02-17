'use client';
import { useEffect, useState } from 'react';
import { IoNotificationsOutline, IoRefreshOutline } from 'react-icons/io5';
import { useAuth } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import s from '../../../components/shared.module.css';

function formatDate(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

export default function InboxPage() {
  const { auth } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchNotifications = async () => {
    if (!auth?.userId) return;
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!auth?.userId) return;
    fetchNotifications();

    // Підписка на realtime повідомлення
    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${auth.userId}`
        },
        (payload) => {
          setItems(prev => [payload.new, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${auth.userId}`
        },
        (payload) => {
          setItems(prev => prev.map(n => n.id === payload.new.id ? payload.new : n));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [auth?.userId]);

  const markRead = async (id) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setItems(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = async () => {
    await supabase.from('notifications').update({ read: true }).eq('user_id', auth.userId).eq('read', false);
    setItems(prev => prev.map(n => ({ ...n, read: true })));
  };

  const unreadCount = items.filter(n => !n.read).length;

  return (
    <div className={s.page}>
      {/* Заголовок з діями */}
      {items.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          {unreadCount > 0 && (
            <span style={{ fontSize: 13, color: '#6B7280' }}>
              {unreadCount} непрочитаних
            </span>
          )}
          <div style={{ flex: 1 }} />
          <button
            onClick={fetchNotifications}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              color: '#6B7280'
            }}
            title="Оновити"
          >
            <IoRefreshOutline size={18} />
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              style={{
                background: '#F3F4F6',
                border: 'none',
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 12,
                cursor: 'pointer',
                color: '#6B7280'
              }}
            >
              Прочитати все
            </button>
          )}
        </div>
      )}

      {loading && <div className={s.loadingWrap}><div className={s.spinner} style={{borderTopColor:'#111827',width:24,height:24}}/></div>}

      {error && (
        <div style={{ padding: 16, background: '#FEF2F2', borderRadius: 12, color: '#DC2626', fontSize: 14 }}>
          Помилка: {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className={s.loadingWrap}>
          <IoNotificationsOutline size={40} color="#9CA3AF" />
          <div className={s.emptyText}>Немає повідомлень</div>
        </div>
      )}

      {items.map(n => (
        <div
          key={n.id}
          className={`${s.inboxCard} ${!n.read ? s.inboxCardUnread : ''}`}
          onClick={() => !n.read && markRead(n.id)}
          style={{ cursor: !n.read ? 'pointer' : 'default' }}
        >
          <div className={s.inboxTitle}>{n.title || 'Повідомлення'}</div>
          <div className={s.inboxBody}>{n.body || ''}</div>
          <div className={s.inboxDate}>{formatDate(n.created_at)}</div>
        </div>
      ))}
    </div>
  );
}
