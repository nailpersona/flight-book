'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IoChevronBack, IoLockClosedOutline, IoCheckmarkCircleOutline, IoCheckmarkOutline, IoCloseOutline } from 'react-icons/io5';
import { useAuth } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import s from '../../../components/shared.module.css';

const AIRCRAFT_TYPES = {
  'Літаки': ['Л-39', 'Су-27', 'Су-24', 'Міг-29'],
  'Вертольоти': ['Мі-8', 'Мі-24', 'Мі-2'],
};

const SOURCES = ['КБП ВА', 'КЛПВ', 'КБПВ', 'КБП БА/РА'];
const CREW_ROLES = ['Пілот', 'Штурман', 'Бортовий технік'];
const MILITARY_CLASSES = ['1', '2'];
const ALL_AIRCRAFT_TYPES = [...AIRCRAFT_TYPES['Літаки'], ...AIRCRAFT_TYPES['Вертольоти']];

// Parse "HH.MM" string to total minutes
const parseHHMM = (str) => {
  if (!str) return 0;
  const s = String(str);
  if (s.includes('.')) {
    const [h, m] = s.split('.');
    return (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0);
  }
  return (parseInt(s, 10) || 0) * 60;
};

// Format minutes to "HH.MM" string
const formatHHMM = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h + '.' + String(m).padStart(2, '0');
};

export default function SettingsPage() {
  const { auth } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // User info
  const [userInfo, setUserInfo] = useState({ rank: '', position: '', crew_role: '', military_class: '' });

  // Flight hours entries
  const [entries, setEntries] = useState([{ id: 1, type: '', hours: '', showPlus: true }]);

  // Entry settings
  const [selectedAircraftTypes, setSelectedAircraftTypes] = useState([]);
  const [selectedSources, setSelectedSources] = useState([]);

  // Password change
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [currentEntryId, setCurrentEntryId] = useState(null);
  const [showAircraftTypesModal, setShowAircraftTypesModal] = useState(false);
  const [showSourcesModal, setShowSourcesModal] = useState(false);
  const [showCrewRoleModal, setShowCrewRoleModal] = useState(false);
  const [showMilitaryClassModal, setShowMilitaryClassModal] = useState(false);

  // Calculate total hours
  const totalMinutes = entries
    .filter(e => e.type && e.hours)
    .reduce((acc, e) => acc + parseHHMM(e.hours), 0);
  const totalHours = formatHHMM(totalMinutes);

  useEffect(() => {
    loadPilotData();
  }, [auth?.email]);

  const loadPilotData = async () => {
    try {
      setLoading(true);

      // Load rank & position from users table
      const { data: userData } = await supabase
        .from('users')
        .select('rank, position, crew_role, military_class')
        .eq('email', auth?.email)
        .maybeSingle();

      if (userData) {
        setUserInfo({
          rank: userData.rank || '',
          position: userData.position || '',
          crew_role: userData.crew_role || '',
          military_class: userData.military_class ? String(userData.military_class) : '',
        });
      }

      const { data, error } = await supabase
        .from('pilots')
        .select('*')
        .eq('email', auth?.email)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        // Load flight hours by aircraft type
        if (data.flight_hours_by_type) {
          let parsed = data.flight_hours_by_type;
          if (typeof parsed === 'string') parsed = JSON.parse(parsed);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setEntries(parsed.map((item, index) => ({
              id: index + 1,
              type: item.type || '',
              hours: item.hours || '',
              showPlus: index === parsed.length - 1,
            })));
          }
        }

        // Load entry settings
        if (data.entry_settings) {
          let parsed = data.entry_settings;
          if (typeof parsed === 'string') parsed = JSON.parse(parsed);
          if (parsed.aircraft_types) {
            setSelectedAircraftTypes(parsed.aircraft_types);
          }
          if (parsed.sources) {
            setSelectedSources(parsed.sources);
          }
        }
      }
    } catch (error) {
      console.error('Error loading pilot data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addEntry = (aircraftType) => {
    setEntries(prev => {
      const updated = prev.map(entry => {
        if (entry.id === currentEntryId) {
          return { ...entry, type: aircraftType, showPlus: false };
        }
        return entry;
      });

      const newId = Math.max(...prev.map(e => e.id)) + 1;
      return [...updated, { id: newId, type: '', hours: '', showPlus: true }];
    });
    setShowModal(false);
  };

  const removeEntry = (id) => {
    setEntries(prev => {
      const filtered = prev.filter(entry => entry.id !== id);
      if (filtered.length === 0) {
        return [{ id: 1, type: '', hours: '', showPlus: true }];
      }
      return filtered.map((e, i) => ({
        ...e,
        showPlus: i === filtered.length - 1,
      }));
    });
  };

  const updateHours = (id, hours) => {
    setEntries(prev => prev.map(entry => {
      if (entry.id === id) {
        return { ...entry, hours };
      }
      return entry;
    }));
  };

  const openModal = (id) => {
    setCurrentEntryId(id);
    setShowModal(true);
  };

  const toggleAircraftType = (type) => {
    setSelectedAircraftTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const toggleSource = (source) => {
    setSelectedSources(prev =>
      prev.includes(source)
        ? prev.filter(s => s !== source)
        : [...prev, source]
    );
  };

  const selectCrewRole = (role) => {
    setUserInfo(prev => ({ ...prev, crew_role: role }));
    setShowCrewRoleModal(false);
  };

  const selectMilitaryClass = (cls) => {
    setUserInfo(prev => ({ ...prev, military_class: cls }));
    setShowMilitaryClassModal(false);
  };

  const handlePasswordChange = async () => {
    if (!newPassword.trim()) {
      window.alert('Введіть новий пароль');
      return;
    }
    if (newPassword.length < 6) {
      window.alert('Пароль має містити мінімум 6 символів');
      return;
    }
    if (newPassword !== confirmPassword) {
      window.alert('Паролі не співпадають');
      return;
    }
    try {
      setUpdatingPassword(true);
      const { data: result, error: rpcErr } = await supabase.rpc('fn_change_password', {
        p_email: auth.email,
        p_old_password: '',
        p_new_password: newPassword.trim(),
      });
      if (rpcErr) throw new Error(rpcErr.message);
      if (result?.ok) {
        window.alert('Пароль змінено успішно');
        setNewPassword('');
        setConfirmPassword('');
        setShowPasswordChange(false);
      } else {
        window.alert(result?.error || 'Не вдалося змінити пароль');
      }
    } catch (error) {
      window.alert(String(error.message || 'Не вдалося змінити пароль'));
    } finally {
      setUpdatingPassword(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);

      const flightHoursData = entries
        .filter(e => e.type)
        .map(({ type, hours }) => ({ type, hours }));

      const total = Number(totalHours) || 0;

      if (userInfo.crew_role || userInfo.military_class) {
        await supabase
          .from('users')
          .update({
            crew_role: userInfo.crew_role || null,
            military_class: userInfo.military_class ? parseInt(userInfo.military_class, 10) : null,
          })
          .eq('email', auth?.email);
      }

      const { error } = await supabase
        .from('pilots')
        .upsert({
          email: auth?.email,
          pib: auth?.pib,
          total_hours: total,
          flight_hours_by_type: flightHoursData,
          entry_settings: {
            aircraft_types: selectedAircraftTypes,
            sources: selectedSources,
          },
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'email'
        });

      if (error) throw error;

      // Sync aircraft types with user_aircraft table
      // This is needed for the Readiness (Зведена таблиця) page
      if (auth?.userId) {
        // Get all aircraft type IDs
        const { data: aircraftTypesData } = await supabase
          .from('aircraft_types')
          .select('id, name');

        if (aircraftTypesData) {
          // Get current user aircraft
          const { data: currentUserAircraft } = await supabase
            .from('user_aircraft')
            .select('aircraft_type_id')
            .eq('user_id', auth.userId);

          const currentIds = new Set((currentUserAircraft || []).map(ua => ua.aircraft_type_id));

          // Find IDs for selected aircraft types
          const selectedIds = aircraftTypesData
            .filter(at => selectedAircraftTypes.includes(at.name))
            .map(at => at.id);

          // Add new aircraft types
          const toAdd = selectedIds.filter(id => !currentIds.has(id));
          for (const aircraftTypeId of toAdd) {
            await supabase
              .from('user_aircraft')
              .insert({ user_id: auth.userId, aircraft_type_id: aircraftTypeId });
          }

          // Remove aircraft types that are no longer selected (only if user had some selected before)
          if (selectedAircraftTypes.length > 0) {
            const toRemove = [...currentIds].filter(id => !selectedIds.includes(id));
            for (const aircraftTypeId of toRemove) {
              await supabase
                .from('user_aircraft')
                .delete()
                .eq('user_id', auth.userId)
                .eq('aircraft_type_id', aircraftTypeId);
            }
          }
        }
      }

      window.alert('Налаштування збережено');
      router.push('/tabs/profile');
    } catch (error) {
      console.error('Error saving settings:', error);
      window.alert('Не вдалося зберегти налаштування');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={s.page}>
        <div className={s.loadingWrap}>
          <div className={s.spinner} />
          <div className={s.loadingText}>Завантаження...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={s.page} style={{ paddingTop: 0 }}>
      {/* Header */}
      <div className={s.topBar}>
        <button className={s.topBarBack} onClick={() => router.push('/tabs/profile')}>
          <IoChevronBack size={20} />
        </button>
        <span className={s.topBarTitle}>Налаштування</span>
      </div>

      {/* Інформація про пілота */}
      <div className={s.card} style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', marginBottom: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 400, color: '#374151', width: 80 }}>ПІБ:</span>
          <span style={{ fontSize: 16, fontWeight: 400, color: '#111827', flex: 1 }}>{auth?.pib || '-'}</span>
        </div>

        <div style={{ display: 'flex', marginBottom: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 400, color: '#374151', width: 80 }}>Посада:</span>
          <span style={{ fontSize: 16, fontWeight: 400, color: '#111827', flex: 1 }}>{userInfo.position || '-'}</span>
        </div>

        <div
          onClick={() => setShowCrewRoleModal(true)}
          style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', marginBottom: 12 }}
        >
          <span style={{ fontSize: 16, fontWeight: 400, color: '#374151', width: 80 }}>Роль:</span>
          <span style={{ fontSize: 16, fontWeight: 400, color: '#111827', flex: 1 }}>{userInfo.crew_role || 'Не вказано'}</span>
          <span style={{ fontSize: 20, fontWeight: 400, color: '#9CA3AF' }}>›</span>
        </div>

        <div
          onClick={() => setShowMilitaryClassModal(true)}
          style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <span style={{ fontSize: 16, fontWeight: 400, color: '#374151', width: 80 }}>Клас:</span>
          <span style={{ fontSize: 16, fontWeight: 400, color: '#111827', flex: 1 }}>{userInfo.military_class || 'Не вказано'}</span>
          <span style={{ fontSize: 20, fontWeight: 400, color: '#9CA3AF' }}>›</span>
        </div>
      </div>

      {/* Наліт за типами ПС */}
      <div className={s.card} style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 400, color: '#111827', marginBottom: 16 }}>Наліт за типами ПС</div>

        {/* Загальний наліт */}
        <div style={{ display: 'flex', alignItems: 'center', background: '#F9FAFB', borderRadius: 8, padding: '12px 14px', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <span style={{ fontSize: 16, fontWeight: 400, color: '#374151' }}>Загальний наліт:</span>
          <span style={{ fontSize: 20, fontWeight: 400, color: '#10B981', marginLeft: 8 }}>{totalHours}</span>
          <span style={{ fontSize: 14, fontWeight: 400, color: '#6B7280', marginLeft: 4 }}>годин</span>
        </div>

        {/* Entries */}
        {entries.map((entry) => (
          <div key={entry.id} style={{ display: 'flex', alignItems: 'center', marginBottom: 10, gap: 8 }}>
            {entry.type ? (
              <>
                <div style={{ flex: 1, background: '#F3F4F6', borderRadius: 8, padding: '10px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <span style={{ fontSize: 15, fontWeight: 400, color: '#111827' }}>{entry.type}</span>
                </div>
                <input
                  style={{ width: 70, height: 44, borderRadius: 8, border: '1px solid #E5E7EB', padding: '0 8px', fontSize: 15, fontWeight: 400, textAlign: 'center', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                  value={entry.hours}
                  onChange={(e) => updateHours(entry.id, e.target.value)}
                  placeholder="0"
                  type="text"
                />
                {entry.showPlus ? (
                  <button
                    onClick={() => openModal(entry.id)}
                    style={{ width: 36, height: 36, borderRadius: 8, background: '#F3F4F6', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <span style={{ fontSize: 20, fontWeight: 400, color: '#10B981' }}>+</span>
                  </button>
                ) : (
                  <button
                    onClick={() => removeEntry(entry.id)}
                    style={{ width: 36, height: 36, borderRadius: 8, background: '#F3F4F6', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <span style={{ fontSize: 16 }}>🗑</span>
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={() => openModal(entry.id)}
                style={{ flex: 1, background: '#E5E7EB', borderRadius: 8, padding: 12, border: '1px dashed #9CA3AF', cursor: 'pointer', textAlign: 'center' }}
              >
                <span style={{ fontSize: 15, fontWeight: 400, color: '#6B7280' }}>+ Додати тип ПС</span>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Налаштування записів */}
      <div className={s.card} style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 400, color: '#111827', marginBottom: 16 }}>Налаштування записів</div>

        <div onClick={() => setShowAircraftTypesModal(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', cursor: 'pointer' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 400, color: '#111827', marginBottom: 4 }}>Типи ПС для відображення:</div>
            <div style={{ fontSize: 14, fontWeight: 400, color: '#6B7280' }}>
              {selectedAircraftTypes.length > 0 ? selectedAircraftTypes.join(', ') : 'Всі типи'}
            </div>
          </div>
          <span style={{ fontSize: 24, fontWeight: 400, color: '#9CA3AF' }}>›</span>
        </div>

        <div onClick={() => setShowSourcesModal(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', cursor: 'pointer' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 400, color: '#111827', marginBottom: 4 }}>Згідно:</div>
            <div style={{ fontSize: 14, fontWeight: 400, color: '#6B7280' }}>
              {selectedSources.length > 0 ? selectedSources.join(', ') : 'Не вибрано'}
            </div>
          </div>
          <span style={{ fontSize: 24, fontWeight: 400, color: '#9CA3AF' }}>›</span>
        </div>
      </div>

      {/* Зміна пароля */}
      <div className={s.card} style={{ marginBottom: 12 }}>
        {!showPasswordChange ? (
          <button
            onClick={() => setShowPasswordChange(true)}
            style={{ width: '100%', height: 50, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#D9DBDE', border: '1px solid #B0B3B8', cursor: 'pointer', boxShadow: '0 3px 6px rgba(0,0,0,0.12)' }}
          >
            <IoLockClosedOutline size={18} color="#555860" style={{ marginRight: 10 }} />
            <span style={{ fontSize: 16, fontWeight: 400, color: '#555860' }}>Змінити пароль</span>
          </button>
        ) : (
          <div>
            <div style={{ fontSize: 18, fontWeight: 400, color: '#111827', marginBottom: 16 }}>Зміна пароля</div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 400, color: '#374151', marginBottom: 6 }}>Новий пароль</div>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Мінімум 6 символів"
                style={{ width: '100%', height: 44, borderRadius: 8, border: '1px solid #E5E7EB', padding: '0 12px', fontSize: 16, fontWeight: 400, background: '#F9FAFB', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 400, color: '#374151', marginBottom: 6 }}>Підтвердьте пароль</div>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Повторіть пароль"
                style={{ width: '100%', height: 44, borderRadius: 8, border: '1px solid #E5E7EB', padding: '0 12px', fontSize: 16, fontWeight: 400, background: '#F9FAFB', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button
                onClick={() => { setShowPasswordChange(false); setNewPassword(''); setConfirmPassword(''); }}
                disabled={updatingPassword}
                style={{ flex: 1, height: 50, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#D9DBDE', border: '1px solid #B0B3B8', cursor: 'pointer', boxShadow: '0 3px 6px rgba(0,0,0,0.12)' }}
              >
                <span style={{ fontSize: 16, fontWeight: 400, color: '#555860' }}>Скасувати</span>
              </button>
              <button
                onClick={handlePasswordChange}
                disabled={updatingPassword}
                style={{ flex: 1, height: 50, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#D9DBDE', border: '1px solid #B0B3B8', cursor: 'pointer', boxShadow: '0 3px 6px rgba(0,0,0,0.12)' }}
              >
                {updatingPassword ? (
                  <div className={s.spinner} />
                ) : (
                  <>
                    <IoCheckmarkOutline size={18} color="#555860" style={{ marginRight: 8 }} />
                    <span style={{ fontSize: 16, fontWeight: 400, color: '#555860' }}>Змінити</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Кнопка збереження */}
      <div style={{ marginTop: 10, marginBottom: 80 }}>
        <button
          onClick={saveSettings}
          disabled={saving}
          style={{ width: '100%', height: 50, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#D9DBDE', border: '1px solid #B0B3B8', cursor: 'pointer', boxShadow: '0 3px 6px rgba(0,0,0,0.12)' }}
        >
          {saving ? (
            <div className={s.spinner} />
          ) : (
            <>
              <IoCheckmarkCircleOutline size={18} color="#555860" style={{ marginRight: 10 }} />
              <span style={{ fontSize: 16, fontWeight: 400, color: '#555860' }}>Зберегти</span>
            </>
          )}
        </button>
      </div>

      {/* Modal: вибір типу ПС */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 20, width: '90%', maxWidth: 400, maxHeight: '70vh', overflow: 'auto' }}>
            <div style={{ fontSize: 20, fontWeight: 400, color: '#111827', marginBottom: 20, textAlign: 'center' }}>Оберіть тип ПС</div>

            {Object.entries(AIRCRAFT_TYPES).map(([category, types]) => (
              <div key={category} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 400, color: '#6B7280', marginBottom: 8, textTransform: 'uppercase' }}>{category}</div>
                {types.map((type) => (
                  <button
                    key={type}
                    onClick={() => addEntry(type)}
                    style={{ width: '100%', background: '#F3F4F6', borderRadius: 8, padding: '12px 16px', marginBottom: 8, border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <span style={{ fontSize: 16, fontWeight: 400, color: '#111827' }}>{type}</span>
                  </button>
                ))}
              </div>
            ))}

            <button
              onClick={() => setShowModal(false)}
              style={{ width: '100%', padding: 12, border: 'none', background: 'none', cursor: 'pointer' }}
            >
              <span style={{ fontSize: 16, fontWeight: 400, color: '#6B7280' }}>Скасувати</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal: Типи ПС для записів */}
      {showAircraftTypesModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 20, width: '90%', maxWidth: 400, maxHeight: '70vh', overflow: 'auto' }}>
            <div style={{ fontSize: 20, fontWeight: 400, color: '#111827', marginBottom: 20, textAlign: 'center' }}>Типи ПС для відображення</div>

            {Object.entries(AIRCRAFT_TYPES).map(([category, types]) => (
              <div key={category} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 400, color: '#6B7280', marginBottom: 8, textTransform: 'uppercase' }}>{category}</div>
                {types.map((type) => {
                  const isSelected = selectedAircraftTypes.includes(type);
                  return (
                    <button
                      key={type}
                      onClick={() => toggleAircraftType(type)}
                      style={{ width: '100%', background: isSelected ? '#10B981' : '#F3F4F6', borderRadius: 8, padding: '14px 16px', marginBottom: 8, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <span style={{ fontSize: 16, fontWeight: 400, color: isSelected ? '#fff' : '#111827' }}>{type}</span>
                      {isSelected && <span style={{ fontSize: 18, fontWeight: 600, color: '#fff' }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            ))}

            <button
              onClick={() => setShowAircraftTypesModal(false)}
              style={{ width: '100%', padding: 12, border: 'none', background: 'none', cursor: 'pointer' }}
            >
              <span style={{ fontSize: 16, fontWeight: 400, color: '#6B7280' }}>Готово</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal: Згідно */}
      {showSourcesModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 20, width: '90%', maxWidth: 400, maxHeight: '70vh', overflow: 'auto' }}>
            <div style={{ fontSize: 20, fontWeight: 400, color: '#111827', marginBottom: 20, textAlign: 'center' }}>Згідно</div>

            <div style={{ marginBottom: 16 }}>
              {SOURCES.map((source) => {
                const isSelected = selectedSources.includes(source);
                return (
                  <button
                    key={source}
                    onClick={() => toggleSource(source)}
                    style={{ width: '100%', background: isSelected ? '#10B981' : '#F3F4F6', borderRadius: 8, padding: '14px 16px', marginBottom: 8, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <span style={{ fontSize: 16, fontWeight: 400, color: isSelected ? '#fff' : '#111827' }}>{source}</span>
                    {isSelected && <span style={{ fontSize: 18, fontWeight: 600, color: '#fff' }}>✓</span>}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setShowSourcesModal(false)}
              style={{ width: '100%', padding: 12, border: 'none', background: 'none', cursor: 'pointer' }}
            >
              <span style={{ fontSize: 16, fontWeight: 400, color: '#6B7280' }}>Готово</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal: Роль в екіпажі */}
      {showCrewRoleModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 20, width: '90%', maxWidth: 400, maxHeight: '70vh', overflow: 'auto' }}>
            <div style={{ fontSize: 20, fontWeight: 400, color: '#111827', marginBottom: 20, textAlign: 'center' }}>Роль в екіпажі</div>

            <div style={{ marginBottom: 16 }}>
              {CREW_ROLES.map((role) => {
                const isSelected = userInfo.crew_role === role;
                return (
                  <button
                    key={role}
                    onClick={() => selectCrewRole(role)}
                    style={{ width: '100%', background: isSelected ? '#10B981' : '#F3F4F6', borderRadius: 8, padding: '14px 16px', marginBottom: 8, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <span style={{ fontSize: 16, fontWeight: 400, color: isSelected ? '#fff' : '#111827' }}>{role}</span>
                    {isSelected && <span style={{ fontSize: 18, fontWeight: 600, color: '#fff' }}>✓</span>}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setShowCrewRoleModal(false)}
              style={{ width: '100%', padding: 12, border: 'none', background: 'none', cursor: 'pointer' }}
            >
              <span style={{ fontSize: 16, fontWeight: 400, color: '#6B7280' }}>Скасувати</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal: Клас */}
      {showMilitaryClassModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 20, width: '90%', maxWidth: 400, maxHeight: '70vh', overflow: 'auto' }}>
            <div style={{ fontSize: 20, fontWeight: 400, color: '#111827', marginBottom: 20, textAlign: 'center' }}>Клас</div>

            <div style={{ marginBottom: 16 }}>
              {MILITARY_CLASSES.map((cls) => {
                const isSelected = userInfo.military_class === cls;
                return (
                  <button
                    key={cls}
                    onClick={() => selectMilitaryClass(cls)}
                    style={{ width: '100%', background: isSelected ? '#10B981' : '#F3F4F6', borderRadius: 8, padding: '14px 16px', marginBottom: 8, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <span style={{ fontSize: 16, fontWeight: 400, color: isSelected ? '#fff' : '#111827' }}>{cls}</span>
                    {isSelected && <span style={{ fontSize: 18, fontWeight: 600, color: '#fff' }}>✓</span>}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setShowMilitaryClassModal(false)}
              style={{ width: '100%', padding: 12, border: 'none', background: 'none', cursor: 'pointer' }}
            >
              <span style={{ fontSize: 16, fontWeight: 400, color: '#6B7280' }}>Скасувати</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
