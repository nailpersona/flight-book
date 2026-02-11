'use client';
import { useEffect, useState } from 'react';
import { IoNotificationsOutline } from 'react-icons/io5';
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

  useEffect(() => {
    if (!auth?.userId) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', auth.userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!error) setItems(data || []);
      setLoading(false);
    })();
  }, [auth?.userId]);

  const markRead = async (id) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setItems(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  return (
    <div className={s.page}>
      {loading && <div className={s.loadingWrap}><div className={s.spinner} style={{borderTopColor:'#111827',width:24,height:24}}/></div>}

      {!loading && items.length === 0 && (
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
