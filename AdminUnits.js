// AdminUnits.js — управління підрозділами в мобільному застосунку
import React, { useContext, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  Modal,
  Clipboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthCtx } from './contexts';
import { Colors, Shadows, BorderRadius, Spacing, FONT } from './theme';
import { supabase } from './supabase';
import ThemedAlert from './ThemedAlert';

// Типи підрозділів
const UNIT_TYPES = {
  brigade: 'Бригада',
  squadron: 'Ескадрилья',
  linka: 'Ланка',
};

const UNIT_LEVELS = ['brigade', 'squadron', 'linka'];

// Компонент заголовка підрозділу
const UnitHeader = ({ unit, level, expanded, onToggle, onEdit, onDelete, onAddChild, onShowCodes, userCount }) => {
  const indent = level * 20;

  return (
    <View style={[styles.unitHeader, { marginLeft: indent }]}>
      <TouchableOpacity onPress={onToggle} style={styles.unitHeaderLeft}>
        {(unit.children?.length > 0 || unit.users?.length > 0) && (
          <Ionicons
            name={expanded ? 'chevron-down' : 'chevron-forward'}
            size={16}
            color={Colors.textTertiary}
          />
        )}
        <View style={styles.unitTypeBadge}>
          <Text style={styles.unitTypeText}>{UNIT_TYPES[unit.type]}</Text>
        </View>
        <Text style={styles.unitName}>{unit.name}</Text>
        <Text style={styles.unitCount}>({userCount})</Text>
      </TouchableOpacity>
      <View style={styles.unitActions}>
        <TouchableOpacity onPress={onShowCodes} style={styles.unitActionBtn}>
          <Ionicons name="key-outline" size={16} color={Colors.textTertiary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onEdit} style={styles.unitActionBtn}>
          <Ionicons name="create-outline" size={16} color={Colors.textTertiary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={styles.unitActionBtn}>
          <Ionicons name="remove-circle-outline" size={16} color={Colors.textTertiary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onAddChild} style={styles.unitActionBtn}>
          <Ionicons name="add-outline" size={16} color={Colors.textTertiary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Компонент користувача
const UserItem = ({ user, onMove }) => (
  <View style={styles.userItem}>
    <Ionicons name="person-outline" size={14} color={Colors.textTertiary} />
    <Text style={styles.userName}>{user.name}</Text>
    <Text style={styles.userInfo}>{user.rank || ''} {user.position || ''}</Text>
    <TouchableOpacity onPress={() => onMove(user)} style={styles.userMoveBtn}>
      <Ionicons name="arrow-forward" size={14} color={Colors.textTertiary} />
    </TouchableOpacity>
  </View>
);

export default function AdminUnits({ navigation }) {
  const { auth } = useContext(AuthCtx);
  const [units, setUnits] = useState([]);
  const [users, setUsers] = useState([]);
  const [inviteCodes, setInviteCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedUnits, setExpandedUnits] = useState(new Set());

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showCodesModal, setShowCodesModal] = useState(false);

  // Form states
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitType, setNewUnitType] = useState('linka');
  const [newUnitParent, setNewUnitParent] = useState(null);
  const [editUnit, setEditUnit] = useState(null);
  const [editUnitName, setEditUnitName] = useState('');
  const [moveUser, setMoveUser] = useState(null);
  const [moveTargetUnit, setMoveTargetUnit] = useState(null);
  const [addUserTargetUnit, setAddUserTargetUnit] = useState(null);
  const [selectedUserToAdd, setSelectedUserToAdd] = useState(null);
  const [codesUnitId, setCodesUnitId] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [unitsRes, usersRes, codesRes] = await Promise.all([
        supabase.from('units').select('*').order('order_num, name'),
        supabase.from('users').select('id, name, email, rank, position, unit_id').order('name'),
        supabase.rpc('fn_get_unit_codes'),
      ]);
      setUnits(unitsRes.data || []);
      setUsers(usersRes.data || []);
      setInviteCodes(codesRes.data || []);
    } catch (error) {
      ThemedAlert.alert('Помилка', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Побудова дерева
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
        users: users.filter(u => u.unit_id === unit.id),
      }));
  }, [units, users]);

  const unitTree = buildUnitTree();

  // Підрахунок користувачів
  const countUsersInUnit = useCallback((unit) => {
    let count = unit.users?.length || 0;
    unit.children?.forEach(child => {
      count += countUsersInUnit(child);
    });
    return count;
  }, []);

  // Перемикання розгортання
  const toggleExpand = (unitId) => {
    const newExpanded = new Set(expandedUnits);
    if (newExpanded.has(unitId)) {
      newExpanded.delete(unitId);
    } else {
      newExpanded.add(unitId);
    }
    setExpandedUnits(newExpanded);
  };

  // Отримати плоский список підрозділів для select
  const getFlatUnits = (unitList = unitTree, prefix = '') => {
    let result = [];
    for (const item of unitList) {
      result.push({ id: item.id, name: prefix + item.name });
      result.push(...getFlatUnits(item.children, prefix + '  '));
    }
    return result;
  };

  // Додати підрозділ
  const addUnit = async () => {
    if (!newUnitName.trim()) {
      ThemedAlert.alert('Помилка', 'Введіть назву підрозділу');
      return;
    }
    try {
      const { error } = await supabase.from('units').insert({
        name: newUnitName.trim(),
        type: newUnitType,
        parent_id: newUnitParent,
      });
      if (error) throw error;
      setShowAddModal(false);
      setNewUnitName('');
      setNewUnitType('linka');
      setNewUnitParent(null);
      await loadData();
    } catch (error) {
      ThemedAlert.alert('Помилка', error.message);
    }
  };

  // Редагувати підрозділ
  const saveUnit = async () => {
    if (!editUnitName.trim()) {
      ThemedAlert.alert('Помилка', 'Введіть назву підрозділу');
      return;
    }
    try {
      const { error } = await supabase
        .from('units')
        .update({ name: editUnitName.trim() })
        .eq('id', editUnit.id);
      if (error) throw error;
      setShowEditModal(false);
      setEditUnit(null);
      await loadData();
    } catch (error) {
      ThemedAlert.alert('Помилка', error.message);
    }
  };

  // Видалити підрозділ
  const deleteUnit = async (unit) => {
    ThemedAlert.alert(
      'Підтвердження',
      'Видалити підрозділ? Всі користувачі будуть переміщені на вищий рівень.',
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Видалити',
          style: 'destructive',
          onPress: async () => {
            try {
              // Переміщуємо користувачів
              const usersInUnit = users.filter(u => u.unit_id === unit.id);
              for (const user of usersInUnit) {
                await supabase.from('users').update({ unit_id: unit.parent_id }).eq('id', user.id);
              }
              // Видаляємо підрозділ
              const { error } = await supabase.from('units').delete().eq('id', unit.id);
              if (error) throw error;
              await loadData();
            } catch (error) {
              ThemedAlert.alert('Помилка', error.message);
            }
          },
        },
      ]
    );
  };

  // Перемістити користувача
  const moveUserToUnit = async () => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ unit_id: moveTargetUnit })
        .eq('id', moveUser.id);
      if (error) throw error;
      setShowMoveModal(false);
      setMoveUser(null);
      setMoveTargetUnit(null);
      await loadData();
    } catch (error) {
      ThemedAlert.alert('Помилка', error.message);
    }
  };

  // Додати користувача до підрозділу
  const addUserToUnit = async () => {
    if (!selectedUserToAdd) {
      ThemedAlert.alert('Помилка', 'Оберіть пілота');
      return;
    }
    try {
      const { error } = await supabase
        .from('users')
        .update({ unit_id: addUserTargetUnit })
        .eq('id', selectedUserToAdd);
      if (error) throw error;
      setShowAddUserModal(false);
      setSelectedUserToAdd(null);
      setAddUserTargetUnit(null);
      await loadData();
    } catch (error) {
      ThemedAlert.alert('Помилка', error.message);
    }
  };

  // Отримати користувачів без підрозділу або з інших підрозділів
  const getAvailableUsers = () => {
    return users.filter(u => !u.unit_id || u.unit_id !== addUserTargetUnit);
  };

  // Отримати коди для підрозділу
  const getUnitCodes = (unitId) => {
    return inviteCodes.filter(c => c.unit_id === unitId);
  };

  // Створити код запрошення
  const createInviteCode = async (unitId) => {
    try {
      const { data, error } = await supabase.rpc('fn_create_invite_code', {
        p_unit_id: unitId,
        p_created_by: auth?.userId,
        p_expires_days: 30,
      });
      if (error) throw error;
      if (data && data.length > 0) {
        const code = data[0].code;
        await Clipboard.setString(code);
        ThemedAlert.alert('Код створено!', `Код: ${code}\n\nСкопійовано в буфер обміну`);
        await loadData();
      }
    } catch (error) {
      ThemedAlert.alert('Помилка', error.message);
    }
  };

  // Скопіювати код
  const copyCode = async (code) => {
    await Clipboard.setString(code);
    ThemedAlert.alert('Скопійовано', `Код: ${code}`);
  };

  // Деактивувати код
  const deactivateCode = async (codeId) => {
    try {
      const { error } = await supabase.rpc('fn_deactivate_code', { p_code_id: codeId });
      if (error) throw error;
      await loadData();
    } catch (error) {
      ThemedAlert.alert('Помилка', error.message);
    }
  };

  // Показати коди підрозділу
  const showUnitCodes = (unitId) => {
    setCodesUnitId(unitId);
    setShowCodesModal(true);
  };

  // Рекурсивний рендер підрозділів
  const renderUnit = (unit) => {
    const isExpanded = expandedUnits.has(unit.id);
    const hasChildren = (unit.children?.length > 0) || (unit.users?.length > 0);

    return (
      <View key={unit.id} style={styles.unitBlock}>
        <UnitHeader
          unit={unit}
          level={unit.level}
          expanded={isExpanded}
          onToggle={() => hasChildren && toggleExpand(unit.id)}
          onEdit={() => {
            setEditUnit(unit);
            setEditUnitName(unit.name);
            setShowEditModal(true);
          }}
          onDelete={() => deleteUnit(unit)}
          onAddChild={() => {
            setNewUnitParent(unit.id);
            setNewUnitType(unit.type === 'brigade' ? 'squadron' : 'linka');
            setShowAddModal(true);
          }}
          onShowCodes={() => showUnitCodes(unit.id)}
          userCount={countUsersInUnit(unit)}
        />

        {isExpanded && (
          <View style={styles.unitChildren}>
            {unit.children?.map(child => renderUnit(child))}

            {unit.users?.length > 0 && (
              <View style={styles.unitUsers}>
                {unit.users.map(user => (
                  <UserItem
                    key={user.id}
                    user={user}
                    onMove={(u) => {
                      setMoveUser(u);
                      setMoveTargetUnit(null);
                      setShowMoveModal(true);
                    }}
                  />
                ))}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  if (auth?.role !== 'admin') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Доступ заборонено</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Підрозділи</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => {
              setNewUnitParent(null);
              setNewUnitType('brigade');
              setShowAddModal(true);
            }}
            style={styles.iconBtn}
          >
            <Ionicons name="folder-add" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowAddUserModal(true)}
            style={styles.iconBtn}
          >
            <Ionicons name="person-add" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <Text style={styles.loadingText}>Завантаження...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {unitTree.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>Немає підрозділів. Натисніть + щоб створити.</Text>
            </View>
          ) : (
            <View style={styles.unitTree}>
              {unitTree.map(unit => renderUnit(unit))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Modal додавання підрозділу */}
      <Modal visible={showAddModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Додати підрозділ</Text>

            <Text style={styles.label}>Тип</Text>
            <View style={styles.typeSelector}>
              {Object.entries(UNIT_TYPES).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.typeBtn, newUnitType === key && styles.typeBtnActive]}
                  onPress={() => setNewUnitType(key)}
                >
                  <Text style={[styles.typeBtnText, newUnitType === key && styles.typeBtnTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Назва</Text>
            <TextInput
              style={styles.input}
              value={newUnitName}
              onChangeText={setNewUnitName}
              placeholder="Назва підрозділу"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSecondary]} onPress={() => setShowAddModal(false)}>
                <Text style={styles.modalBtnText}>Скасувати</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={addUnit}>
                <Text style={styles.modalBtnTextPrimary}>Додати</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal редагування підрозділу */}
      <Modal visible={showEditModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Редагувати підрозділ</Text>

            <Text style={styles.label}>Назва</Text>
            <TextInput
              style={styles.input}
              value={editUnitName}
              onChangeText={setEditUnitName}
              placeholder="Назва підрозділу"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSecondary]} onPress={() => setShowEditModal(false)}>
                <Text style={styles.modalBtnText}>Скасувати</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={saveUnit}>
                <Text style={styles.modalBtnTextPrimary}>Зберегти</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal переміщення користувача */}
      <Modal visible={showMoveModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Перемістити {moveUser?.name}</Text>

            <Text style={styles.label}>До підрозділу</Text>
            <ScrollView style={styles.unitSelectList} showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.unitSelectItem, !moveTargetUnit && styles.unitSelectItemActive]}
                onPress={() => setMoveTargetUnit(null)}
              >
                <Text style={[styles.unitSelectText, !moveTargetUnit && styles.unitSelectTextActive]}>
                  Без підрозділу
                </Text>
              </TouchableOpacity>
              {getFlatUnits().map(u => (
                <TouchableOpacity
                  key={u.id}
                  style={[styles.unitSelectItem, moveTargetUnit === u.id && styles.unitSelectItemActive]}
                  onPress={() => setMoveTargetUnit(u.id)}
                >
                  <Text style={[styles.unitSelectText, moveTargetUnit === u.id && styles.unitSelectTextActive]}>
                    {u.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSecondary]} onPress={() => setShowMoveModal(false)}>
                <Text style={styles.modalBtnText}>Скасувати</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={moveUserToUnit}>
                <Text style={styles.modalBtnTextPrimary}>Перемістити</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal додавання пілота до підрозділу */}
      <Modal visible={showAddUserModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Додати пілота до підрозділу</Text>

            <Text style={styles.label}>Оберіть підрозділ</Text>
            <ScrollView style={styles.unitSelectList} showsVerticalScrollIndicator={false}>
              {getFlatUnits().map(u => (
                <TouchableOpacity
                  key={u.id}
                  style={[styles.unitSelectItem, addUserTargetUnit === u.id && styles.unitSelectItemActive]}
                  onPress={() => setAddUserTargetUnit(u.id)}
                >
                  <Text style={[styles.unitSelectText, addUserTargetUnit === u.id && styles.unitSelectTextActive]}>
                    {u.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {addUserTargetUnit && (
              <>
                <Text style={styles.label}>Оберіть пілота</Text>
                <ScrollView style={styles.unitSelectList} showsVerticalScrollIndicator={false}>
                  {getAvailableUsers().map(u => (
                    <TouchableOpacity
                      key={u.id}
                      style={[styles.unitSelectItem, selectedUserToAdd === u.id && styles.unitSelectItemActive]}
                      onPress={() => setSelectedUserToAdd(u.id)}
                    >
                      <Text style={[styles.unitSelectText, selectedUserToAdd === u.id && styles.unitSelectTextActive]}>
                        {u.name} {u.rank ? `(${u.rank})` : ''} {!u.unit_id && '(без підрозділу)'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {getAvailableUsers().length === 0 && (
                    <Text style={styles.emptyText}>Немає доступних пілотів</Text>
                  )}
                </ScrollView>
              </>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSecondary]} onPress={() => {
                setShowAddUserModal(false);
                setAddUserTargetUnit(null);
                setSelectedUserToAdd(null);
              }}>
                <Text style={styles.modalBtnText}>Скасувати</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary, (!selectedUserToAdd || !addUserTargetUnit) && styles.modalBtnDisabled]}
                onPress={addUserToUnit}
                disabled={!selectedUserToAdd || !addUserTargetUnit}
              >
                <Text style={styles.modalBtnTextPrimary}>Додати</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal кодів запрошень */}
      <Modal visible={showCodesModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.modalTouchable}
            activeOpacity={1}
            onPress={() => setShowCodesModal(false)}
          >
            <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
              <View style={styles.codesHeader}>
                <Text style={styles.modalTitle}>Коди запрошення</Text>
                <TouchableOpacity
                  onPress={() => createInviteCode(codesUnitId)}
                  style={styles.createCodeBtn}
                >
                  <Ionicons name="add-circle" size={20} color={Colors.primary} />
                  <Text style={styles.createCodeBtnText}>Створити код</Text>
                </TouchableOpacity>
              </View>

            <ScrollView style={styles.codesList} showsVerticalScrollIndicator={false}>
              {getUnitCodes(codesUnitId).map(code => (
                <View key={code.id} style={styles.codeItem}>
                  <View style={styles.codeInfo}>
                    <Text style={styles.codeText}>{code.code}</Text>
                    <Text style={styles.codeMeta}>
                      Використано: {code.used_count}/{code.max_uses}
                      {code.expires_at && ` • До: ${new Date(code.expires_at).toLocaleDateString('uk-UA')}`}
                    </Text>
                  </View>
                  <View style={styles.codeActions}>
                    {!code.active && (
                      <Text style={styles.codeInactive}>Деактивовано</Text>
                    )}
                    <TouchableOpacity onPress={() => copyCode(code.code)} style={styles.codeActionBtn}>
                      <Ionicons name="copy-outline" size={18} color={Colors.textSecondary} />
                    </TouchableOpacity>
                    {code.active && (
                      <TouchableOpacity onPress={() => deactivateCode(code.id)} style={styles.codeActionBtn}>
                        <Ionicons name="close-circle" size={18} color={Colors.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
              {getUnitCodes(codesUnitId).length === 0 && (
                <Text style={styles.emptyText}>Немає кодів. Натисніть "Створити код"</Text>
              )}
            </ScrollView>

            <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSecondary]} onPress={() => setShowCodesModal(false)}>
              <Text style={styles.modalBtnText}>Закрити</Text>
            </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgTertiary,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  errorText: {
    fontFamily: FONT,
    fontSize: 16,
    color: Colors.textTertiary,
  },
  loadingText: {
    fontFamily: FONT,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  emptyText: {
    fontFamily: FONT,
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.bgPrimary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '400',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconBtn: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: Spacing.md,
  },
  unitTree: {
    gap: 4,
  },
  unitBlock: {
    overflow: 'hidden',
  },
  unitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    backgroundColor: Colors.bgSecondary,
    borderRadius: BorderRadius.md,
  },
  unitHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unitTypeBadge: {
    backgroundColor: Colors.border,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  unitTypeText: {
    fontFamily: FONT,
    fontSize: 10,
    fontWeight: '400',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
  },
  unitName: {
    flex: 1,
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textPrimary,
  },
  unitCount: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '400',
    color: Colors.textSecondary,
  },
  unitActions: {
    flexDirection: 'row',
    gap: 4,
  },
  unitActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: Colors.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitChildren: {
    gap: 4,
    paddingTop: 4,
  },
  unitUsers: {
    gap: 2,
    paddingVertical: Spacing.sm,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bgPrimary,
    borderRadius: BorderRadius.sm,
    marginLeft: 28,
  },
  userName: {
    flex: 1,
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '400',
    color: Colors.textPrimary,
  },
  userInfo: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '400',
    color: Colors.textSecondary,
  },
  userMoveBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Modal
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalTouchable: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalCard: {
    backgroundColor: Colors.bgPrimary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 400,
    ...Shadows.large,
  },
  modalTitle: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '400',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  label: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '400',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    minHeight: 44,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '400',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.md,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  typeBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeBtnText: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '400',
    color: Colors.textSecondary,
  },
  typeBtnTextActive: {
    color: Colors.textInverse,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnSecondary: {
    backgroundColor: Colors.bgTertiary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalBtnPrimary: {
    backgroundColor: Colors.primary,
  },
  modalBtnDisabled: {
    opacity: 0.5,
  },
  modalBtnText: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '400',
    color: Colors.textPrimary,
  },
  modalBtnTextPrimary: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '400',
    color: Colors.textInverse,
  },
  unitSelectList: {
    maxHeight: 200,
    marginBottom: Spacing.md,
  },
  unitSelectItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgSecondary,
    marginBottom: 4,
  },
  unitSelectItemActive: {
    backgroundColor: Colors.primary,
  },
  unitSelectText: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textPrimary,
  },
  unitSelectTextActive: {
    color: Colors.textInverse,
  },
  // Коди запрошень
  codesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  createCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgSecondary,
  },
  createCodeBtnText: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '400',
    color: Colors.primary,
  },
  codesList: {
    maxHeight: 300,
    marginBottom: Spacing.md,
  },
  codeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.sm,
    backgroundColor: Colors.bgSecondary,
    borderRadius: BorderRadius.md,
    marginBottom: 8,
  },
  codeInfo: {
    flex: 1,
  },
  codeText: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '400',
    color: Colors.textPrimary,
    letterSpacing: 2,
  },
  codeMeta: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '400',
    color: Colors.textTertiary,
    marginTop: 2,
  },
  codeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codeInactive: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '400',
    color: Colors.error,
  },
  codeActionBtn: {
    padding: 6,
  },
});
