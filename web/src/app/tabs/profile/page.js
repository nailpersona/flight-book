'use client';
import { useRouter } from 'next/navigation';
import { IoListOutline, IoBarChartOutline, IoTimerOutline, IoAirplaneOutline, IoDocumentTextOutline, IoCalendarOutline, IoSettingsOutline, IoGridOutline, IoLogOutOutline, IoSettings as IoAdminOutline } from 'react-icons/io5';
import { useAuth } from '../../../lib/auth';
import s from '../../../components/shared.module.css';

const BUTTONS = [
  { icon: IoListOutline, title: 'Мої записи', path: '/tabs/my-records' },
  { icon: IoBarChartOutline, title: 'Підсумки', path: '/tabs/flight-summary' },
  { icon: IoGridOutline, title: 'Зведена таблиця', path: '/tabs/readiness' },
  { icon: IoTimerOutline, title: 'Перерви за МУ', path: '/tabs/breaks-mu' },
  { icon: IoAirplaneOutline, title: 'Перерви за видами ЛП', path: '/tabs/breaks-lp' },
  { icon: IoDocumentTextOutline, title: 'Таблиця комісування', path: '/tabs/commission' },
  { icon: IoCalendarOutline, title: 'Рiчнi перевiрки', path: '/tabs/annual-checks' },
  { icon: IoSettingsOutline, title: 'Налаштування', path: '/tabs/settings' },
];

export default function ProfilePage() {
  const { auth, setAuth } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    if (window.confirm('Ви впевнені що хочете вийти?')) {
      setAuth(null);
      router.replace('/login');
    }
  };

  return (
    <div className={s.page} style={{ paddingTop: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        {BUTTONS.map((b) => {
          const Icon = b.icon;
          return (
            <button key={b.path} className={s.menuBtn} style={{ width: '80%', justifyContent: 'center', background: '#D9DBDE', borderColor: '#B0B3B8', color: '#555860' }} onClick={() => router.push(b.path)}>
              <span className={s.menuBtnIcon} style={{ color: '#555860' }}><Icon size={18} /></span>
              {b.title}
            </button>
          );
        })}
        {auth?.role === 'admin' && (
          <button className={s.menuBtn} style={{ width: '80%', justifyContent: 'center', background: '#D9DBDE', borderColor: '#3B82F6', color: '#555860' }} onClick={() => router.push('/tabs/admin-settings')}>
            <span className={s.menuBtnIcon} style={{ color: '#555860' }}><IoAdminOutline size={18} /></span>
            Адмін панель
          </button>
        )}
        <button className={s.menuBtn} style={{ width: '80%', justifyContent: 'center', background: '#D9DBDE', borderColor: '#E8B4B4', color: '#555860' }} onClick={handleLogout}>
          <span className={s.menuBtnIcon} style={{ color: '#555860' }}><IoLogOutOutline size={18} /></span>
          Вийти
        </button>
      </div>
    </div>
  );
}
