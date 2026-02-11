'use client';
import { useState } from 'react';
import { IoChevronDown } from 'react-icons/io5';
import Modal from './Modal';
import styles from './shared.module.css';

export default function Combo({ label, value, onChange, options = [], placeholder = '' }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.mb}>
      {!!label && <div className={styles.label}>{label}</div>}
      <div className={styles.select} onClick={() => setOpen(true)}>
        <span className={`${styles.selectText} ${!value ? styles.selectPlaceholder : ''}`}>
          {value || placeholder || label}
        </span>
        <span className={styles.selectArrow}><IoChevronDown size={16} /></span>
      </div>
      <Modal visible={open} onClose={() => setOpen(false)} title={label}>
        <div className={styles.optionsList}>
          {options.map((item, idx) => (
            <div
              key={item + '_' + idx}
              className={styles.optionRow}
              onClick={() => { onChange(item); setOpen(false); }}
            >
              <span className={styles.optionText}>{item}</span>
            </div>
          ))}
        </div>
        <button
          className={`${styles.btn} ${styles.btnSecondary}`}
          style={{ marginTop: 8, width: '100%' }}
          onClick={() => setOpen(false)}
        >
          Закрити
        </button>
      </Modal>
    </div>
  );
}
