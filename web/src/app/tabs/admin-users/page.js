'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IoChevronBack, IoAddOutline } from 'react-icons/io5';
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
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPass, setNewPass] = useState('');
  const [saving, setSaving] = useState(false);

  if (auth?.role !== 'admin') {
    return <div className={s.page}><div className={s.emptyText}>Доступ заборонено</div></div>;
  }

  const loadUsers = async () => {
    setLoading(true);
    const { data } = await supabase.from('users').select('id, name, email, role').order('name');
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
            <thead><tr><th>ПІБ</th><th>Email</th><th>Роль</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role || 'user'}</td>
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
    </div>
  );
}
