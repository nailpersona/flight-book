'use client';
import { useState } from 'react';
import Modal from './Modal';
import styles from './shared.module.css';

const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const MONTH_NAMES = [
  'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень',
];

export default function CustomCalendar({ visible, value, onSelect, onClose }) {
  const [viewDate, setViewDate] = useState(() => value || new Date());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay = new Date(year, month, 1);
  let startDay = firstDay.getDay() - 1;
  if (startDay < 0) startDay = 6;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const days = [];
  for (let i = startDay - 1; i >= 0; i--) {
    days.push({ day: prevMonthDays - i, current: false });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ day: i, current: true });
  }
  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, current: false });
    }
  }

  const today = new Date();
  const isToday = (d) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  const isSelected = (d) => value && d === value.getDate() && month === value.getMonth() && year === value.getFullYear();

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  return (
    <Modal visible={visible} onClose={onClose}>
      <div className={styles.calHeader}>
        <button className={styles.calNavBtn} onClick={prevMonth}>&lt;</button>
        <span className={styles.calHeaderTitle}>{MONTH_NAMES[month]} {year}</span>
        <button className={styles.calNavBtn} onClick={nextMonth}>&gt;</button>
      </div>
      <div className={styles.calGrid}>
        {DAY_NAMES.map(d => <div key={d} className={styles.calDayName}>{d}</div>)}
        {days.map((d, i) => (
          <button
            key={i}
            className={[
              styles.calDay,
              !d.current && styles.calDayOther,
              d.current && isSelected(d.day) && styles.calDaySelected,
              d.current && isToday(d.day) && !isSelected(d.day) && styles.calDayToday,
            ].filter(Boolean).join(' ')}
            onClick={() => {
              if (d.current) {
                onSelect(new Date(year, month, d.day));
              }
            }}
          >
            {d.day}
          </button>
        ))}
      </div>
    </Modal>
  );
}
