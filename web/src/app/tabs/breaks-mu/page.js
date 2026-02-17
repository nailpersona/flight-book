'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IoChevronBack } from 'react-icons/io5';
import { useAuth } from '../../../lib/auth';
import { getBreaksDataFromSupabase } from '../../../lib/supabaseData';
import s from '../../../components/shared.module.css';

const MU_TYPES = ['ДПМУ', 'ДСМУ', 'ДВМП', 'НПМУ', 'НСМУ', 'НВМП'];

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

export default function BreaksMUPage() {
  const { auth } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [muData, setMuData] = useState(null);

  useEffect(() => {
    if (!auth?.pib) return;
    (async () => {
      setLoading(true);
      const res = await getBreaksDataFromSupabase(auth.pib);
      if (res.ok) setMuData(res.data.mu);
      setLoading(false);
    })();
  }, [auth?.pib]);

  return (
    <div className={s.page}>
      <div className={s.topBar}>
        <button className={s.topBarBack} onClick={() => router.push('/tabs/profile')}>
          <IoChevronBack size={20} />
        </button>
        <span className={s.topBarTitle}>Перерви за МУ</span>
      </div>

      {loading && (
        <div className={s.loadingWrap}>
          <div className={s.spinner} style={{ borderTopColor: '#111827', width: 24, height: 24 }} />
        </div>
      )}

      {!loading && muData && (
        <>
          {/* Column headers */}
          <div className={s.breaksColumnHeaders}>
            <span className={s.breaksColHeaderLeft}>Тип ЛА</span>
            <span className={s.breaksColHeaderCenter}>Останній політ</span>
            <span className={s.breaksColHeaderRight}>Дійсний до</span>
          </div>

          {MU_TYPES.map((mu) => {
            const items = muData[mu] || [];
            if (items.length === 0) return null;
            return (
              <div key={mu} className={s.breaksSection}>
                {/* Section header */}
                <div className={s.breaksSectionHeader}>
                  <span className={s.breaksSectionTitle}>{mu}</span>
                </div>

                {/* Items */}
                {items.map((item, i) => {
                  const isLast = i === items.length - 1;
                  return (
                    <div key={i} className={`${s.breaksRow} ${isLast ? s.breaksRowLast : ''}`}>
                      {/* Status dot + aircraft */}
                      <div className={s.breaksRowLeft}>
                        <div className={s.statusDot} style={{ backgroundColor: getStatus(item.color).dot }} />
                        <span className={s.breaksAircraftText}>{item.aircraft || '—'}</span>
                      </div>

                      {/* Dates */}
                      <div className={s.breaksRowRight}>
                        <DateBox date={item.date} color={item.color} />
                        <DateBox date={item.expiryDate} color={item.color} />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {MU_TYPES.every((mu) => !(muData[mu]?.length)) && (
            <div className={s.breaksEmptyText}>Немає даних</div>
          )}
        </>
      )}

      {!loading && !muData && (
        <div className={s.loadingWrap}>
          <div className={s.breaksEmptyText}>Немає даних</div>
        </div>
      )}
    </div>
  );
}
