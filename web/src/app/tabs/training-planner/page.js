'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { IoChevronBack, IoSparkles, IoAirplane, IoSend, IoSave, IoCheckbox, IoCloseCircle } from 'react-icons/io5';
import { useAuth } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import s from '../../../components/shared.module.css';

const AIRCRAFT_TYPES = ['Су-27', 'МіГ-29', 'Л-39'];
const MU_TYPES = ['ДПМУ', 'ДСМУ', 'ДВМП', 'НПМУ', 'НСМУ', 'НВМП'];
const LP_TYPES = [
  { value: 'групова_злітаність', label: 'Групова злітаність' },
  { value: 'пб_винищувачі', label: 'ПБ з винищувачами' },
  { value: 'пб_ударні', label: 'ПБ з ударними' },
  { value: 'пб_нешвидкісні', label: 'ПБ з нешвидкісними' },
  { value: 'пб_хмари', label: 'ПБ у хмарах' },
  { value: 'пб_надзвукові', label: 'ПБ на надзвукових' },
  { value: 'атаки_пвм', label: 'Атаки НЦ з ПВМ' },
  { value: 'атаки_свм', label: 'Атаки НЦ зі СВМ' },
  { value: 'мала_висота', label: 'Мала висота' },
  { value: 'складний_пілотаж', label: 'Складний пілотаж' },
  { value: 'надзвукові', label: 'Надзвукові' },
  { value: 'гмв', label: 'ГМВ' },
];

export default function TrainingPlannerPage() {
  const { auth } = useAuth();
  const router = useRouter();

  const [aircraft, setAircraft] = useState('Су-27');
  const [selectedMU, setSelectedMU] = useState([]);
  const [selectedLP, setSelectedLP] = useState([]);
  const [loading, setLoading] = useState(false);
  const [planResult, setPlanResult] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [pilots, setPilots] = useState([]);
  const [selectedPilotId, setSelectedPilotId] = useState('');

  useEffect(() => {
    if (auth?.role === 'admin' || auth?.role === 'editor') {
      loadPilots();
    } else if (auth?.userId) {
      setSelectedPilotId(auth.userId);
    }
  }, [auth]);

  const loadPilots = async () => {
    const { data } = await supabase.from('users').select('id, name').order('name');
    setPilots(data || []);
  };

  const toggleMU = (mu) => {
    setSelectedMU(prev => prev.includes(mu) ? prev.filter(m => m !== mu) : [...prev, mu]);
  };

  const toggleLP = (lp) => {
    setSelectedLP(prev => prev.includes(lp) ? prev.filter(l => l !== lp) : [...prev, lp]);
  };

  const generatePlan = async () => {
    if (!selectedPilotId) {
      alert('Оберіть льотчика');
      return;
    }
    if (selectedLP.length === 0) {
      alert('Оберіть хоча б один вид ЛП');
      return;
    }

    setLoading(true);
    setPlanResult(null);

    try {
      const res = await fetch('https://klqxadvtvxvizgdjmegx.supabase.co/functions/v1/training-planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedPilotId,
          aircraft_type: aircraft,
          target_mu: selectedMU,
          target_lp: selectedLP,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setPlanResult(data);
        setChatHistory([]);
      } else {
        alert('Помилка: ' + (data.error || 'Невідома помилка'));
      }
    } catch (err) {
      alert('Помилка з\'єднання: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !planResult) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);

    // Simple echo for now - in production would call a chat endpoint
    setChatHistory(prev => [...prev, {
      role: 'assistant',
      text: `Для уточнень плану зверніться до інструктора або перегенеруйте план з іншими параметрами.`
    }]);
  };

  const savePlan = async () => {
    if (!planResult || !selectedPilotId) return;

    try {
      const { error } = await supabase.from('training_plans').insert({
        user_id: selectedPilotId,
        aircraft_type: aircraft,
        target_mu: selectedMU,
        target_lp: selectedLP,
        plan_json: planResult,
      });

      if (error) throw error;
      alert('План збережено!');
    } catch (err) {
      alert('Помилка збереження: ' + err.message);
    }
  };

  const getStatusColor = (status) => {
    return status === 2 ? '#34a853' : status === 1 ? '#fbbc04' : '#ea4335';
  };

  const getStatusIcon = (status) => {
    return status === 2 ? '✅' : status === 1 ? '⚠️' : '❌';
  };

  if (auth?.role !== 'admin' && auth?.role !== 'editor') {
    return <div className={s.page}><div className={s.emptyText}>Доступ заборонено</div></div>;
  }

  return (
    <div className={s.page} style={{ paddingTop: 20 }}>
      <div className={s.topBar}>
        <button className={s.topBarBack} onClick={() => router.push('/tabs/admin-settings')}>
          <IoChevronBack size={20} />
        </button>
        <span className={s.topBarTitle}>AI Помічник планування</span>
      </div>

      <div style={{ padding: '0 16px' }}>
        {/* Pilot selector for admin/editor */}
        {(auth?.role === 'admin' || auth?.role === 'editor') && (
          <div className={s.mb}>
            <div className={s.label}>Льотчик</div>
            <select
              className={s.select}
              value={selectedPilotId}
              onChange={(e) => setSelectedPilotId(e.target.value)}
            >
              <option value="">Оберіть льотчика</option>
              {pilots.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Aircraft selector */}
        <div className={s.mb}>
          <div className={s.label}>Тип літака</div>
          <select className={s.select} value={aircraft} onChange={(e) => setAircraft(e.target.value)}>
            {AIRCRAFT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* KBP Document - fixed to КБП ВА for now */}
        <div className={s.mb}>
          <div className={s.label}>КБП документ</div>
          <select className={s.select} defaultValue="КБП ВА">
            <option value="КБП ВА">КБП ВА (Су-27, МіГ-29, Л-39)</option>
          </select>
        </div>

        {/* MU selector */}
        <div className={s.mb}>
          <div className={s.label}>Цільові МУ</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {MU_TYPES.map(mu => (
              <button
                key={mu}
                onClick={() => toggleMU(mu)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 16,
                  border: `2px solid ${selectedMU.includes(mu) ? '#4285f4' : '#dadce0'}`,
                  background: selectedMU.includes(mu) ? '#e8f0fe' : '#fff',
                  color: selectedMU.includes(mu) ? '#1a73e8' : '#5f6368',
                  fontWeight: 400,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                {mu}
              </button>
            ))}
          </div>
        </div>

        {/* LP selector */}
        <div className={s.mb}>
          <div className={s.label}>Цільові види ЛП</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {LP_TYPES.map(lp => (
              <button
                key={lp.value}
                onClick={() => toggleLP(lp.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 16,
                  border: `2px solid ${selectedLP.includes(lp.value) ? '#4285f4' : '#dadce0'}`,
                  background: selectedLP.includes(lp.value) ? '#e8f0fe' : '#fff',
                  color: selectedLP.includes(lp.value) ? '#1a73e8' : '#5f6368',
                  fontWeight: 400,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                {lp.label}
              </button>
            ))}
          </div>
        </div>

        {/* Generate button */}
        <button
          className={s.btn}
          style={{ width: '100%', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          onClick={generatePlan}
          disabled={loading || selectedLP.length === 0}
        >
          {loading ? (
            <span>Генерація...</span>
          ) : (
            <>
              <IoSparkles size={18} />
              Згенерувати план
            </>
          )}
        </button>

        {/* Results */}
        {planResult && (
          <>
            {/* Breaks status - unified */}
            {planResult.breaks_status?.length > 0 && (
              <div className={s.mb}>
                <div className={s.label}>Стан перерв</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {planResult.breaks_status.map((b, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: '#f8f9fa',
                        borderLeft: `4px solid ${getStatusColor(b.status)}`,
                        fontSize: 13,
                        minWidth: 180,
                      }}
                    >
                      <div style={{ fontWeight: 400, color: b.type === 'МУ' ? '#1a73e8' : '#5f6368' }}>
                        {b.type === 'МУ' ? '🌤️' : '✈️'} {b.name}
                      </div>
                      <div style={{ color: '#5f6368', fontSize: 12 }}>
                        {getStatusIcon(b.status)} {b.status === 2
                          ? `дійсний до ${b.expires_on}`
                          : b.status === 1
                            ? `завершується ${b.expires_on}`
                            : b.days_expired >= 999
                              ? 'немає даних'
                              : `ВИПАВ ${b.days_expired} дн. тому`
                        }
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stats */}
            <div className={s.mb} style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1, padding: 12, background: '#e8f0fe', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 24, color: '#1a73e8', fontWeight: 400 }}>{planResult.plan?.total_flights || 0}</div>
                <div style={{ fontSize: 12, color: '#5f6368' }}>Польотів</div>
              </div>
              <div style={{ flex: 1, padding: 12, background: '#e6f4ea', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 24, color: '#137333', fontWeight: 400 }}>{planResult.plan?.estimated_shifts || 0}</div>
                <div style={{ fontSize: 12, color: '#5f6368' }}>Льотних змін</div>
              </div>
            </div>

            {/* Flights table */}
            {planResult.plan?.flights?.length > 0 && (
              <div className={s.mb}>
                <div className={s.label}>План відновлення</div>
                <div style={{ border: '1px solid #dadce0', borderRadius: 8, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 400 }}>№</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 400 }}>Вправа</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 400 }}>Тип</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 400 }}>Відновлює</th>
                      </tr>
                    </thead>
                    <tbody>
                      {planResult.plan.flights.map((f, i) => (
                        <tr key={i} style={{ borderTop: '1px solid #dadce0', background: f.is_control ? '#fef7e0' : '#fff' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 400 }}>{f.number}</td>
                          <td style={{ padding: '8px 12px' }}>{f.name}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            {f.is_control ? (
                              <span style={{ color: '#b06000' }}>Контрольний</span>
                            ) : (
                              <span style={{ color: '#137333' }}>Тренувальний</span>
                            )}
                          </td>
                          <td style={{ padding: '8px 12px', color: '#1a73e8', fontSize: 12 }}>
                            {f.restores?.join(', ') || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Complexing opportunities */}
            {planResult.plan?.complexing_opportunities?.length > 0 && (
              <div className={s.mb}>
                <div className={s.label}>Комплексування</div>
                <div style={{ background: '#e8f5e9', borderRadius: 8, padding: 12 }}>
                  {planResult.plan.complexing_opportunities.map((c, i) => (
                    <div key={i} style={{ fontSize: 13, color: '#137333', marginBottom: 4 }}>💡 {c}</div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Recommendations */}
            <div className={s.mb}>
              <div className={s.label}>Рекомендації AI</div>
              <div style={{
                padding: 16,
                background: '#f8f9fa',
                borderRadius: 8,
                whiteSpace: 'pre-wrap',
                fontSize: 14,
                lineHeight: 1.6,
              }}>
                {planResult.recommendations || 'Рекомендації не згенеровано'}
              </div>
            </div>

            {/* Chat for clarifications */}
            <div className={s.mb}>
              <div className={s.label}>Уточнення плану</div>
              <div style={{
                border: '1px solid #dadce0',
                borderRadius: 8,
                maxHeight: 200,
                overflowY: 'auto',
                marginBottom: 8,
                padding: chatHistory.length ? 8 : 0,
                background: '#fff',
              }}>
                {chatHistory.map((msg, i) => (
                  <div
                    key={i}
                    style={{
                      marginBottom: 8,
                      textAlign: msg.role === 'user' ? 'right' : 'left',
                    }}
                  >
                    <span style={{
                      display: 'inline-block',
                      padding: '6px 12px',
                      borderRadius: 12,
                      background: msg.role === 'user' ? '#e8f0fe' : '#f1f3f4',
                      maxWidth: '80%',
                      fontSize: 13,
                    }}>
                      {msg.text}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className={s.input}
                  placeholder="Ваше питання..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                  style={{ flex: 1 }}
                />
                <button className={s.btn} onClick={sendChatMessage} style={{ padding: '8px 12px' }}>
                  <IoSend size={18} />
                </button>
              </div>
            </div>

            {/* Save button */}
            <button
              className={s.btn}
              style={{
                width: '100%',
                background: '#137333',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
              onClick={savePlan}
            >
              <IoSave size={18} />
              Зберегти план
            </button>
          </>
        )}
      </div>
    </div>
  );
}
