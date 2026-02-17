'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  IoChevronBack, IoAddOutline, IoChevronDown, IoChevronForward,
  IoPersonAddOutline, IoPersonRemoveOutline, IoKeyOutline,
  IoCreateOutline, IoTrashOutline, IoInformationCircleOutline,
  IoFolderOutline, IoFolderOpenOutline, IoCopyOutline, IoAddCircleOutline,
  IoCheckboxOutline, IoSquareOutline
} from 'react-icons/io5';
import { useAuth } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import Modal from '../../../components/Modal';
import s from '../../../components/shared.module.css';

export default function AdminPositionsPage() {
  const { auth } = useAuth();
  const router = useRouter();
  const [positions, setPositions] = useState([]);
  const [pilots, setPilots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState(new Set());

  // Drag and drop state
  const [selectingParentFor, setSelectingParentFor] = useState(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCodesModal, setShowCodesModal] = useState(false);
  const [showAddToPositionModal, setShowAddToPositionModal] = useState(false);
  const [showRemoveFromPositionModal, setShowRemoveFromPositionModal] = useState(false);

  // Form
  const [newPosName, setNewPosName] = useState('');
  const [editPos, setEditPos] = useState(null);
  const [editPosName, setEditPosName] = useState('');
  const [codes, setCodes] = useState([]);
  const [addToPositionId, setAddToPositionId] = useState(null);
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [removeFromPositionId, setRemoveFromPositionId] = useState(null);
  const [peopleOnPosition, setPeopleOnPosition] = useState([]);
  const [selectedRemovePersonId, setSelectedRemovePersonId] = useState(null);

  if (auth?.role !== 'admin') {
    return <div className={s.page}><div className={s.emptyText}>Доступ заборонено</div></div>;
  }

  const loadData = async () => {
    setLoading(true);
    const [posRes, pilotsRes] = await Promise.all([
      supabase.from('positions').select('*').order('order_num, name'),
      supabase.from('users').select('id, name, position, position_id').order('name'),
    ]);
    setPositions(posRes.data || []);
    setPilots(pilotsRes.data || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // Розгорнути всі посади при завантаженні
  useEffect(() => {
    if (positions.length > 0 && expandedIds.size === 0) {
      setExpandedIds(new Set(positions.map(p => p.name)));
    }
  }, [positions]);

  // Перевірка чи може позиція бути батьком
  const canBeParent = (parentId, childId) => {
    if (parentId === childId) return false;
    const checkAncestor = (id) => {
      const parent = positions.find(p => p.id === id);
      if (!parent || !parent.parent_id) return false;
      if (parent.parent_id === childId) return true;
      return checkAncestor(parent.parent_id);
    };
    return !checkAncestor(parentId);
  };

  // Отримати всі ID позицій в піддереві
  const getSubtreeIds = (posId) => {
    const ids = [posId];
    const children = positions.filter(p => p.parent_id === posId);
    for (const child of children) {
      ids.push(...getSubtreeIds(child.id));
    }
    return ids;
  };

  // Побудова дерева
  const buildTree = useCallback((parentId = null, level = 0) => {
    return positions
      .filter(p => p.parent_id === parentId)
      .sort((a, b) => (a.order_num || 0) - (b.order_num || 0))
      .map(pos => {
        const posPilots = pilots.filter(p => p.position_id === pos.id);
        return {
          ...pos,
          level,
          expanded: expandedIds.has(pos.name),
          pilots: posPilots,
          children: buildTree(pos.id, level + 1),
        };
      });
  }, [positions, pilots, expandedIds]);

  const positionTree = buildTree();

  // Вибрати нову батьківську посаду
  const selectParent = async (newParentId) => {
    const positionId = selectingParentFor;
    if (!positionId || !canBeParent(newParentId, positionId)) {
      setSelectingParentFor(null);
      return;
    }

    const { error } = await supabase
      .from('positions')
      .update({ parent_id: newParentId })
      .eq('id', positionId);

    if (error) {
      window.alert(error.message);
    } else {
      setSelectingParentFor(null);
      loadData();
    }
  };

  const toggleExpand = (name) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(name)) newExpanded.delete(name);
    else newExpanded.add(name);
    setExpandedIds(newExpanded);
  };

  // Додати посаду
  const addPosition = async () => {
    if (!newPosName.trim()) {
      window.alert('Введіть назву');
      return;
    }

    const existingPosition = positions.find(p => p.name.toLowerCase() === newPosName.trim().toLowerCase());
    if (existingPosition) {
      window.alert(`Посада з назвою "${newPosName.trim()}" вже існує`);
      return;
    }

    const { error } = await supabase.from('positions').insert({
      name: newPosName.trim(),
      parent_id: null,
    });
    if (error) {
      window.alert(error.message);
    } else {
      setShowAddModal(false);
      setNewPosName('');
      loadData();
    }
  };

  // Редагувати посаду
  const savePosition = async () => {
    if (!editPosName.trim()) {
      window.alert('Введіть назву');
      return;
    }

    const existingPosition = positions.find(p =>
      p.id !== editPos.id &&
      p.name.toLowerCase() === editPosName.trim().toLowerCase()
    );
    if (existingPosition) {
      window.alert(`Посада з назвою "${editPosName.trim()}" вже існує`);
      return;
    }

    const { error } = await supabase.from('positions').update({ name: editPosName.trim() }).eq('id', editPos.id);
    if (error) {
      window.alert(error.message);
    } else {
      setShowEditModal(false);
      setEditPos(null);
      setEditPosName('');
      loadData();
    }
  };

  // Видалити посаду
  const deletePosition = async (pos) => {
    if (!window.confirm('Видалити посаду? Всі пілоти будуть переміщені на вищий рівень.')) return;

    try {
      const pilotsInPos = pilots.filter(p => p.position_id === pos.id);
      for (const pilot of pilotsInPos) {
        await supabase.from('users').update({ position_id: pos.parent_id }).eq('id', pilot.id);
      }
      const { error } = await supabase.from('positions').delete().eq('id', pos.id);
      if (error) throw error;
      loadData();
    } catch (error) {
      window.alert(error.message);
    }
  };

  // Перемкнути право редагування Зведеної таблиці
  const toggleEditReadiness = async (pos) => {
    const newValue = !pos.can_edit_readiness;
    const { error } = await supabase
      .from('positions')
      .update({ can_edit_readiness: newValue })
      .eq('id', pos.id);
    if (error) {
      window.alert(error.message);
    } else {
      loadData();
    }
  };

  // Створити код
  const createCode = async (positionId) => {
    try {
      const { data, error } = await supabase.rpc('fn_create_position_invite', {
        p_position_id: positionId,
        p_created_by: auth?.userId,
      });
      if (error) throw error;
      if (data && data.length > 0) {
        const code = data[0].code;
        await navigator.clipboard.writeText(code);
        window.alert(`Код створено: ${code}\n\nСкопійовано!`);
        loadCodes(positionId);
      }
    } catch (error) {
      window.alert(error.message);
    }
  };

  // Скопіювати код
  const copyCode = async (code) => {
    await navigator.clipboard.writeText(code);
    window.alert(`Скопійовано: ${code}`);
  };

  // Завантажити коди
  const loadCodes = async (positionId) => {
    const { data, error } = await supabase.rpc('fn_get_position_codes', { p_position_id: positionId });
    if (!error && data) setCodes(data);
  };

  // Показати коди
  const showCodes = async (positionId) => {
    setCodes([]);
    await loadCodes(positionId);
    setAddToPositionId(positionId);
    setShowCodesModal(true);
  };

  // Додати людину до посади
  const addToPosition = async () => {
    if (!selectedPersonId) {
      window.alert('Оберіть особу');
      return;
    }
    if (!addToPositionId) {
      window.alert('Посада не обрана');
      return;
    }

    const { error } = await supabase.from('users').update({ position_id: addToPositionId }).eq('id', selectedPersonId);
    if (error) {
      window.alert(error.message);
    } else {
      setShowAddToPositionModal(false);
      setSelectedPersonId(null);
      setAddToPositionId(null);
      const newExpanded = new Set(expandedIds);
      newExpanded.add(addToPositionId);
      setExpandedIds(newExpanded);
      await new Promise(resolve => setTimeout(resolve, 300));
      loadData();
    }
  };

  // Почати зняття з посади
  const startRemoveFromPosition = (positionId, peopleOnPos) => {
    setRemoveFromPositionId(positionId);
    setPeopleOnPosition(peopleOnPos);
    setSelectedRemovePersonId(null);

    if (peopleOnPos.length === 1) {
      removeFromPosition(positionId, peopleOnPos[0].id);
    } else {
      setShowRemoveFromPositionModal(true);
    }
  };

  // Зняти людину з посади
  const removeFromPosition = async (positionId, personId) => {
    const { error } = await supabase.from('users').update({ position_id: null }).eq('id', personId);
    if (error) {
      window.alert(error.message);
    } else {
      setShowRemoveFromPositionModal(false);
      setRemoveFromPositionId(null);
      setSelectedRemovePersonId(null);
      setPeopleOnPosition([]);
      loadData();
    }
  };

  // Рендер посади
  const renderPosition = (pos) => {
    const people = pos.pilots || [];
    const hasPeople = people.length > 0;
    const hasChildren = pos.children?.length > 0;
    const indent = pos.level * 20;

    // Якщо ця посада вибрана для переміщення, не показуємо її в дереві
    if (selectingParentFor === pos.id) {
      return pos.children?.map(child => renderPosition(child));
    }

    return (
      <div key={pos.id} className={s.unitBlock}>
        <div
          className={s.unitHeader}
          style={{ paddingLeft: indent, cursor: 'pointer' }}
          onClick={() => hasChildren && toggleExpand(pos.name)}
          onContextMenu={(e) => {
            e.preventDefault();
            setSelectingParentFor(pos.id);
          }}
        >
          {hasChildren && (
            <span className={s.unitToggle}>
              {pos.expanded ? <IoChevronDown size={16} /> : <IoChevronForward size={16} />}
            </span>
          )}
          {!hasChildren && <span className={s.unitToggle} style={{ width: 16 }} />}

          <div style={{ flex: 1, marginLeft: 8 }}>
            {hasPeople ? (
              <>
                {people.map((person) => (
                  <div key={person.id} style={{ fontSize: 15, fontWeight: 400, color: '#111827' }}>{person.name}</div>
                ))}
                <div style={{ fontSize: 13, fontWeight: 400, color: '#6B7280' }}>{pos.name}</div>
              </>
            ) : (
              <div style={{ fontSize: 14, fontWeight: 400, color: '#111827' }}>{pos.name}</div>
            )}
          </div>

          <div className={s.unitActions} onClick={e => e.stopPropagation()}>
            <button
              className={s.unitBtn}
              onClick={() => toggleEditReadiness(pos)}
              title={pos.can_edit_readiness ? 'Може редагувати Зведену таблицю (натисніть щоб вимкнути)' : 'Не може редагувати (натисніть щоб дозволити)'}
              style={pos.can_edit_readiness ? { color: '#2563EB', background: '#EFF6FF' } : {}}
            >
              {pos.can_edit_readiness ? <IoCheckboxOutline size={20} /> : <IoSquareOutline size={20} />}
            </button>
            <button className={s.unitBtn} onClick={() => {
              setAddToPositionId(pos.id);
              setSelectedPersonId(null);
              setShowAddToPositionModal(true);
            }} title="Додати до посади"><IoPersonAddOutline size={20} /></button>
            <button className={s.unitBtn} onClick={() => startRemoveFromPosition(pos.name, people)} title="Зняти з посади"><IoPersonRemoveOutline size={20} /></button>
            <button className={s.unitBtn} onClick={() => showCodes(pos.id)} title="Коди"><IoKeyOutline size={20} /></button>
            <button className={s.unitBtn} onClick={() => {
              setEditPos(pos);
              setEditPosName(pos.name);
              setShowEditModal(true);
            }} title="Редагувати"><IoCreateOutline size={20} /></button>
            <button className={s.unitBtn} onClick={() => deletePosition(pos)} title="Видалити" style={{ color: '#EF4444' }}><IoTrashOutline size={20} /></button>
          </div>
        </div>

        {pos.expanded && pos.children?.length > 0 && (
          <div className={s.unitChildren}>
            {pos.children.map(child => renderPosition(child))}
          </div>
        )}
      </div>
    );
  };

  // Режим вибору батьківської посади
  const renderSelectionMode = () => {
    if (!selectingParentFor) return null;

    const draggingPos = positions.find(p => p.id === selectingParentFor);
    const subtreeIds = getSubtreeIds(selectingParentFor);

    const availableParents = positions.filter(p =>
      p.id !== selectingParentFor &&
      !subtreeIds.includes(p.id) &&
      p.name !== draggingPos?.name
    );

    return (
      <Modal visible={true} onClose={() => setSelectingParentFor(null)} title={`Перемістити: ${draggingPos?.name}`}>
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderBottom: '1px solid #F3F4F6', cursor: 'pointer', background: '#F9FAFB' }}
            onClick={() => selectParent(null)}
          >
            <IoFolderOutline size={18} style={{ color: '#6B7280' }} />
            <span style={{ fontSize: 15, fontWeight: 400, color: '#111827' }}>Кореневий рівень</span>
          </div>
          {availableParents.map(parent => (
            <div
              key={parent.id}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderBottom: '1px solid #F3F4F6', cursor: 'pointer' }}
              onClick={() => selectParent(parent.id)}
            >
              <IoFolderOpenOutline size={18} style={{ color: '#6B7280' }} />
              <span style={{ fontSize: 15, fontWeight: 400, color: '#111827' }}>{parent.name}</span>
            </div>
          ))}
        </div>
        <div className={s.row} style={{ marginTop: 12 }}>
          <button className={`${s.btn} ${s.btnSecondary} ${s.col}`} onClick={() => setSelectingParentFor(null)}>
            Скасувати
          </button>
        </div>
      </Modal>
    );
  };

  return (
    <div className={s.page}>
      <div className={s.topBar}>
        <button className={s.topBarBack} onClick={() => router.push('/tabs/admin-settings')}>
          <IoChevronBack size={20} />
        </button>
        <span className={s.topBarTitle}>Посади</span>
        <button className={s.topBarBack} onClick={() => setShowAddModal(true)} style={{ marginLeft: 'auto' }}>
          <IoAddOutline size={20} />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', fontSize: 12, color: '#6B7280' }}>
        <IoInformationCircleOutline size={14} />
        <span>☑ = редагування Зведеної таблиці | Права кнопка — перемістити посаду</span>
      </div>

      {loading && <div className={s.loadingWrap}><div className={s.spinner} style={{ borderTopColor: '#111827', width: 24, height: 24 }} /></div>}

      {!loading && (
        <div className={s.card}>
          {positionTree.length === 0 ? (
            <div className={s.emptyText}>Немає посад. Натисніть + щоб створити.</div>
          ) : (
            <div className={s.unitTree}>
              {positionTree.map(pos => renderPosition(pos))}
            </div>
          )}
        </div>
      )}

      {renderSelectionMode()}

      {/* Modal додавання посади */}
      <Modal visible={showAddModal} onClose={() => setShowAddModal(false)} title="Нова посада">
        <div className={s.label}>Назва посади</div>
        <input
          className={s.input}
          value={newPosName}
          onChange={e => setNewPosName(e.target.value)}
          placeholder="Назва посади"
          style={{ marginBottom: 16 }}
        />
        <div className={s.row}>
          <button className={`${s.btn} ${s.btnSecondary} ${s.col}`} onClick={() => setShowAddModal(false)}>Скасувати</button>
          <button className={`${s.btn} ${s.btnPrimary} ${s.col}`} onClick={addPosition}>Додати</button>
        </div>
      </Modal>

      {/* Modal редагування */}
      <Modal visible={showEditModal} onClose={() => setShowEditModal(false)} title="Редагувати посаду">
        <div className={s.label}>Назва</div>
        <input
          className={s.input}
          value={editPosName}
          onChange={e => setEditPosName(e.target.value)}
          placeholder="Назва"
          style={{ marginBottom: 16 }}
        />
        <div className={s.row}>
          <button className={`${s.btn} ${s.btnSecondary} ${s.col}`} onClick={() => setShowEditModal(false)}>Скасувати</button>
          <button className={`${s.btn} ${s.btnPrimary} ${s.col}`} onClick={savePosition}>Зберегти</button>
        </div>
      </Modal>

      {/* Modal кодів */}
      <Modal visible={showCodesModal} onClose={() => setShowCodesModal(false)} title="Коди запрошення">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 14, color: '#6B7280' }}>Коди для посади</span>
          <button
            onClick={() => createCode(addToPositionId)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}
          >
            <IoAddCircleOutline size={20} />
            <span style={{ fontSize: 14 }}>Створити</span>
          </button>
        </div>
        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
          {codes.map(code => (
            <div key={code.id} style={{ display: 'flex', alignItems: 'center', padding: 8, background: '#F9FAFB', borderRadius: 8, marginBottom: 6 }}>
              <span style={{ flex: 1, fontSize: 16, fontWeight: 400, letterSpacing: 2 }}>{code.code}</span>
              <span style={{ fontSize: 12, color: '#6B7280', marginRight: 8 }}>Використано: {code.used_count}</span>
              <button onClick={() => copyCode(code.code)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <IoCopyOutline size={18} style={{ color: '#6B7280' }} />
              </button>
            </div>
          ))}
          {codes.length === 0 && <div className={s.emptyText}>Немає кодів</div>}
        </div>
        <div className={s.row} style={{ marginTop: 12 }}>
          <button className={`${s.btn} ${s.btnSecondary} ${s.col}`} onClick={() => setShowCodesModal(false)}>Закрити</button>
        </div>
      </Modal>

      {/* Modal додавання до посади */}
      <Modal visible={showAddToPositionModal} onClose={() => setShowAddToPositionModal(false)} title="Додати до посади">
        <div className={s.label}>Оберіть особу</div>
        <div style={{ maxHeight: 250, overflowY: 'auto' }}>
          {pilots.map(person => (
            <div
              key={person.id}
              onClick={() => setSelectedPersonId(person.id)}
              style={{
                padding: 10,
                background: selectedPersonId === person.id ? '#D9DBDE' : '#F9FAFB',
                borderRadius: 8,
                marginBottom: 4,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 400,
                color: '#111827',
              }}
            >
              {person.name}
            </div>
          ))}
        </div>
        <div className={s.row} style={{ marginTop: 12 }}>
          <button className={`${s.btn} ${s.btnSecondary} ${s.col}`} onClick={() => setShowAddToPositionModal(false)}>Скасувати</button>
          <button className={`${s.btn} ${s.btnPrimary} ${s.col}`} onClick={addToPosition}>Додати</button>
        </div>
      </Modal>

      {/* Modal зняття з посади */}
      <Modal visible={showRemoveFromPositionModal} onClose={() => setShowRemoveFromPositionModal(false)} title="Зняти з посади">
        <div className={s.label}>Оберіть особу</div>
        <div style={{ maxHeight: 250, overflowY: 'auto' }}>
          {peopleOnPosition.map(person => (
            <div
              key={person.id}
              onClick={() => setSelectedRemovePersonId(person.id)}
              style={{
                padding: 10,
                background: selectedRemovePersonId === person.id ? '#D9DBDE' : '#F9FAFB',
                borderRadius: 8,
                marginBottom: 4,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 400,
                color: '#111827',
              }}
            >
              {person.name}
            </div>
          ))}
        </div>
        <div className={s.row} style={{ marginTop: 12 }}>
          <button className={`${s.btn} ${s.btnSecondary} ${s.col}`} onClick={() => setShowRemoveFromPositionModal(false)}>Скасувати</button>
          <button className={`${s.btn} ${s.btnPrimary} ${s.col}`} onClick={() => removeFromPosition(removeFromPositionId, selectedRemovePersonId)}>Зняти</button>
        </div>
      </Modal>
    </div>
  );
}
