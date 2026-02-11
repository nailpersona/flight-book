'use client';
import { useState, useMemo } from 'react';
import { IoChevronDown } from 'react-icons/io5';
import Modal from './Modal';
import styles from './shared.module.css';

export default function ExercisePicker({ exercises, selectedExercises, onAdd, onRemove }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const getExerciseKey = (ex, flightNum = null) => {
    return flightNum ? `${ex.id}_${flightNum}` : String(ex.id);
  };

  const exerciseVariants = useMemo(() => {
    const variants = [];
    exercises.forEach(ex => {
      const flightCount = ex.flights_count && ex.flights_count !== 'РК' ? parseInt(ex.flights_count) : 0;
      if (flightCount > 1) {
        for (let i = 1; i <= flightCount; i++) {
          variants.push({ ...ex, flight_number: i, displayNumber: `${ex.number}(${i})` });
        }
      } else {
        variants.push({ ...ex, flight_number: null, displayNumber: ex.number });
      }
    });
    return variants;
  }, [exercises]);

  const filtered = useMemo(() => {
    if (!search.trim()) return exerciseVariants.slice(0, 30);
    const q = search.toLowerCase();
    return exerciseVariants.filter(e =>
      e.number.toLowerCase().includes(q) || e.displayNumber.toLowerCase().includes(q) || e.name.toLowerCase().includes(q)
    ).slice(0, 30);
  }, [exerciseVariants, search]);

  const selectedKeys = new Set(selectedExercises.map(ex => getExerciseKey(ex, ex.flight_number)));

  return (
    <div className={styles.mb}>
      <div className={styles.label}>Вправа</div>

      {selectedExercises.length > 0 ? (
        <div className={styles.select} onClick={() => setOpen(true)} style={{ height: 'auto', minHeight: 44, padding: '6px 12px' }}>
          <div className={styles.chipWrap}>
            {selectedExercises.map(ex => {
              const key = getExerciseKey(ex, ex.flight_number);
              const displayLabel = ex.flight_number ? `${ex.number}(${ex.flight_number})` : ex.number;
              return (
                <span key={key} className={styles.chip}>
                  <span className={styles.chipText}>{displayLabel}</span>
                  <button className={styles.chipRemove} onClick={(e) => { e.stopPropagation(); onRemove(ex.id, ex.flight_number); }}>
                    ✕
                  </button>
                </span>
              );
            })}
          </div>
          <span className={styles.selectArrow}><IoChevronDown size={16} /></span>
        </div>
      ) : (
        <div className={styles.select} onClick={() => setOpen(true)}>
          <span className={`${styles.selectText} ${styles.selectPlaceholder}`}> </span>
          <span className={styles.selectArrow}><IoChevronDown size={16} /></span>
        </div>
      )}

      <Modal visible={open} onClose={() => { setOpen(false); setSearch(''); }} title="Вправа">
        <input
          className={`${styles.input} ${styles.searchInput}`}
          placeholder="Пошук: номер або назва..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <div className={styles.optionsList}>
          {filtered.map((item) => {
            const key = getExerciseKey(item, item.flight_number);
            const isSelected = selectedKeys.has(key);
            const displayLabel = item.flight_number ? `${item.number}(${item.flight_number}) ${item.name}` : `${item.number} ${item.name}`;
            return (
              <div
                key={key}
                className={`${styles.optionRow} ${isSelected ? styles.optionRowSelected : ''}`}
                onClick={() => { if (!isSelected) onAdd(item); }}
              >
                <span className={`${styles.optionText} ${isSelected ? styles.optionTextSelected : ''}`}>
                  {displayLabel}
                </span>
                {isSelected && <span className={styles.selectedMark}>✓</span>}
              </div>
            );
          })}
          {filtered.length === 0 && <div className={styles.emptyText}>Нічого не знайдено</div>}
        </div>
        <button
          className={`${styles.btn} ${styles.btnSecondary}`}
          style={{ marginTop: 8, width: '100%' }}
          onClick={() => { setOpen(false); setSearch(''); }}
        >
          Готово
        </button>
      </Modal>
    </div>
  );
}
