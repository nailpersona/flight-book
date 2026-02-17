'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IoChevronBack } from 'react-icons/io5';
import { useAuth } from '../../../lib/auth';
import { getBreaksDataFromSupabase } from '../../../lib/supabaseData';
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

export default function BreaksLPPage() {
  const { auth } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [lpSections, setLpSections] = useState([]);

  useEffect(() => {
    if (!auth?.pib) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const res = await getBreaksDataFromSupabase(auth.pib);
        if (res.ok && res.data) {
          setLpSections(res.data.lpSections || []);
        }
      } catch (e) {
        console.error('BreaksLP exception:', e);
      }
      setLoading(false);
    })();
  }, [auth?.pib]);

  return (
    <div className={s.page}>
      <div className={s.topBar}>
        <button className={s.topBarBack} onClick={() => router.push('/tabs/profile')}>
          <IoChevronBack size={20} />
        </button>
        <span className={s.topBarTitle}>Перерви за видами ЛП</span>
      </div>

      {loading && (
        <div className={s.loadingWrap}>
          <div className={s.spinner} style={{ borderTopColor: '#111827', width: 24, height: 24 }} />
        </div>
      )}

      {!loading && !auth?.pib && (
        <div className={s.breaksSection}>
          <div className={s.breaksEmptyText}>Помилка: ПІБ користувача не знайдено. Увійдіть заново.</div>
        </div>
      )}

      {!loading && (
        <>
          {/* Column headers */}
          <div className={s.breaksColumnHeaders}>
            <span className={s.breaksColHeaderLeft}>Тип ПС</span>
            <span className={s.breaksColHeaderCenter}>Крайній політ</span>
            <span className={s.breaksColHeaderRight}>Дійсний до</span>
          </div>

          {lpSections.length > 0 ? lpSections.map((section, idx) => {
            // КЛПВ header separator
            if (section.type === 'klpv_header') {
              return (
                <div key={`s-${idx}`} className={s.klpvSeparator}>
                  <div className={s.klpvSeparatorLine} />
                  <span className={s.klpvSeparatorText}>Згідно КЛПВ</span>
                  <div className={s.klpvSeparatorLine} />
                </div>
              );
            }

            const items = section.items || [];

            return (
              <div key={`s-${idx}`} className={s.breaksSection}>
                {/* Section header */}
                <div className={s.breaksSectionHeader}>
                  <span className={s.breaksSectionTitle}>{section.name}</span>
                </div>

                {/* Items */}
                {items.length > 0 ? items.map((item, i) => {
                  const st = getStatus(item.color);
                  const isLast = i === items.length - 1;
                  const hasKlpv = !!item.klpvExpiryDate;

                  return (
                    <div key={i}>
                      <div className={`${s.breaksRow} ${isLast && !hasKlpv ? s.breaksRowLast : ''}`}>
                        {/* Status dot + aircraft */}
                        <div className={s.breaksRowLeft}>
                          <div className={s.statusDot} style={{ backgroundColor: st.dot }} />
                          <span className={s.breaksAircraftText}>{item.aircraft || '—'}</span>
                        </div>

                        {/* Dates */}
                        <div className={s.breaksRowRight}>
                          <DateBox date={item.date} color={item.color} />
                          <DateBox date={item.expiryDate} color={item.color} />
                        </div>
                      </div>

                      {/* КЛПВ sub-row */}
                      {hasKlpv && (() => {
                        const ks = getStatus(item.klpvColor);
                        return (
                          <div className={`${s.klpvSubRow} ${isLast ? s.breaksRowLast : ''}`}>
                            <div className={s.breaksRowLeft} />
                            <div className={s.breaksRowRight}>
                              <div className={s.klpvLabelBox}>
                                <span className={s.klpvLabel}>КЛПВ</span>
                              </div>
                              <DateBox date={item.klpvExpiryDate} color={item.klpvColor} />
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                }) : (
                  <div className={s.breaksEmptyText}>Немає даних</div>
                )}
              </div>
            );
          }) : (
            <div className={s.breaksSection}>
              <div className={s.breaksEmptyText}>Немає даних про перерви за видами ЛП</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
