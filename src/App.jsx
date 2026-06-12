import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'

export default function App() {
  const [user, setUser] = useState(null)
  const [view, setView] = useState('login')
  const [employees, setEmployees] = useState([])
  const [shifts, setShifts] = useState([])
  const [locations, setLocations] = useState([])
  const [activeShift, setActiveShift] = useState(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [loginData, setLoginData] = useState({ username: '', password: '' })
  const [newEmp, setNewEmp] = useState({ username: '', password: '', full_name: '' })

  useEffect(() => {
    const saved = localStorage.getItem('wt_user')
    if (saved) {
      const u = JSON.parse(saved)
      setUser(u)
      const v = u.role === 'admin' ? 'admin' : 'employee'
      setView(v)
      loadData(u, v)
    }
  }, [])

  async function login() {
    if (!loginData.username || !loginData.password) { setMsg('Введите логин и пароль'); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', loginData.username)
      .eq('password_hash', loginData.password)
      .eq('is_active', true)
      .single()
    setLoading(false)
    if (error || !data) { setMsg('Неверный логин или пароль'); return }
    setUser(data)
    localStorage.setItem('wt_user', JSON.stringify(data))
    const v = data.role === 'admin' ? 'admin' : 'employee'
    setView(v)
    loadData(data, v)
  }

  function logout() {
    localStorage.removeItem('wt_user')
    setUser(null)
    setView('login')
    setLoginData({ username: '', password: '' })
  }

  async function loadData(u, v) {
    if (v === 'admin') {
      const { data: emps } = await supabase.from('users').select('*').order('full_name')
      setEmployees(emps || [])
    }
    const { data: locs } = await supabase.from('locations').select('*').eq('is_active', true)
    setLocations(locs || [])
    let q = supabase.from('shifts').select('*').order('start_time', { ascending: false }).limit(100)
    if (u.role !== 'admin') q = q.eq('user_id', u.id)
    const { data: sh } = await q
    setShifts(sh || [])
    const open = (sh || []).find(s => !s.end_time)
    setActiveShift(open || null)
  }

  function getLocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null)
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 8000, enableHighAccuracy: true }
      )
    })
  }

  async function startShift() {
    setMsg('')
    const loc = await getLocation()
    const { data, error } = await supabase
      .from('shifts')
      .insert({
        user_id: user.id,
        location_id: locations[0]?.id || null,
        start_time: new Date().toISOString(),
        start_lat: loc?.lat,
        start_lng: loc?.lng,
        start_method: loc ? 'geo' : 'manual'
      })
      .select()
      .single()
    if (error) { setMsg('Ошибка: ' + error.message); return }
    setActiveShift(data)
    setShifts([data, ...shifts])
    setMsg('Смена начата ✓ ' + new Date().toLocaleTimeString('ru'))
  }

  async function endShift() {
    if (!activeShift) return
    const loc = await getLocation()
    const { data, error } = await supabase
      .from('shifts')
      .update({
        end_time: new Date().toISOString(),
        end_lat: loc?.lat,
        end_lng: loc?.lng,
        end_method: loc ? 'geo' : 'manual'
      })
      .eq('id', activeShift.id)
      .select()
      .single()
    if (error) { setMsg('Ошибка: ' + error.message); return }
    setShifts([data, ...shifts.filter(s => s.id !== activeShift.id)])
    setActiveShift(null)
    setMsg('Смена завершена ✓')
  }

  async function addEmployee() {
    if (!newEmp.username || !newEmp.password || !newEmp.full_name) { setMsg('Заполните все поля'); return }
    const { data, error } = await supabase
      .from('users')
      .insert({ username: newEmp.username, password_hash: newEmp.password, full_name: newEmp.full_name, role: 'employee' })
      .select()
      .single()
    if (error) { setMsg('Ошибка: ' + error.message); return }
    setEmployees([...employees, data])
    setNewEmp({ username: '', password: '', full_name: '' })
    setMsg('Сотрудник добавлен ✓')
  }

  async function toggleEmployee(emp) {
    const { data } = await supabase
      .from('users')
      .update({ is_active: !emp.is_active })
      .eq('id', emp.id)
      .select()
      .single()
    if (data) setEmployees(employees.map(e => e.id === emp.id ? data : e))
  }

  if (view === 'login') {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <h1>🕐 Учёт времени</h1>
          <p>Вход в систему</p>
          <input placeholder="Логин" value={loginData.username} onChange={e => setLoginData({...loginData, username: e.target.value})} />
          <input type="password" placeholder="Пароль" value={loginData.password} onChange={e => setLoginData({...loginData, password: e.target.value})} />
          <button onClick={login} disabled={loading}>{loading ? 'Вход...' : 'Войти'}</button>
          {msg && <div className="msg">{msg}</div>}
        </div>
      </div>
    )
  }

  if (view === 'employee') {
    return (
      <div className="app">
        <header>
          <h2>👷 {user.full_name}</h2>
          <button onClick={logout} className="btn-ghost">Выйти</button>
        </header>
        <div className="shift-card">
          {activeShift ? (
            <>
              <div className="shift-active">⏰ Смена идёт</div>
              <div>Начало: {new Date(activeShift.start_time).toLocaleTimeString('ru')}</div>
              <button className="btn-red" onClick={endShift}>Завершить смену</button>
            </>
          ) : (
            <>
              <div className="shift-idle">💤 Смена не начата</div>
              <button className="btn-green" onClick={startShift}>Начать смену</button>
            </>
          )}
          {msg && <div className="msg">{msg}</div>}
        </div>
        <h3>Мои смены</h3>
        <div className="shift-list">
          {shifts.filter(s => s.end_time).map(s => (
            <div key={s.id} className="shift-row">
              <div>{new Date(s.start_time).toLocaleDateString('ru')}</div>
              <div className="muted">{new Date(s.start_time).toLocaleTimeString('ru', {hour:'2-digit', minute:'2-digit'})} — {new Date(s.end_time).toLocaleTimeString('ru', {hour:'2-digit', minute:'2-digit'})}</div>
              <div><b>{((new Date(s.end_time) - new Date(s.start_time)) / 3600000).toFixed(1)}ч</b></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // admin
  return (
    <div className="app">
      <header>
        <h2>👑 {user.full_name}</h2>
        <button onClick={logout} className="btn-ghost">Выйти</button>
      </header>
      <div className="tabs">
        <button className={view==='admin'?'active':''} onClick={()=>setView('admin')}>Сотрудники</button>
        <button className={view==='admin-locs'?'active':''} onClick={()=>setView('admin-locs')}>Локации</button>
        <button className={view==='admin-reports'?'active':''} onClick={()=>setView('admin-reports')}>Отчёты</button>
      </div>
      {view === 'admin' && (
        <>
          <h3>Сотрудники ({employees.length})</h3>
          <div className="emp-list">
            {employees.map(e => (
              <div key={e.id} className="emp-row">
                <div>
                  <b>{e.full_name}</b> <span className="muted">@{e.username}</span>
                  {e.role === 'admin' && <span className="badge">ADMIN</span>}
                </div>
                {e.role !== 'admin' && (
                  <button onClick={() => toggleEmployee(e)} className={e.is_active ? 'btn-ghost' : 'btn-green'}>
                    {e.is_active ? 'Отключить' : 'Включить'}
                  </button>
                )}
              </div>
            ))}
          </div>
          <h3>Добавить сотрудника</h3>
          <div className="form">
            <input placeholder="ФИО" value={newEmp.full_name} onChange={e => setNewEmp({...newEmp, full_name: e.target.value})} />
            <input placeholder="Логин" value={newEmp.username} onChange={e => setNewEmp({...newEmp, username: e.target.value})} />
            <input type="password" placeholder="Пароль" value={newEmp.password} onChange={e => setNewEmp({...newEmp, password: e.target.value})} />
            <button onClick={addEmployee}>Добавить сотрудника</button>
          </div>
        </>
      )}
      {view === 'admin-locs' && (
        <>
          <h3>Локации ({locations.length})</h3>
          {locations.length === 0 && <p className="muted">Нет локаций. Добавьте через Supabase.</p>}
          {locations.map(l => (
            <div key={l.id} className="emp-row">
              <div><b>{l.name}</b><br/><span className="muted">{l.address || '—'}</span></div>
            </div>
          ))}
        </>
      )}
      {view === 'admin-reports' && (
        <>
          <h3>Все смены</h3>
          <div className="shift-list">
            {shifts.map(s => {
              const emp = employees.find(e => e.id === s.user_id)
              return (
                <div key={s.id} className="shift-row">
                  <div><b>{emp?.full_name || '—'}</b></div>
                  <div className="muted">{new Date(s.start_time).toLocaleDateString('ru')}</div>
                  <div>{s.end_time ? ((new Date(s.end_time) - new Date(s.start_time)) / 3600000).toFixed(1) + 'ч' : '⏰'}</div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
