'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { IoDocumentTextOutline, IoDocumentText, IoNotificationsOutline, IoNotifications, IoBookOutline, IoBook, IoPersonOutline, IoPerson } from 'react-icons/io5';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import styles from './TabBar.module.css';

const TABS = [
  { key: 'records', label: 'Записи', path: '/tabs/main', icon: IoDocumentTextOutline, iconActive: IoDocumentText },
  { key: 'inbox', label: 'Вхідні', path: '/tabs/inbox', icon: IoNotificationsOutline, iconActive: IoNotifications },
  { key: 'guide', label: 'Посібник', path: '/tabs/guide', icon: IoBookOutline, iconActive: IoBook },
  { key: 'profile', label: 'Профіль', path: '/tabs/profile', icon: IoPersonOutline, iconActive: IoPerson },
];

export default function TabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { auth } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!auth?.userId) return;

    // Отримати кількість непрочитаних
    const fetchUnread = async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', auth.userId)
        .eq('read', false);
      if (!error) setUnreadCount(count || 0);
    };

    fetchUnread();

    // Підписка на зміни
    const channel = supabase
      .channel('tabbar-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${auth.userId}`
        },
        () => fetchUnread()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [auth?.userId]);

  const getActive = () => {
    if (pathname.startsWith('/tabs/main')) return 'records';
    if (pathname.startsWith('/tabs/inbox')) return 'inbox';
    if (pathname.startsWith('/tabs/guide')) return 'guide';
    if (pathname.startsWith('/tabs/profile') || pathname.startsWith('/tabs/my-records') ||
        pathname.startsWith('/tabs/flight-summary') || pathname.startsWith('/tabs/breaks-') ||
        pathname.startsWith('/tabs/commission') || pathname.startsWith('/tabs/annual-checks') ||
        pathname.startsWith('/tabs/settings') || pathname.startsWith('/tabs/admin')) return 'profile';
    return 'records';
  };

  const active = getActive();

  return (
    <div className={styles.header}>
      <div className={styles.tabRow}>
        {TABS.map((tab) => {
          const isActive = active === tab.key;
          const Icon = isActive ? tab.iconActive : tab.icon;
          const showBadge = tab.key === 'inbox' && unreadCount > 0;
          return (
            <button
              key={tab.key}
              className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
              onClick={() => router.push(tab.path)}
            >
              <span className={styles.tabIcon} style={{ position: 'relative' }}>
                <Icon size={18} />
                {showBadge && (
                  <span style={{
                    position: 'absolute',
                    top: -4,
                    right: -6,
                    background: '#EF4444',
                    color: '#FFF',
                    fontSize: 10,
                    fontWeight: 400,
                    minWidth: 16,
                    height: 16,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px'
                  }}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </span>
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
