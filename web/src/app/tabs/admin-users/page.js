'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IoChevronBack, IoAddOutline, IoCreateOutline, IoTrashOutline } from 'react-icons/io5';
import { useAuth } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import Modal from '../../../components/Modal';
import s from '../../../components/shared.module.css';

export default function AdminUsersPage() {
  const { auth } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPass, setNewPass] = useState('');
  const [editRole, setEditRole] = useState('user');
  const [saving, setSaving] = useState(false);

  if (auth?.role !== 'admin') {
    return <div className={s.page}><div className={s.emptyText}>Доступ заборонено</div></div>;
  }

  const loadUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('users').select('id, name, email, role').order('name');
    console.log('loadUsers data:', data, 'error:', error);
    setUsers(data || []);
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const addUser = async () => {
    if (!newName.trim() || !newEmail.trim() || !newPass.trim()) {
      window.alert('Заповніть усі поля');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc('fn_create_user', {
        p_name: newName.trim(),
        p_email: newEmail.trim(),
        p_password: newPass.trim(),
      });
      if (error) throw error;
      setShowAdd(false);
      setNewName(''); setNewEmail(''); setNewPass('');
      await loadUsers();
    } catch (err) {
      window.alert(String(err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setEditRole(user.role || 'user');
    setShowEdit(true);
  };

  const updateUserRole = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ role: editRole })
        .eq('id', selectedUser.id);
      if (error) throw error;
      setShowEdit(false);
      setSelectedUser(null);
      await loadUsers();
    } catch (err) {
      window.alert(String(err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const openDeleteModal = (user) => {
    setSelectedUser(user);
    setShowDelete(true);
  };

  const deleteUser = async () => {
    if (!selectedUser) return;
    if (selectedUser.id === auth.id) {
      window.alert('Не можна видалити самого себе');
      return;
    }
    setSaving(true);
    try {
      const userId = selectedUser.id;
      console.log('Початок видалення користувача:', userId);

      // Видаляємо в правильному порядку
      let result;

      result = await supabase.from('flight_crew').delete().eq('user_id', userId);
      console.log('flight_crew:', result);

      result = await supabase.from('flight_updates_log').delete().eq('user_id', userId);
      console.log('flight_updates_log:', result);

      result = await supabase.from('ai_pending_questions').delete().eq('user_id', userId);
      console.log('ai_pending_questions:', result);

      result = await supabase.from('ai_lessons').delete().eq('user_id', userId);
      console.log('ai_lessons:', result);

      result = await supabase.from('flights').delete().eq('user_id', userId);
      console.log('flights:', result);

      result = await supabase.from('mu_break_dates').delete().eq('user_id', userId);
      console.log('mu_break_dates:', result);

      result = await supabase.from('lp_break_dates').delete().eq('user_id', userId);
      console.log('lp_break_dates:', result);

      result = await supabase.from('commission_dates').delete().eq('user_id', userId);
      console.log('commission_dates:', result);

      result = await supabase.from('commission_dates_aircraft').delete().eq('user_id', userId);
      console.log('commission_dates_aircraft:', result);

      result = await supabase.from('annual_checks').delete().eq('user_id', userId);
      console.log('annual_checks:', result);

      result = await supabase.from('user_aircraft').delete().eq('user_id', userId);
      console.log('user_aircraft:', result);

      // Скидаємо посилання
      result = await supabase.from('invite_codes').update({ created_by: null }).eq('created_by', userId);
      console.log('invite_codes:', result);

      result = await supabase.from('position_invites').update({ created_by: null }).eq('created_by', userId);
      console.log('position_invites:', result);

      result = await supabase.from('units').update({ commander_id: null }).eq('commander_id', userId);
      console.log('units:', result);

      // Видаляємо користувача
      result = await supabase.from('users').delete().eq('id', userId);
      console.log('users:', result);

      if (result.error) throw result.error;

      console.log('Видалення успішне');
      setShowDelete(false);
      setSelectedUser(null);
      await loadUsers();
    } catch (err) {
      console.error('Помилка видалення:', err);
      window.alert(String(err.message || err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={s.page}>
      <div className={s.topBar}>
        <button className={s.topBarBack} onClick={() => router.push('/tabs/admin-settings')}><IoChevronBack size={20} /></button>
        <span className={s.topBarTitle}>Користувачі</span>
        <button className={s.topBarBack} onClick={() => setShowAdd(true)} style={{ marginLeft: 'auto' }}><IoAddOutline size={20} /></button>
      </div>

      {loading && <div className={s.loadingWrap}><div className={s.spinner} style={{borderTopColor:'#111827',width:24,height:24}}/></div>}

      {!loading && (
        <div className={s.card}>
          <table className={s.table}>
            <thead><tr><th>ПІБ</th><th>Email</th><th>Роль</th><th></th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role || 'user'}</td>
                  <td style={{ width: 80 }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => openEditModal(u)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#6B7280' }}
                        title="Змінити роль"
                      >
                        <IoCreateOutline size={18} />
                      </button>
                      <button
                        onClick={() => openDeleteModal(u)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#EF4444' }}
                        title="Видалити"
                      >
                        <IoTrashOutline size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal visible={showAdd} onClose={() => setShowAdd(false)} title="Додати користувача">
        <div className={s.label}>ПІБ</div>
        <input className={s.input} value={newName} onChange={e => setNewName(e.target.value)} style={{ marginBottom: 12 }} />
        <div className={s.label}>Email</div>
        <input className={s.input} type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} style={{ marginBottom: 12 }} />
        <div className={s.label}>Пароль</div>
        <input className={s.input} type="password" value={newPass} onChange={e => setNewPass(e.target.value)} style={{ marginBottom: 16 }} />
        <div className={s.row}>
          <button className={`${s.btn} ${s.btnSecondary} ${s.col}`} onClick={() => setShowAdd(false)}>Скасувати</button>
          <button className={`${s.btn} ${s.btnPrimary} ${s.col}`} onClick={addUser} disabled={saving}>
            {saving ? <div className={s.spinner} /> : 'Додати'}
          </button>
        </div>
      </Modal>

      <Modal visible={showEdit} onClose={() => setShowEdit(false)} title="Змінити роль">
        <div className={s.label}>Користувач</div>
        <div style={{ marginBottom: 12, fontSize: 15, color: '#111827' }}>{selectedUser?.name}</div>
        <div className={s.label}>Роль</div>
        <select
          className={s.input}
          value={editRole}
          onChange={e => setEditRole(e.target.value)}
          style={{ marginBottom: 16, appearance: 'auto' }}
        >
          <option value="user">Користувач</option>
          <option value="admin">Адміністратор</option>
        </select>
        <div className={s.row}>
          <button className={`${s.btn} ${s.btnSecondary} ${s.col}`} onClick={() => setShowEdit(false)}>Скасувати</button>
          <button className={`${s.btn} ${s.btnPrimary} ${s.col}`} onClick={updateUserRole} disabled={saving}>
            {saving ? <div className={s.spinner} /> : 'Зберегти'}
          </button>
        </div>
      </Modal>

      <Modal visible={showDelete} onClose={() => setShowDelete(false)} title="Видалити користувача">
        <div style={{ marginBottom: 16, fontSize: 15, color: '#111827' }}>
          Ви впевнені, що хочете видалити користувача <strong>{selectedUser?.name}</strong>?
        </div>
        <div style={{ marginBottom: 16, fontSize: 13, color: '#EF4444' }}>
          Це також видалить всі пов'язані дані: дати перерв, комісування, перевірки та записи польотів.
        </div>
        <div className={s.row}>
          <button className={`${s.btn} ${s.btnSecondary} ${s.col}`} onClick={() => setShowDelete(false)}>Скасувати</button>
          <button
            className={`${s.btn} ${s.col}`}
            style={{ background: '#EF4444', color: '#FFFFFF' }}
            onClick={deleteUser}
            disabled={saving}
          >
            {saving ? <div className={s.spinner} style={{ borderTopColor: '#FFFFFF' }} /> : 'Видалити'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
