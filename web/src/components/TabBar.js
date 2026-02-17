'use client';
import { usePathname, useRouter } from 'next/navigation';
import { IoDocumentTextOutline, IoDocumentText, IoNotificationsOutline, IoNotifications, IoBookOutline, IoBook, IoPersonOutline, IoPerson } from 'react-icons/io5';
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
          return (
            <button
              key={tab.key}
              className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
              onClick={() => router.push(tab.path)}
            >
              <span className={styles.tabIcon}><Icon size={18} /></span>
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
