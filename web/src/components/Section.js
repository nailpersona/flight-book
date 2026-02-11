'use client';
import styles from './shared.module.css';

export default function Section({ icon: Icon, title, children }) {
  return (
    <div className={styles.card}>
      <div className={styles.sectionHeader}>
        {Icon && <span className={styles.sectionIcon}><Icon size={16} /></span>}
        <span className={styles.sectionTitle}>{title}</span>
      </div>
      {children}
    </div>
  );
}
