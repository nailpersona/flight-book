'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { IoChevronBack, IoAddOutline, IoChevronDown, IoChevronForward, IoPersonOutline, IoRemoveCircleOutline, IoCreateOutline, IoArrowForward, IoPersonAddOutline } from 'react-icons/io5';
import { useAuth } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import Modal from '../../../components/Modal';
import s from '../../../components/shared.module.css';

// Типи підрозділів з назвами
const UNIT_TYPES = {
  brigade: 'Бригада',
  squadron: 'Ескадрилья',
  linka: 'Ланка'
};

// Порядок рівнів для відображення
const UNIT_LEVELS = ['brigade', 'squadron', 'linka'];

export default function AdminUnitsPage() {
  const { auth } = useAuth();
  const router = useRouter();
  const [units, setUnits] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Стан модальних вікон
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [showEditUnit, setShowEditUnit] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showMoveUser, setShowMoveUser] = useState(false);
  const [showAddUserToUnit, setShowAddUserToUnit] = useState(false);

  // Форма додавання користувача до підрозділу
  const [addUserTargetUnit, setAddUserTargetUnit] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);

  // Форма додавання підрозділу
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitType, setNewUnitType] = useState('linka');
  const [newUnitParent, setNewUnitParent] = useState(null);

  // Форма редагування підрозділу
  const [editUnit, setEditUnit] = useState(null);
  const [editUnitName, setEditUnitName] = useState('');
  const [editUnitCommander, setEditUnitCommander] = useState(null);

  // Форма переміщення користувача
  const [moveUser, setMoveUser] = useState(null);
  const [moveTargetUnit, setMoveTargetUnit] = useState(null);

  // Розгорнуті підрозділи
  const [expandedUnits, setExpandedUnits] = useState(new Set());

  if (auth?.role !== 'admin') {
    return <div className={s.page}><div className={s.emptyText}>Доступ заборонено</div></div>;
  }

  const loadData = async () => {
    setLoading(true);
    const [unitsRes, usersRes] = await Promise.all([
      supabase.from('units').select('*').order('order_num, name'),
      supabase.from('users').select('id, name, email, rank, position, unit_id').order('name')
    ]);
    setUnits(unitsRes.data || []);
    setUsers(usersRes.data || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // Побудова дерева підрозділів
  const buildUnitTree = useCallback((parentId = null, level = 0) => {
    return units
      .filter(u => u.parent_id === parentId)
      .sort((a, b) => {
        const aLevel = UNIT_LEVELS.indexOf(a.type);
        const bLevel = UNIT_LEVELS.indexOf(b.type);
        if (aLevel !== bLevel) return aLevel - bLevel;
        return (a.order_num || 0) - (b.order_num || 0);
      })
      .map(unit => ({
        ...unit,
        level,
        children: buildUnitTree(unit.id, level + 1),
        users: users.filter(u => u.unit_id === unit.id)
      }));
  }, [units, users]);

  const unitTree = buildUnitTree();

  // Підрахунок користувачів у підрозділі (включаючи дочірні)
  const countUsersInUnit = useCallback((unit) => {
    let count = unit.users.length;
    unit.children.forEach(child => {
      count += countUsersInUnit(child);
    });
    return count;
  }, []);

  // Перемикання розгортання підрозділу
  const toggleExpand = (unitId) => {
    const newExpanded = new Set(expandedUnits);
    if (newExpanded.has(unitId)) {
      newExpanded.delete(unitId);
    } else {
      newExpanded.add(unitId);
    }
    setExpandedUnits(newExpanded);
  };

  // Додавання підрозділу
  const addUnit = async () => {
    if (!newUnitName.trim()) {
      window.alert('Введіть назву підрозділу');
      return;
    }
    const { error } = await supabase.from('units').insert({
      name: newUnitName.trim(),
      type: newUnitType,
      parent_id: newUnitParent
    });
    if (error) {
      window.alert(error.message);
    } else {
      setShowAddUnit(false);
      setNewUnitName('');
      setNewUnitType('linka');
      setNewUnitParent(null);
      loadData();
    }
  };

  // Редагування підрозділу
  const saveUnit = async () => {
    if (!editUnitName.trim()) {
      window.alert('Введіть назву підрозділу');
      return;
    }
    const { error } = await supabase.from('units').update({
      name: editUnitName.trim(),
      commander_id: editUnitCommander
    }).eq('id', editUnit.id);
    if (error) {
      window.alert(error.message);
    } else {
      setShowEditUnit(false);
      setEditUnit(null);
      loadData();
    }
  };

  // Видалення підрозділу
  const deleteUnit = async (unitId) => {
    if (!window.confirm('Видалити підрозділ? Всі користувачі будуть переміщені на вищий рівень.')) return;

    const unit = units.find(u => u.id === unitId);
    if (!unit) return;

    // Переміщуємо користувачів на вищий рівень
    const usersInUnit = users.filter(u => u.unit_id === unitId);
    for (const user of usersInUnit) {
      await supabase.from('users').update({ unit_id: unit.parent_id }).eq('id', user.id);
    }

    // Видаляємо підрозділ
    const { error } = await supabase.from('units').delete().eq('id', unitId);
    if (error) {
      window.alert(error.message);
    } else {
      loadData();
    }
  };

  // Переміщення користувача в інший підрозділ
  const moveUserToUnit = async () => {
    if (!moveTargetUnit) {
      window.alert('Оберіть підрозділ');
      return;
    }
    const { error } = await supabase.from('users').update({ unit_id: moveTargetUnit }).eq('id', moveUser.id);
    if (error) {
      window.alert(error.message);
    } else {
      setShowMoveUser(false);
      setMoveUser(null);
      setMoveTargetUnit(null);
      loadData();
    }
  };

  // Рекурсивне переміщення користувача
  const moveUserUp = async (user) => {
    const currentUnit = units.find(u => u.id === user.unit_id);
    if (!currentUnit || !currentUnit.parent_id) return;

    const { error } = await supabase.from('users').update({ unit_id: currentUnit.parent_id }).eq('id', user.id);
    if (!error) loadData();
  };

  // Додавання користувача до підрозділу
  const addUserToUnit = async () => {
    if (!selectedUserId) {
      window.alert('Оберіть користувача');
      return;
    }
    const { error } = await supabase.from('users').update({ unit_id: addUserTargetUnit }).eq('id', selectedUserId);
    if (error) {
      window.alert(error.message);
    } else {
      setShowAddUserToUnit(false);
      setAddUserTargetUnit(null);
      setSelectedUserId(null);
      loadData();
    }
  };

  // Рендер підрозділу
  const renderUnit = (unit) => {
    const isExpanded = expandedUnits.has(unit.id);
    const hasChildren = unit.children.length > 0 || unit.users.length > 0;
    const indent = unit.level * 24;

    return (
      <div key={unit.id} className={s.unitBlock}>
        <div
          className={s.unitHeader}
          style={{ paddingLeft: indent }}
          onClick={() => hasChildren && toggleExpand(unit.id)}
        >
          {hasChildren && (
            <span className={s.unitToggle}>
              {isExpanded ? <IoChevronDown size={16} /> : <IoChevronForward size={16} />}
            </span>
          )}
          {!hasChildren && <span className={s.unitToggle} />}
          <span className={s.unitType}>{UNIT_TYPES[unit.type]}</span>
          <span className={s.unitName}>{unit.name}</span>
          <span className={s.unitCount}>({countUsersInUnit(unit)})</span>
          <div className={s.unitActions} onClick={e => e.stopPropagation()}>
            <button className={s.unitBtn} onClick={() => {
              setAddUserTargetUnit(unit.id);
              setSelectedUserId(null);
              setShowAddUserToUnit(true);
            }}><IoPersonAddOutline size={20} /></button>
            <button className={s.unitBtn} onClick={() => {
              setEditUnit(unit);
              setEditUnitName(unit.name);
              setEditUnitCommander(unit.commander_id);
              setShowEditUnit(true);
            }}><IoCreateOutline size={20} /></button>
            <button className={s.unitBtn} onClick={() => deleteUnit(unit.id)}><IoRemoveCircleOutline size={20} /></button>
            <button className={s.unitBtn} onClick={() => {
              setNewUnitParent(unit.id);
              setNewUnitType(unit.type === 'brigade' ? 'squadron' : 'linka');
              setShowAddUnit(true);
            }}><IoAddOutline size={20} /></button>
          </div>
        </div>

        {isExpanded && (
          <div className={s.unitChildren}>
            {unit.children.map(child => renderUnit(child))}

            {unit.users.length > 0 && (
              <div className={s.unitUsers}>
                {unit.users.map(user => (
                  <div key={user.id} className={s.unitUser}>
                    <span className={s.unitUserIcon}><IoPersonOutline size={14} /></span>
                    <span className={s.unitUserName}>{user.name}</span>
                    <span className={s.unitUserInfo}>{user.rank || ''} {user.position || ''}</span>
                    <button className={s.unitUserBtn} onClick={() => {
                      setMoveUser(user);
                      setMoveTargetUnit(null);
                      setShowMoveUser(true);
                    }}><IoArrowForward size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Отримання всіх підрозділів для select (плоский список з відступами)
  const getUnitOptions = (unit = null, prefix = '') => {
    let result = [];
    const items = unit ? unit.children : unitTree;
    for (const item of items) {
      result.push({ id: item.id, name: prefix + item.name, type: item.type });
      result.push(...getUnitOptions(item, prefix + '  '));
    }
    return result;
  };

  return (
    <div className={s.page}>
      <div className={s.topBar}>
        <button className={s.topBarBack} onClick={() => router.push('/tabs/admin-settings')}><IoChevronBack size={20} /></button>
        <span className={s.topBarTitle}>Підрозділи</span>
        <button className={s.topBarBack} onClick={() => {
          setNewUnitParent(null);
          setNewUnitType('brigade');
          setShowAddUnit(true);
        }} style={{ marginLeft: 'auto' }}><IoAddOutline size={20} /></button>
      </div>

      {loading && <div className={s.loadingWrap}><div className={s.spinner} style={{borderTopColor:'#111827',width:24,height:24}}/></div>}

      {!loading && (
        <div className={s.card}>
          {unitTree.length === 0 ? (
            <div className={s.emptyText}>Немає підрозділів. Натисніть + щоб створити.</div>
          ) : (
            <div className={s.unitTree}>
              {unitTree.map(unit => renderUnit(unit))}
            </div>
          )}
        </div>
      )}

      {/* Модальне вікно додавання підрозділу */}
      <Modal visible={showAddUnit} onClose={() => setShowAddUnit(false)} title="Додати підрозділ">
        <div className={s.label}>Тип</div>
        <select className={s.select} value={newUnitType} onChange={e => setNewUnitType(e.target.value)} style={{ marginBottom: 12 }}>
          <option value="brigade">Бригада</option>
          <option value="squadron">Ескадрилья</option>
          <option value="linka">Ланка</option>
        </select>
        <div className={s.label}>Назва</div>
        <input className={s.input} value={newUnitName} onChange={e => setNewUnitName(e.target.value)} style={{ marginBottom: 16 }} />
        <div className={s.row}>
          <button className={`${s.btn} ${s.btnSecondary} ${s.col}`} onClick={() => setShowAddUnit(false)}>Скасувати</button>
          <button className={`${s.btn} ${s.btnPrimary} ${s.col}`} onClick={addUnit}>Додати</button>
        </div>
      </Modal>

      {/* Модальне вікно редагування підрозділу */}
      <Modal visible={showEditUnit} onClose={() => setShowEditUnit(false)} title="Редагувати підрозділ">
        <div className={s.label}>Назва</div>
        <input className={s.input} value={editUnitName} onChange={e => setEditUnitName(e.target.value)} style={{ marginBottom: 12 }} />
        <div className={s.label}>Командир</div>
        <select className={s.select} value={editUnitCommander || ''} onChange={e => setEditUnitCommander(e.target.value || null)} style={{ marginBottom: 16 }}>
          <option value="">Не обрано</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <div className={s.row}>
          <button className={`${s.btn} ${s.btnSecondary} ${s.col}`} onClick={() => setShowEditUnit(false)}>Скасувати</button>
          <button className={`${s.btn} ${s.btnPrimary} ${s.col}`} onClick={saveUnit}>Зберегти</button>
        </div>
      </Modal>

      {/* Модальне вікно переміщення користувача */}
      <Modal visible={showMoveUser} onClose={() => setShowMoveUser(false)} title={`Перемістити ${moveUser?.name}`}>
        <div className={s.label}>До підрозділу</div>
        <select className={s.select} value={moveTargetUnit || ''} onChange={e => setMoveTargetUnit(e.target.value || null)} style={{ marginBottom: 16 }}>
          <option value="">Без підрозділу</option>
          {getUnitOptions().map(u => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <div className={s.row}>
          <button className={`${s.btn} ${s.btnSecondary} ${s.col}`} onClick={() => setShowMoveUser(false)}>Скасувати</button>
          <button className={`${s.btn} ${s.btnPrimary} ${s.col}`} onClick={moveUserToUnit}>Перемістити</button>
        </div>
      </Modal>

      {/* Модальне вікно додавання користувача до підрозділу */}
      <Modal visible={showAddUserToUnit} onClose={() => setShowAddUserToUnit(false)} title="Додати користувача до підрозділу">
        <div className={s.label}>Користувач</div>
        <select className={s.select} value={selectedUserId || ''} onChange={e => setSelectedUserId(e.target.value || null)} style={{ marginBottom: 16 }}>
          <option value="">Оберіть користувача</option>
          {users
            .filter(u => u.unit_id !== addUserTargetUnit)
            .map(u => (
              <option key={u.id} value={u.id}>{u.name} {u.unit_id ? `(Currently in unit)` : ''}</option>
            ))}
        </select>
        <div className={s.row}>
          <button className={`${s.btn} ${s.btnSecondary} ${s.col}`} onClick={() => {
            setShowAddUserToUnit(false);
            setAddUserTargetUnit(null);
            setSelectedUserId(null);
          }}>Скасувати</button>
          <button className={`${s.btn} ${s.btnPrimary} ${s.col}`} onClick={addUserToUnit}>Додати</button>
        </div>
      </Modal>
    </div>
  );
}
