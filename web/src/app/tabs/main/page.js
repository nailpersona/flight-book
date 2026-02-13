'use client';
import { useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IoAirplaneOutline, IoBookOutline, IoStatsChartOutline, IoCalendarOutline, IoCheckmarkCircleOutline, IoAddCircleOutline } from 'react-icons/io5';
import { useAuth } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import Section from '../../../components/Section';
import Combo from '../../../components/Combo';
import ExercisePicker from '../../../components/ExercisePicker';
import CustomCalendar from '../../../components/CustomCalendar';
import Modal from '../../../components/Modal';
import s from '../../../components/shared.module.css';

function ddmmyyyy(d) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

function toHhMmSs(input) {
  if (input == null) return '00:00:00';
  const sRaw = String(input).trim();
  if (!sRaw) return '00:00:00';
  const mClock = sRaw.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (mClock) {
    let hh = +mClock[1], mm = +mClock[2], ss = +(mClock[3] || 0);
    hh += Math.floor(mm / 60); mm = mm % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }
  const sv = sRaw.replace(',', '.');
  const mHM = sv.match(/^(\d+)\.(\d{1,2})$/);
  if (mHM) {
    let hh = +mHM[1], mm = +mHM[2];
    hh += Math.floor(mm / 60); mm = mm % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
  }
  if (/^\d+$/.test(sv)) return `${String(+sv).padStart(2, '0')}:00:00`;
  return '00:00:00';
}

function FuelPopup({ fuel, onSave }) {
  const [open, setOpen] = useState(false);
  const [airfield, setAirfield] = useState(fuel?.airfield || '');
  const [amount, setAmount] = useState(fuel?.amount || '');

  return (
    <div className={s.mb}>
      <div className={s.label}>Паливо</div>
      <div className={s.select} onClick={() => setOpen(true)}>
        <span className={fuel?.airfield ? s.selectText : `${s.selectText} ${s.selectPlaceholder}`}>
          {fuel?.airfield ? `${fuel.airfield} — ${fuel.amount} кг` : 'кг'}
        </span>
      </div>
      <Modal visible={open} onClose={() => setOpen(false)} title="Паливо">
        <div className={s.label}>Аеродром</div>
        <input className={s.input} placeholder="Назва аеродрому" value={airfield} onChange={e => setAirfield(e.target.value)} style={{marginBottom:12}} />
        <div className={s.label}>Кількість (кг)</div>
        <input className={s.input} placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} type="number" style={{marginBottom:12}} />
        <div className={s.row}>
          <button className={`${s.btn} ${s.btnSecondary} ${s.col}`} onClick={() => setOpen(false)}>Скасувати</button>
          <button className={`${s.btn} ${s.btnDark} ${s.col}`} onClick={() => { onSave({airfield:airfield.trim(),amount:amount.trim()}); setOpen(false); }}>Зберегти</button>
        </div>
      </Modal>
    </div>
  );
}

function FlightFeedbackModal({ visible, data, onClose }) {
  const [correcting, setCorrecting] = useState(false);
  const [checkedLp, setCheckedLp] = useState({});
  const [saving, setSaving] = useState(false);
  const [allLpTypes, setAllLpTypes] = useState([]);

  useEffect(() => {
    if (visible && data) {
      const init = {};
      (data.detectedLp || []).forEach(lp => { init[lp] = true; });
      setCheckedLp(init);
      setCorrecting(false);
      (async () => {
        const { data: types } = await supabase.from('break_periods_lp').select('lp_type').order('lp_type');
        if (types) setAllLpTypes([...new Set(types.map(t => t.lp_type))]);
      })();
    }
  }, [visible, data]);

  const handleConfirm = async () => {
    if (data?.logId) {
      await supabase.from('flight_updates_log').update({ confirmed: true }).eq('id', data.logId);
    }
    onClose();
  };

  const handleCorrection = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const correctedLp = Object.entries(checkedLp).filter(([,v]) => v).map(([k]) => k);
      if (data.logId) {
        await supabase.from('flight_updates_log').update({ confirmed: false, corrected_lp: correctedLp }).eq('id', data.logId);
      }
      const detectedStr = (data.detectedLp || []).join(', ') || 'нічого';
      const correctedStr = correctedLp.join(', ') || 'нічого';
      await supabase.from('ai_lessons').insert({
        lesson_text: `Автовизначення видів ЛП було: [${detectedStr}]. Льотчик виправив на: [${correctedStr}].`,
        context: JSON.stringify({ flight_id: data.flightId, detected_lp: data.detectedLp, corrected_lp: correctedLp, detected_mu: data.detectedMu, exercise_ids: data.exerciseIds || [] }),
        source: 'pilot_feedback', user_id: data.userId,
      });
      for (const lp of correctedLp.filter(lp => !(data.detectedLp || []).includes(lp))) {
        const flightDate = new Date().toISOString().split('T')[0];
        await supabase.from('lp_break_dates').upsert({ user_id: data.userId, lp_type: lp, last_date: flightDate }, { onConflict: 'user_id,lp_type' });
      }
      onClose();
    } catch (err) {
      window.alert(String(err.message || err));
    } finally { setSaving(false); }
  };

  if (!data) return null;
  const muList = data.detectedMu || [];
  const lpList = data.detectedLp || [];

  return (
    <Modal visible={visible} onClose={onClose}>
      {!correcting ? (
        <>
          <div className={s.feedbackCenter}>
            <IoCheckmarkCircleOutline size={40} color="#111827" />
            <div className={s.label} style={{marginTop:8,fontSize:16}}>Запис додано</div>
          </div>
          <div className={s.feedbackLabel}>Ви подовжили перерви:</div>
          {muList.length > 0 && <div className={s.feedbackSection}><div className={s.feedbackSectionTitle}>МУ:</div><div className={s.feedbackItems}>{muList.join(', ')}</div></div>}
          {lpList.length > 0 && <div className={s.feedbackSection}><div className={s.feedbackSectionTitle}>Види ЛП:</div>{lpList.map((lp,i)=><div key={i} className={s.feedbackItem}>{lp}</div>)}</div>}
          {lpList.length === 0 && muList.length > 0 && <div className={s.feedbackNote}>Види ЛП не визначено (немає вправ)</div>}
          <div className={s.feedbackLabel} style={{marginTop:12}}>Вірно?</div>
          <div className={s.row} style={{marginTop:12}}>
            <button className={`${s.btn} ${s.btnOutline} ${s.col}`} onClick={()=>setCorrecting(true)}>Ні</button>
            <button className={`${s.btn} ${s.btnPrimary} ${s.col}`} onClick={handleConfirm}>Так</button>
          </div>
        </>
      ) : (
        <>
          <div style={{fontSize:16,fontWeight:400,marginBottom:8}}>Виправте види ЛП</div>
          <div className={s.feedbackNote}>Виправте, будь ласка, ці дані вручну.</div>
          <div style={{maxHeight:300,overflowY:'auto',margin:'12px 0'}}>
            {allLpTypes.map((lp,i) => (
              <div key={i} className={s.checkRow} onClick={()=>setCheckedLp(p=>({...p,[lp]:!p[lp]}))}>
                <input type="checkbox" checked={!!checkedLp[lp]} readOnly style={{accentColor:'#111827'}} />
                <span className={s.checkLabel}>{lp}</span>
              </div>
            ))}
          </div>
          <div className={s.row}>
            <button className={`${s.btn} ${s.btnOutline} ${s.col}`} onClick={()=>setCorrecting(false)}>Назад</button>
            <button className={`${s.btn} ${s.btnPrimary} ${s.col}`} onClick={handleCorrection} disabled={saving}>
              {saving ? <div className={s.spinner}/> : 'Зберегти'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

export default function MainPage() {
  const { auth } = useAuth();
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [allExercises, setAllExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settingsAircraftTypes, setSettingsAircraftTypes] = useState([]);
  const [settingsSources, setSettingsSources] = useState([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackData, setFeedbackData] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editFlightId, setEditFlightId] = useState(null);

  const [dateObj, setDateObj] = useState(new Date());
  const [date, setDate] = useState(ddmmyyyy(new Date()));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [typePs, setTypePs] = useState('');
  const [timeDayMu, setTimeDayMu] = useState('');
  const [flightType, setFlightType] = useState('');
  const [testTopic, setTestTopic] = useState('');
  const [docSource, setDocSource] = useState('');
  const [selectedExercises, setSelectedExercises] = useState([]);
  const [nalit, setNalit] = useState('');
  const [combatApps, setCombatApps] = useState('');
  const [fuel, setFuel] = useState({ airfield: '', amount: '' });
  const [flightPurpose, setFlightPurpose] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase.from('exercises').select('id, number, name, document, task, category, flights_count').order('id');
        if (error) throw error;
        setAllExercises(data || []);
        if (auth?.email) {
          const { data: pilot } = await supabase.from('pilots').select('entry_settings').eq('email', auth.email).maybeSingle();
          if (pilot?.entry_settings) {
            const parsed = typeof pilot.entry_settings === 'string' ? JSON.parse(pilot.entry_settings) : pilot.entry_settings;
            if (parsed.aircraft_types?.length) setSettingsAircraftTypes(parsed.aircraft_types);
            if (parsed.sources?.length) setSettingsSources(parsed.sources);
          }
        }
      } catch (err) { console.warn(err); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  useEffect(() => {
    if (loading || allExercises.length === 0) return;
    const raw = localStorage.getItem('edit_flight');
    if (!raw) return;
    localStorage.removeItem('edit_flight');
    try {
      const { id, data } = JSON.parse(raw);
      setEditMode(true);
      setEditFlightId(id);
      if (data.date) {
        const d = new Date(data.date);
        if (!isNaN(d.getTime())) { setDateObj(d); setDate(ddmmyyyy(d)); }
      }
      if (data.aircraft_types?.name) setTypePs(data.aircraft_types.name);
      const mu = (data.time_of_day || '') + (data.weather_conditions || '');
      if (mu) setTimeDayMu(mu);
      let ft = data.flight_type || '';
      if (ft === 'Учбово-тренув.') ft = 'Учбово-тренувальний';
      if (ft) setFlightType(ft);
      if (data.test_flight_topic) setTestTopic(data.test_flight_topic);
      if (data.document_source) setDocSource(data.document_source);
      if (data.flight_time) {
        const t = String(data.flight_time).trim();
        const m = t.match(/^(\d{1,2}):(\d{2})/);
        if (m) setNalit(`${+m[1]}.${m[2]}`);
      }
      if (data.combat_applications) setCombatApps(String(data.combat_applications));
      if (data.fuel_records?.[0]) {
        const fr = data.fuel_records[0];
        setFuel({ airfield: fr.airfield || '', amount: fr.fuel_amount ? String(fr.fuel_amount) : '' });
      }
      if (data.flight_purpose) setFlightPurpose(data.flight_purpose);
      (async () => {
        const { data: feData } = await supabase.from('flight_exercises').select('exercise_id').eq('flight_id', id);
        if (feData?.length) {
          const exIds = feData.map(fe => fe.exercise_id);
          const matched = allExercises.filter(e => exIds.includes(e.id));
          setSelectedExercises(matched);
        }
      })();
    } catch (e) { console.warn('edit parse error', e); }
  }, [loading, allExercises]);

  const filteredExercises = useMemo(() => {
    if (!docSource) return allExercises;
    return allExercises.filter(e => e.document === docSource);
  }, [allExercises, docSource]);

  useEffect(() => { setSelectedExercises([]); }, [docSource]);

  const exercisesText = useMemo(() => {
    return selectedExercises.map(e => {
      const label = e.flight_number ? `${e.number}(${e.flight_number})` : e.number;
      return `Впр. ${label} ${e.name}`;
    }).join(', ');
  }, [selectedExercises]);

  useEffect(() => { if (exercisesText) setFlightPurpose(exercisesText); }, [exercisesText]);

  const onSelectDate = (selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) { setDateObj(selectedDate); setDate(ddmmyyyy(selectedDate)); }
  };

  const resetForm = () => {
    const now = new Date();
    setDateObj(now); setDate(ddmmyyyy(now));
    setTypePs(''); setTimeDayMu(''); setFlightType(''); setTestTopic('');
    setDocSource(''); setSelectedExercises([]); setNalit(''); setCombatApps('');
    setFuel({ airfield: '', amount: '' }); setFlightPurpose('');
    setEditMode(false); setEditFlightId(null);
  };

  const submit = async () => {
    if (!date) return window.alert('Вкажи дату');
    if (!typePs) return window.alert('Вкажи тип ПС');
    if (!timeDayMu) return window.alert('Вкажи час доби та МУ');
    if (!flightType) return window.alert('Вкажи вид польоту');

    try {
      setSubmitting(true);
      const time_of_day = timeDayMu[0];
      const weather_conditions = timeDayMu.substring(1);
      const { data: userData, error: userErr } = await supabase.from('users').select('id').eq('name', auth.pib).single();
      if (userErr || !userData) throw new Error('Користувача не знайдено');
      const { data: atData, error: atErr } = await supabase.from('aircraft_types').select('id').eq('name', typePs).single();
      if (atErr || !atData) throw new Error('Тип ПС не знайдено');

      let dbFlightType = flightType;
      if (flightType === 'Учбово-тренувальний') dbFlightType = 'Учбово-тренув.';

      const flightPayload = {
        user_id: userData.id, date: dateObj.toISOString().split('T')[0], aircraft_type_id: atData.id,
        time_of_day, weather_conditions, flight_type: dbFlightType,
        test_flight_topic: flightType === 'На випробування' ? testTopic : null,
        document_source: docSource || null, flight_time: toHhMmSs(nalit),
        combat_applications: parseInt(combatApps) || 0, flight_purpose: flightPurpose || null, flights_count: 1,
      };

      if (editMode && editFlightId) {
        const { error: updErr } = await supabase.from('flights').update(flightPayload).eq('id', editFlightId);
        if (updErr) throw updErr;

        await supabase.from('flight_exercises').delete().eq('flight_id', editFlightId);
        if (selectedExercises.length > 0) {
          await supabase.from('flight_exercises').insert(selectedExercises.map(ex => ({ flight_id: editFlightId, exercise_id: ex.id })));
        }
        await supabase.from('fuel_records').delete().eq('flight_id', editFlightId);
        if (fuel.airfield && fuel.amount) {
          await supabase.from('fuel_records').insert({ flight_id: editFlightId, airfield: fuel.airfield, fuel_amount: parseFloat(fuel.amount) || 0 });
        }

        window.alert('Запис оновлено');
        resetForm();
        router.push('/tabs/my-records');
      } else {
        const { data: flight, error: flightErr } = await supabase.from('flights').insert(flightPayload).select().single();
        if (flightErr) throw flightErr;

        if (selectedExercises.length > 0) {
          await supabase.from('flight_exercises').insert(selectedExercises.map(ex => ({ flight_id: flight.id, exercise_id: ex.id })));
        }
        if (fuel.airfield && fuel.amount) {
          await supabase.from('fuel_records').insert({ flight_id: flight.id, airfield: fuel.airfield, fuel_amount: parseFloat(fuel.amount) || 0 });
        }

        await new Promise(r => setTimeout(r, 300));
        const { data: log } = await supabase.from('flight_updates_log').select('*').eq('flight_id', flight.id).maybeSingle();
        const detectedMu = log?.detected_mu || [];
        const detectedLp = log?.detected_lp || [];

        if (detectedMu.length > 0 || detectedLp.length > 0) {
          setFeedbackData({ flightId: flight.id, userId: userData.id, detectedMu, detectedLp, logId: log?.id, exerciseIds: selectedExercises.map(e => e.id) });
          setShowFeedback(true);
        } else {
          window.alert('Запис додано');
        }
        resetForm();
      }
    } catch (err) {
      window.alert(String(err.message || err));
    } finally { setSubmitting(false); }
  };

  if (loading) {
    return <div className={s.page}><div className={s.loadingWrap}><div className={s.spinner} style={{borderTopColor:'#111827',width:30,height:30}}/><div className={s.loadingText}>Завантаження...</div></div></div>;
  }

  return (
    <div className={s.page}>
      <Section icon={IoAirplaneOutline} title="Основне">
        <div className={s.row}>
          <div className={s.col}>
            <div className={s.label}>Дата</div>
            <div className={s.dateBtn} onClick={() => setShowDatePicker(true)}>
              <span className={s.dateIcon}><IoCalendarOutline size={16} /></span>
              <span className={s.dateText}>{date || 'Оберіть дату'}</span>
            </div>
            <CustomCalendar visible={showDatePicker} value={dateObj} onSelect={onSelectDate} onClose={() => setShowDatePicker(false)} />
          </div>
          <div className={s.col}>
            <Combo label="Тип ПС" value={typePs} onChange={setTypePs} placeholder=" " options={settingsAircraftTypes.length > 0 ? settingsAircraftTypes : ['МіГ-29', 'Су-27', 'Л-39']} />
          </div>
        </div>
        <div className={s.row}>
          <div className={s.col}>
            <Combo label="Час доби та МУ" value={timeDayMu} onChange={setTimeDayMu} placeholder=" " options={['ДПМУ', 'ДСМУ', 'ДВМП', 'НПМУ', 'НСМУ', 'НВМП']} />
          </div>
          <div className={s.col}>
            <Combo label="Вид польоту" value={flightType} onChange={setFlightType} placeholder=" " options={['Учбово-тренувальний', 'На випробування', 'У складі екіпажу', 'За інструктора', 'За методиками ЛВ']} />
          </div>
        </div>
        {flightType === 'На випробування' && (
          <div className={s.mb}>
            <div className={s.label}>Тема випробувального польоту</div>
            <input className={s.input} value={testTopic} onChange={e => setTestTopic(e.target.value)} />
          </div>
        )}
      </Section>

      {flightType !== 'У складі екіпажу' && (
        <Section icon={IoBookOutline} title="Завдання">
          <div className={s.row}>
            <div className={s.col}>
              <Combo label="Згідно чого" value={docSource} onChange={setDocSource} placeholder=" " options={settingsSources.length > 0 ? settingsSources : ['КБП ВА', 'КЛПВ', 'КБПВ', 'КБП БА/РА']} />
            </div>
            <div className={s.col}>
              <ExercisePicker exercises={filteredExercises} selectedExercises={selectedExercises} onAdd={ex => setSelectedExercises(prev => [...prev, ex])} onRemove={(id, fn) => setSelectedExercises(prev => prev.filter(e => !(e.id === id && e.flight_number === fn)))} />
            </div>
          </div>
          <div className={s.mb}>
            <div className={s.label}>Мета польоту</div>
            <textarea className={`${s.input} ${s.textarea}`} value={flightPurpose} onChange={e => setFlightPurpose(e.target.value)} />
          </div>
        </Section>
      )}

      <Section icon={IoStatsChartOutline} title="Результати">
        {flightType === 'У складі екіпажу' ? (
          <div style={{display:'flex',justifyContent:'center'}}>
            <div style={{width:'50%'}}>
              <div className={s.label} style={{textAlign:'center'}}>Наліт</div>
              <input className={s.input} placeholder="1.30" value={nalit} onChange={e => setNalit(e.target.value)} style={{textAlign:'center'}} />
            </div>
          </div>
        ) : (
          <div className={s.row}>
            <div className={s.col}>
              <div className={s.label}>Наліт</div>
              <input className={s.input} placeholder="1.30" value={nalit} onChange={e => setNalit(e.target.value)} />
            </div>
            <div className={s.col}>
              <div className={s.label}>Бой. заст.</div>
              <input className={s.input} placeholder="0" value={combatApps} onChange={e => setCombatApps(e.target.value)} type="number" />
            </div>
            <div className={s.col}>
              <FuelPopup fuel={fuel} onSave={setFuel} />
            </div>
          </div>
        )}
      </Section>

      <div style={{display:'flex',justifyContent:'center',gap:8}}>
        {editMode && (
          <button className={`${s.btn} ${s.btnSecondary}`} onClick={() => { resetForm(); }} style={{width:'30%'}}>
            Скасувати
          </button>
        )}
        <button className={`${s.btn} ${s.btnPrimary}`} onClick={submit} disabled={submitting} style={{width: editMode ? '30%' : '60%', display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          {submitting ? <div className={s.spinner}/> : (
            <>
              <IoAddCircleOutline size={18} />
              <span>{editMode ? 'Зберегти' : 'Додати запис'}</span>
            </>
          )}
        </button>
      </div>

      <FlightFeedbackModal visible={showFeedback} data={feedbackData} onClose={() => { setShowFeedback(false); setFeedbackData(null); }} />
    </div>
  );
}
