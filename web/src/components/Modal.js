'use client';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './Modal.module.css';

export default function Modal({ visible, onClose, title, children }) {
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [visible]);

  if (!visible) return null;

  return createPortal(
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        {title && <div className={styles.title}>{title}</div>}
        {children}
      </div>
    </div>,
    document.body
  );
}
