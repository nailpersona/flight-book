'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IoChevronBack } from 'react-icons/io5';
import { useAuth } from '../../../lib/auth';
import { getAnnualChecksFromSupabase } from '../../../lib/supabaseData';
import s from '../../../components/shared.module.css';

const COLOR_MAP = { green: '#10B981', yellow: '#F59E0B', red: '#EF4444', gray: '#9CA3AF' };

const CHECK_LABELS = {
  'ТП': 'Техніка пілотування',
  'Захід за приладами': 'Захід за приладами',
  'ТП_дублюючі': 'ТП за дублюючими',
  'ТП з ІВД': 'ТП з ІВД',
  'навігація': 'Навігація',
  'БЗ': 'Бойове застосування',
  'інструкторська': 'Інструкторська перевірка',
};

const CHECK_ORDER = ['ТП', 'Захід за приладами', 'ТП_дублюючі', 'ТП з ІВД', 'навігація', 'БЗ', 'інструкторська'];

export default function AnnualChecksPage() {
  const { auth } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [checks, setChecks] = useState([]);

  useEffect(() => {
    if (!auth?.pib) return;
    (async () => {
      setLoading(true);
      const res = await getAnnualChecksFromSupabase(auth.pib);
      if (res.ok) setChecks(res.checks || []);
      setLoading(false);
    })();
  }, [auth?.pib]);

  const dataMap = {};
  checks.forEach(c => { dataMap[c.check_type] = c; });

  return (
    <div className={s.page}>
      <div className={s.topBar}>
        <button className={s.topBarBack} onClick={() => router.push('/tabs/profile')}><IoChevronBack size={20} /></button>
        <span className={s.topBarTitle}>Рiчнi перевiрки</span>
      </div>

      {loading && <div className={s.loadingWrap}><div className={s.spinner} style={{borderTopColor:'#111827',width:24,height:24}}/></div>}

      {!loading && checks.length > 0 && (
        <div className={s.card}>
          <table className={s.table}>
            <thead><tr><th>Перевірка</th><th>Дата</th><th></th></tr></thead>
            <tbody>
              {CHECK_ORDER.map(checkType => {
                const c = dataMap[checkType];
                const label = CHECK_LABELS[checkType] || checkType;
                return (
                  <tr key={checkType}>
                    <td>{label}</td>
                    <td>{c?.date || '—'}</td>
                    <td><span className={s.statusDot} style={{background: COLOR_MAP[c?.color] || COLOR_MAP.gray}} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && checks.length === 0 && (
        <div className={s.loadingWrap}><div className={s.emptyText}>Немає даних</div></div>
      )}
    </div>
  );
}
