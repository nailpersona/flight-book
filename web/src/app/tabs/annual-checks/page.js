'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IoChevronBack } from 'react-icons/io5';
import { useAuth } from '../../../lib/auth';
import { getAnnualChecksFromSupabase } from '../../../lib/supabaseData';
import s from '../../../components/shared.module.css';

// Soft status colors — matching mobile
const STATUS = {
  green: { bg: '#E8F5E9', text: '#2E7D32', dot: '#4CAF50' },
  yellow: { bg: '#FFF8E1', text: '#F57F17', dot: '#FFC107' },
  red: { bg: '#FFEBEE', text: '#C62828', dot: '#EF5350' },
  gray: { bg: '#F3F4F6', text: '#6B7280', dot: '#D1D5DB' },
};

const getStatus = (color) => STATUS[color] || STATUS.gray;

function DateBox({ date, color }) {
  const st = getStatus(color);
  return (
    <div className={s.dateBox} style={{ backgroundColor: st.bg }}>
      <span style={{ color: st.text }}>{date || '—'}</span>
    </div>
  );
}

// Display labels for check types
const CHECK_LABELS = {
  'ТП': 'Техніка пілотування',
  'Захід за приладами': 'Захід за приладами',
  'ТП_дублюючі': 'ТП за дублюючими',
  'ТП з ІВД': 'ТП з ІВД',
  'навігація': 'Навігація',
  'БЗ': 'Бойове застосування',
  'інструкторська': 'Інструкторська перевірка',
};

// Order of check types
const CHECK_ORDER = [
  'ТП',
  'Захід за приладами',
  'ТП_дублюючі',
  'ТП з ІВД',
  'навігація',
  'БЗ',
  'інструкторська',
];

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

  // Build a map from check_type to data for quick lookup
  const dataMap = {};
  checks.forEach((item) => { dataMap[item.check_type] = item; });

  return (
    <div className={s.page}>
      <div className={s.topBar}>
        <button className={s.topBarBack} onClick={() => router.push('/tabs/profile')}>
          <IoChevronBack size={20} />
        </button>
        <span className={s.topBarTitle}>Річні перевірки</span>
      </div>

      {loading && (
        <div className={s.loadingWrap}>
          <div className={s.spinner} style={{ borderTopColor: '#111827', width: 24, height: 24 }} />
        </div>
      )}

      {!loading && checks.length > 0 && (
        <>
          {/* Column headers */}
          <div className={s.breaksColumnHeaders}>
            <span className={s.breaksColHeaderLeft}>Перевірка</span>
            <span className={s.breaksColHeaderRight}>Дата</span>
          </div>

          <div className={s.breaksSection}>
            {CHECK_ORDER.map((checkType, idx) => {
              const item = dataMap[checkType];
              const st = getStatus(item?.color || 'gray');
              const label = CHECK_LABELS[checkType] || checkType;
              const isLast = idx === CHECK_ORDER.length - 1;

              return (
                <div key={checkType} className={`${s.breaksRow} ${isLast ? s.breaksRowLast : ''}`}>
                  {/* Check name with status dot */}
                  <div className={s.breaksRowLeft}>
                    <div className={s.statusDot} style={{ backgroundColor: st.dot }} />
                    <span className={s.breaksCheckName}>{label}</span>
                  </div>

                  {/* Date */}
                  <div className={s.breaksRowRight}>
                    <DateBox date={item?.date} color={item?.color || 'gray'} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {!loading && checks.length === 0 && (
        <div className={s.loadingWrap}>
          <div className={s.breaksEmptyText}>Немає даних</div>
        </div>
      )}
    </div>
  );
}
