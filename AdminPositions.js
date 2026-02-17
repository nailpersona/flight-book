// AdminPositions.js — управління посадами (long press для створення ієрархії)
import React, { useContext, useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView,
  TextInput, Modal, Clipboard, PanResponder, Animated, GestureResponderID,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthCtx } from './contexts';
import { Colors, Shadows, BorderRadius, Spacing, FONT } from './theme';
import { supabase } from './supabase';
import ThemedAlert from './ThemedAlert';

// Компонент посади з підтримкою drag-and-drop
// 1 блок = 1 посада, прізвища людей йдуть зверху вниз
const PositionItem = ({ position, level, expanded, onToggle, onEdit, onDelete, onShowCodes, onAddToPosition, onRemoveFromPosition, isDragging, isDropTarget, onLongPress, onToggleEdit }) => {
  console.log('PositionItem render:', position.name, 'people:', position.pilots?.length || 0, 'expanded:', expanded);

  const people = position.pilots || [];
  const hasPeople = people.length > 0;

  return (
    <View
      style={[
        styles.positionBlock,
        isDragging && styles.positionDragging,
        isDropTarget && styles.positionDropTarget,
      ]}
    >
      {/* Основний блок посади */}
      <TouchableOpacity
        style={[styles.positionHeader, { marginLeft: level * 20 }]}
        onPress={onToggle}
        onLongPress={onLongPress}
        delayLongPress={500}
        activeOpacity={0.7}
      >
        {position.children?.length > 0 && (
          <Ionicons
            name={expanded ? 'chevron-down' : 'chevron-forward'}
            size={16}
            color={Colors.textTertiary}
          />
        )}

        {/* Прізвища людей зверху, потім посада знизу */}
        <View style={styles.positionContent}>
          {hasPeople ? (
            <>
              {people.map((person) => (
                <Text key={person.id} style={styles.personName}>{person.name}</Text>
              ))}
              <Text style={styles.positionNameSmall}>{position.name}</Text>
            </>
          ) : (
            // Немає людей: тільки посада
            <Text style={styles.positionName}>{position.name}</Text>
          )}
        </View>
      </TouchableOpacity>

      <View style={styles.positionActions}>
        {/* Перемикач права редагування Зведеної таблиці */}
        <TouchableOpacity onPress={onToggleEdit} style={[styles.actionBtn, position.can_edit_readiness && styles.actionBtnActive]}>
          <Ionicons name={position.can_edit_readiness ? "checkbox" : "square-outline"} size={20} color={position.can_edit_readiness ? Colors.primary : Colors.textTertiary} />
        </TouchableOpacity>
        {/* Кнопка додати до посади */}
        <TouchableOpacity onPress={() => onAddToPosition(position.id)} style={styles.actionBtn}>
          <Ionicons name="person-add" size={20} color={Colors.textTertiary} />
        </TouchableOpacity>
        {/* Кнопка зняти з посади */}
        <TouchableOpacity onPress={() => onRemoveFromPosition(position.id, people)} style={styles.actionBtn}>
          <Ionicons name="person-remove" size={20} color={Colors.textTertiary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onShowCodes(position.id)} style={styles.actionBtn}>
          <Ionicons name="key" size={20} color={Colors.textTertiary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onEdit} style={styles.actionBtn}>
          <Ionicons name="create" size={20} color={Colors.textTertiary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={styles.actionBtn}>
          <Ionicons name="trash" size={20} color={Colors.error} />
        </TouchableOpacity>
      </View>

      {/* Дочірні посади */}
      {expanded && position.children?.length > 0 && (
        <View style={styles.positionChildren}>
          {position.children?.map(child => (
            <PositionItem
              key={child.id}
              position={child}
              level={level + 1}
              expanded={child.expanded}
              onToggle={() => child.onToggle()}
              onEdit={() => child.onEdit()}
              onDelete={() => child.onDelete()}
              onShowCodes={() => child.onShowCodes()}
              onAddToPosition={() => child.onAddToPosition()}
              onRemoveFromPosition={(posId, peopleOnPos) => child.onRemoveFromPosition(posId, peopleOnPos)}
              onLongPress={() => child.onLongPress()}
              onToggleEdit={() => child.onToggleEdit()}
              isDragging={child.isDragging}
              isDropTarget={child.isDropTarget}
            />
          ))}
        </View>
      )}
    </View>
  );
};

export default function AdminPositions({ navigation }) {
  const { auth } = useContext(AuthCtx);
  const [positions, setPositions] = useState([]);
  const [pilots, setPilots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState(new Set());

  // Drag and drop state
  const [draggingPosition, setDraggingPosition] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);
  const [selectingParentFor, setSelectingParentFor] = useState(null);
  const panResponder = useRef(null);
  const dragOpacity = useRef(new Animated.Value(1)).current;

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
  const [codesPositionId, setCodesPositionId] = useState([]);
  const [addToPositionId, setAddToPositionId] = useState(null);
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [removeFromPositionId, setRemoveFromPositionId] = useState(null);
  const [peopleOnPosition, setPeopleOnPosition] = useState([]);
  const [selectedRemovePersonId, setSelectedRemovePersonId] = useState(null);

  if (auth?.role !== 'admin') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Доступ заборонено</Text>
        </View>
      </SafeAreaView>
    );
  }

  const loadData = async () => {
    setLoading(true);
    try {
      const [posRes, pilotsRes] = await Promise.all([
        supabase.from('positions').select('*').order('order_num, name'),
        supabase.from('users').select('id, name, position, position_id').order('name'),
      ]);
      console.log('=== loadData raw ===');
      console.log('pilotsRes data:', pilotsRes.data);
      setPositions(posRes.data || []);
      setPilots(pilotsRes.data || []);
      console.log('=== loadData ===');
      console.log('Positions:', posRes.data?.length || 0);
      console.log('Pilots:', pilotsRes.data?.length || 0);
      console.log('Pilots with position:', pilotsRes.data?.filter(p => p.position).length || 0);
      console.log('Pilots details:', pilotsRes.data?.filter(p => p.position).map(p => ({ id: p.id, name: p.name, position: p.position })));
    } catch (error) {
      ThemedAlert.alert('Помилка', error.message);
    } finally {
      setLoading(false);
    }
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

  // Побудова дерева з drag handlers
  const buildTree = (parentId = null, level = 0) => {
    const result = positions
      .filter(p => p.parent_id === parentId)
      .sort((a, b) => (a.order_num || 0) - (b.order_num || 0))
      .map(pos => {
        const posPilots = pilots.filter(p => p.position_id === pos.id);
        console.log(`buildTree: ${pos.name} (${pos.id}) -> pilots: ${posPilots.length}`);
        console.log(`  Filtering by position name: "${pos.name}"`);
        console.log(`  Pilots with this position:`, posPilots.map(p => p.name));
        return {
          ...pos,
          level,
          expanded: expandedIds.has(pos.name),
          onToggle: () => toggleExpand(pos.name),
          onEdit: () => {
            setEditPos(pos);
            setEditPosName(pos.name);
            setShowEditModal(true);
          },
          onDelete: () => deletePosition(pos),
          onShowCodes: () => showCodes(pos.id),
          onAddToPosition: () => {
            setAddToPositionId(pos.name);
            setSelectedPersonId(null);
            setShowAddToPositionModal(true);
          },
          onRemoveFromPosition: (posId, peopleOnPos) => startRemoveFromPosition(posId, peopleOnPos),
          onLongPress: () => startSelectParent(pos),
          onToggleEdit: () => toggleEditReadiness(pos),
          isDragging: draggingPosition === pos.id,
          isDropTarget: dropTargetId === pos.id && selectingParentFor !== pos.id,
          children: buildTree(pos.id, level + 1),
          pilots: posPilots,
        };
      });
    return result;
  };

  const positionTree = buildTree();

  // Почати вибір батьківської посади (long press)
  const startSelectParent = (position) => {
    setSelectingParentFor(position.id);
    setDropTargetId(null);
  };

  // Вибрати нову батьківську посаду
  const selectParent = async (newParentId) => {
    const positionId = selectingParentFor;
    if (!positionId || !canBeParent(newParentId, positionId)) {
      setSelectingParentFor(null);
      setDropTargetId(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('positions')
        .update({ parent_id: newParentId })
        .eq('id', positionId);

      if (error) throw error;
      setSelectingParentFor(null);
      setDropTargetId(null);
      loadData();
    } catch (error) {
      ThemedAlert.alert('Помилка', error.message);
    }
  };

  // Скасувати вибір батька
  const cancelSelectParent = () => {
    setSelectingParentFor(null);
    setDropTargetId(null);
  };

  const toggleExpand = (name) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(name)) newExpanded.delete(name);
    else newExpanded.add(name);
    setExpandedIds(newExpanded);
  };

  // Додати посаду
  const addPosition = async () => {
    if (!newPosName.trim()) return ThemedAlert.alert('Помилка', 'Введіть назву');

    // Перевірка чи немає вже посади з такою назвою
    const existingPosition = positions.find(p => p.name.toLowerCase() === newPosName.trim().toLowerCase());
    if (existingPosition) {
      return ThemedAlert.alert('Посада існує', `Посада з назвою "${newPosName.trim()}" вже існує. Назви посад мають бути унікальними.`);
    }

    try {
      const { error } = await supabase.from('positions').insert({
        name: newPosName.trim(),
        parent_id: null,
      });
      if (error) throw error;
      setShowAddModal(false);
      setNewPosName('');
      loadData();
    } catch (error) {
      ThemedAlert.alert('Помилка', error.message);
    }
  };

  // Редагувати посаду
  const savePosition = async () => {
    if (!editPosName.trim()) return ThemedAlert.alert('Помилка', 'Введіть назву');

    // Перевірка чи немає вже посади з такою назвою (крім поточної)
    const existingPosition = positions.find(p =>
      p.id !== editPos.id &&
      p.name.toLowerCase() === editPosName.trim().toLowerCase()
    );
    if (existingPosition) {
      return ThemedAlert.alert('Посада існує', `Посада з назвою "${editPosName.trim()}" вже існує. Назви посад мають бути унікальними.`);
    }

    try {
      const { error } = await supabase.from('positions').update({ name: editPosName.trim() }).eq('id', editPos.id);
      if (error) throw error;
      setShowEditModal(false);
      setEditPos(null);
      setEditPosName('');
      loadData();
    } catch (error) {
      ThemedAlert.alert('Помилка', error.message);
    }
  };

  // Видалити посаду
  const deletePosition = async (pos) => {
    ThemedAlert.alert('Видалити посаду?', 'Всі пілоти будуть переміщені на вищий рівень.', [
      { text: 'Скасувати' },
      {
        text: 'Видалити',
        style: 'destructive',
        onPress: async () => {
          try {
            const pilotsInPos = pilots.filter(p => p.position_id === pos.id);
            for (const pilot of pilotsInPos) {
              await supabase.from('users').update({ position_id: pos.parent_id }).eq('id', pilot.id);
            }
            const { error } = await supabase.from('positions').delete().eq('id', pos.id);
            if (error) throw error;
            loadData();
          } catch (error) {
            ThemedAlert.alert('Помилка', error.message);
          }
        },
      },
    ]);
  };

  // Перемкнути право редагування Зведеної таблиці
  const toggleEditReadiness = async (pos) => {
    try {
      const newValue = !pos.can_edit_readiness;
      const { error } = await supabase
        .from('positions')
        .update({ can_edit_readiness: newValue })
        .eq('id', pos.id);
      if (error) throw error;
      loadData();
    } catch (error) {
      ThemedAlert.alert('Помилка', error.message);
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
        await Clipboard.setString(code);
        ThemedAlert.alert('Код створено!', `Код: ${code}\n\nСкопійовано!`);
        loadCodes(positionId);
      }
    } catch (error) {
      ThemedAlert.alert('Помилка', error.message);
    }
  };

  // Скопіювати код
  const copyCode = async (code) => {
    await Clipboard.setString(code);
    ThemedAlert.alert('Скопійовано', code);
  };

  // Завантажити коди
  const loadCodes = async (positionId) => {
    const { data, error } = await supabase.rpc('fn_get_position_codes', { p_position_id: positionId });
    if (!error && data) setCodesPositionId(data);
  };

  // Показати коди
  const showCodes = async (positionId) => {
    setCodesPositionId([]);
    await loadCodes(positionId);
    setShowCodesModal(true);
  };

  // Додати людину до посади
  const addToPosition = async () => {
    if (!selectedPersonId) return ThemedAlert.alert('Помилка', 'Оберіть особу');
    if (!addToPositionId) return ThemedAlert.alert('Помилка', 'Посада не обрана');

    try {
      const { error } = await supabase.from('users').update({ position_id: addToPositionId }).eq('id', selectedPersonId);
      if (error) throw error;
      setShowAddToPositionModal(false);
      setSelectedPersonId(null);
      setAddToPositionId(null);
      // Розгортаємо посаду після додавання
      const newExpanded = new Set(expandedIds);
      newExpanded.add(addToPositionId);
      setExpandedIds(newExpanded);
      await new Promise(resolve => setTimeout(resolve, 500));
      await loadData();
    } catch (error) {
      ThemedAlert.alert('Помилка', error.message);
    }
  };

  // Почати зняття з посади
  const startRemoveFromPosition = (positionId, peopleOnPos) => {
    setRemoveFromPositionId(positionId);
    setPeopleOnPosition(peopleOnPos);
    setSelectedRemovePersonId(null);

    if (peopleOnPos.length === 1) {
      // Тільки 1 людина — зняти без модалки
      removeFromPosition(positionId, peopleOnPos[0].id);
    } else {
      // Більше 1 людини — модалка з вибором
      setShowRemoveFromPositionModal(true);
    }
  };

  // Зняти людину з посади
  const removeFromPosition = async (positionId, personId) => {
    try {
      const { error } = await supabase.from('users').update({ position_id: null }).eq('id', personId);
      if (error) throw error;
      setShowRemoveFromPositionModal(false);
      setRemoveFromPositionId(null);
      setSelectedRemovePersonId(null);
      setPeopleOnPosition([]);
      await loadData();
    } catch (error) {
      ThemedAlert.alert('Помилка', error.message);
    }
  };

  // Рекурсивний рендер
  const renderPosition = (pos) => (
    <View key={pos.id}>
      <PositionItem
        position={pos}
        level={pos.level}
        expanded={pos.expanded}
        onToggle={pos.onToggle}
        onEdit={pos.onEdit}
        onDelete={pos.onDelete}
        onShowCodes={pos.onShowCodes}
        onAddToPosition={pos.onAddToPosition}
        onRemoveFromPosition={pos.onRemoveFromPosition}
        onLongPress={pos.onLongPress}
        onToggleEdit={pos.onToggleEdit}
        isDragging={pos.isDragging}
        isDropTarget={pos.isDropTarget}
      />
      {selectingParentFor === pos.id && pos.children?.map(child => renderPosition(child))}
    </View>
  );

  // Режим вибору батьківської посади
  const renderSelectionMode = () => {
    if (!selectingParentFor) return null;

    const draggingPos = positions.find(p => p.id === selectingParentFor);
    const subtreeIds = getSubtreeIds(selectingParentFor);

    console.log('=== DEBUG SELECT PARENT ===');
    console.log('selectingParentFor:', selectingParentFor);
    console.log('draggingPos:', draggingPos?.name);
    console.log('subtreeIds:', subtreeIds);
    console.log('positions count:', positions.length);

    // Фільтруємо доступні батьківські посади (не з піддерева і не з такою ж назвою)
    const availableParents = positions.filter(p => {
      const shouldInclude = p.id !== selectingParentFor &&
                         !subtreeIds.includes(p.id) &&
                         p.name !== draggingPos?.name;
      if (!shouldInclude) {
        console.log('Excluded:', p.name, 'ID:', p.id);
      }
      return shouldInclude;
    });

    console.log('availableParents count:', availableParents.length);
    console.log('availableParents names:', availableParents.map(p => p.name));

    return (
      <Modal visible={true} transparent animationType="fade">
        <View style={styles.selectBackdrop}>
          <View style={styles.selectCard}>
            <View style={styles.selectHeader}>
              <Ionicons name="move" size={20} color={Colors.primary} />
              <Text style={styles.selectTitle}>Перемістити: {draggingPos?.name}</Text>
            </View>

            <ScrollView style={styles.selectList}>
              <TouchableOpacity
                style={[styles.selectOption, styles.selectOptionRoot]}
                onPress={() => selectParent(null)}
              >
                <Ionicons name="folder" size={18} color={Colors.textTertiary} />
                <Text style={styles.selectOptionText}>Кореневий рівень</Text>
              </TouchableOpacity>

              {availableParents.map(parent => (
                <TouchableOpacity
                  key={parent.id}
                  style={styles.selectOption}
                  onPress={() => selectParent(parent.id)}
                >
                  <Ionicons name="folder-open" size={18} color={Colors.textTertiary} />
                  <Text style={styles.selectOptionText}>{parent.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.selectCancel} onPress={cancelSelectParent}>
              <Text style={styles.selectCancelText}>Скасувати</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Посади</Text>
        <TouchableOpacity onPress={() => setShowAddModal(true)} style={styles.addBtn}>
          <Ionicons name="add" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.hintBar}>
        <Ionicons name="information-circle" size={14} color={Colors.textSecondary} />
        <Text style={styles.hintText}>✓ = редагування Зведеної таблиці | Тримайте довго — перемістити посаду</Text>
      </View>

      {loading ? (
        <View style={styles.center}><Text>Завантаження...</Text></View>
      ) : (
        <ScrollView style={styles.content}>
          {positionTree.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>Немає посад. Натисніть + щоб створити.</Text>
            </View>
          ) : (
            positionTree.map(pos => selectingParentFor === pos.id ? null : renderPosition(pos))
          )}
        </ScrollView>
      )}

      {/* Modal вибору батьківської посади */}
      {renderSelectionMode()}

      {/* Modal додавання посади */}
      <Modal visible={showAddModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Нова посада</Text>
            <TextInput style={styles.input} value={newPosName} onChangeText={setNewPosName} placeholder="Назва посади" />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSecondary]} onPress={() => setShowAddModal(false)}>
                <Text style={styles.modalBtnText}>Скасувати</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={addPosition}>
                <Text style={styles.modalBtnTextPrimary}>Додати</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal редагування */}
      <Modal visible={showEditModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Редагувати</Text>
            <TextInput style={styles.input} value={editPosName} onChangeText={setEditPosName} placeholder="Назва" />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSecondary]} onPress={() => {
                setShowEditModal(false);
                setEditPos(null);
                setEditPosName('');
              }}>
                <Text style={styles.modalBtnText}>Скасувати</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={savePosition}>
                <Text style={styles.modalBtnTextPrimary}>Зберегти</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal кодів */}
      <Modal visible={showCodesModal} transparent animationType="fade">
        <TouchableOpacity style={styles.modalTouchable} activeOpacity={1} onPress={() => setShowCodesModal(false)}>
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.codesHeader}>
              <Text style={styles.modalTitle}>Коди запрошення</Text>
              <TouchableOpacity onPress={() => createCode(addPilotPositionId || codesPositionId[0]?.position)} style={styles.createCodeBtn}>
                <Ionicons name="add-circle" size={20} color={Colors.primary} />
                <Text style={styles.createCodeBtnText}>Створити</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.codesList}>
              {codesPositionId.map(code => (
                <View key={code.id} style={styles.codeItem}>
                  <Text style={styles.codeText}>{code.code}</Text>
                  <Text style={styles.codeMeta}>Використано: {code.used_count}</Text>
                  <TouchableOpacity onPress={() => copyCode(code.code)} style={styles.codeCopyBtn}>
                    <Ionicons name="copy" size={18} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              ))}
              {codesPositionId.length === 0 && (
                <Text style={styles.emptyText}>Немає кодів</Text>
              )}
            </ScrollView>
            <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSecondary]} onPress={() => setShowCodesModal(false)}>
              <Text style={styles.modalBtnText}>Закрити</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal додавання до посади */}
      <Modal visible={showAddToPositionModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Додати до посади</Text>
            <ScrollView style={styles.peopleList}>
              {pilots.map(person => (
                <TouchableOpacity
                  key={person.id}
                  style={[styles.personSelectItem, selectedPersonId === person.id && styles.personSelectItemActive]}
                  onPress={() => setSelectedPersonId(person.id)}
                >
                  <Text style={[styles.personSelectText, selectedPersonId === person.id && styles.personSelectTextActive]}>{person.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSecondary]} onPress={() => {
                setShowAddToPositionModal(false);
                setSelectedPersonId(null);
                setAddToPositionId(null);
              }}>
                <Text style={styles.modalBtnText}>Скасувати</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={addToPosition}>
                <Text style={styles.modalBtnTextPrimary}>Додати</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal зняття з посади */}
      <Modal visible={showRemoveFromPositionModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Зняти з посади</Text>
            <ScrollView style={styles.peopleList}>
              {peopleOnPosition.map(person => (
                <TouchableOpacity
                  key={person.id}
                  style={[styles.personSelectItem, selectedRemovePersonId === person.id && styles.personSelectItemActive]}
                  onPress={() => setSelectedRemovePersonId(person.id)}
                >
                  <Text style={[styles.personSelectText, selectedRemovePersonId === person.id && styles.personSelectTextActive]}>{person.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSecondary]} onPress={() => {
                setShowRemoveFromPositionModal(false);
                setSelectedRemovePersonId(null);
                setRemoveFromPositionId(null);
                setPeopleOnPosition([]);
              }}>
                <Text style={styles.modalBtnText}>Скасувати</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={() => removeFromPosition(removeFromPositionId, selectedRemovePersonId)}>
                <Text style={styles.modalBtnTextPrimary}>Зняти</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgTertiary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: Colors.textTertiary },
  emptyText: { fontSize: 14, color: Colors.textTertiary, textAlign: 'center', padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, backgroundColor: Colors.bgPrimary, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 16, fontFamily: FONT, color: Colors.textPrimary, textAlign: 'center' },
  addBtn: { padding: 4 },
  hintBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.bgPrimary, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 8 },
  hintText: { fontSize: 12, color: Colors.textSecondary, flex: 1 },
  content: { flex: 1, padding: Spacing.md },
  positionBlock: { marginBottom: 0 },
  positionHeader: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: Spacing.sm, backgroundColor: Colors.bgSecondary, borderRadius: BorderRadius.md },
  positionName: { flex: 1, fontSize: 14, fontFamily: FONT, color: Colors.textPrimary, marginLeft: 8 },
  positionNameSmall: { fontSize: 13, fontFamily: FONT, color: Colors.textSecondary },
  positionContent: { flex: 1, marginLeft: 8, gap: 4 },
  positionCount: { fontSize: 12, color: Colors.textTertiary },
  positionDragging: { opacity: 0.6 },
  positionDropTarget: { borderWidth: 2, borderColor: Colors.primary },
  dragHandle: { padding: 4, marginRight: 4 },
  positionActions: { flexDirection: 'row', gap: 4, marginRight: 8 },
  actionBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  actionBtnActive: { backgroundColor: Colors.bgTertiary, borderRadius: 6 },
  positionChildren: { paddingLeft: 20 },
  pilotItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 12, marginLeft: 20 },
  pilotName: { marginLeft: 8, fontSize: 13, fontFamily: FONT, color: Colors.textPrimary },
  pilotNameLarge: { fontSize: 18, fontFamily: FONT, color: Colors.textPrimary },
  pilotRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginRight: 8 },
  pilotRemoveBtn: { padding: 4 },
  personName: { fontSize: 15, fontFamily: FONT, color: Colors.textPrimary },
  // Select parent modal
  selectBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  selectCard: { backgroundColor: Colors.bgPrimary, borderRadius: BorderRadius.xl, width: '100%', maxWidth: 400, maxHeight: '70%', ...Shadows.large },
  selectHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  selectTitle: { fontSize: 16, fontFamily: FONT, color: Colors.textPrimary, flex: 1 },
  selectList: { maxHeight: 350 },
  selectOption: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12, minHeight: 44 },
  selectOptionRoot: { backgroundColor: Colors.bgSecondary },
  selectOptionText: { flex: 1, fontSize: 15, fontFamily: FONT, color: Colors.textPrimary },
  selectCancel: { padding: Spacing.md, alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.border },
  selectCancelText: { fontSize: 16, fontFamily: FONT, color: Colors.primary },
  // Modal
  modalBackdrop: { flex: 1, padding: Spacing.lg, justifyContent: 'center', alignItems: 'center' },
  modalTouchable: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalCard: { backgroundColor: Colors.bgPrimary, borderRadius: BorderRadius.xl, padding: Spacing.lg, width: '100%', maxWidth: 400, ...Shadows.large },
  modalTitle: { fontSize: 16, fontFamily: FONT, color: Colors.textPrimary, marginBottom: Spacing.md },
  input: { minHeight: 44, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, backgroundColor: Colors.bgSecondary, borderWidth: 1, borderColor: Colors.border, fontSize: 15, fontFamily: FONT, marginBottom: Spacing.md },
  modalButtons: { flexDirection: 'row', gap: Spacing.md },
  modalBtn: { flex: 1, height: 48, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center' },
  modalBtnSecondary: { backgroundColor: Colors.bgTertiary, borderWidth: 1, borderColor: Colors.border },
  modalBtnPrimary: { backgroundColor: Colors.primary },
  modalBtnText: { fontSize: 16, fontFamily: FONT, color: Colors.textPrimary },
  modalBtnTextPrimary: { fontSize: 16, fontFamily: FONT, color: Colors.textInverse },
  // Codes
  codesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  createCodeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  createCodeBtnText: { fontSize: 14, color: Colors.primary },
  codesList: { maxHeight: 200 },
  codeItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.sm, backgroundColor: Colors.bgSecondary, borderRadius: BorderRadius.md, marginBottom: 8 },
  codeText: { flex: 1, fontSize: 16, letterSpacing: 2, fontFamily: FONT },
  codeMeta: { fontSize: 12, color: Colors.textTertiary },
  codeCopyBtn: { padding: 4 },
  // People
  peopleList: { maxHeight: 250 },
  personSelectItem: { padding: Spacing.sm, backgroundColor: Colors.bgSecondary, borderRadius: BorderRadius.md, marginBottom: 4 },
  personSelectItemActive: { backgroundColor: Colors.primary },
  personSelectText: { fontSize: 14, fontFamily: FONT, color: Colors.textPrimary },
  personSelectTextActive: { color: Colors.textInverse },
});
