// Login y registro.
import { useState } from 'react';

export default function Cuenta({ user, onClose, onRegister, onLogin }) {
  const [tab, setTab] = useState('login');
  const [login, setLogin] = useState({ email: '', password: '' });
  const [register, setRegister] = useState({ name: '', email: '', password: '' });
  const [loginMsg, setLoginMsg] = useState('');
  const [registerMsg, setRegisterMsg] = useState('');

  const handleRegister = e => {
    e.preventDefault();
    if (register.password.length < 4) {
      setRegisterMsg('La contraseña debe tener al menos 4 caracteres.');
      return;
    }
    onRegister({
      name: register.name.trim(),
      email: register.email.trim().toLowerCase(),
      password: register.password
    });
    setRegisterMsg('Cuenta creada correctamente.');
  };

  const handleLogin = e => {
    e.preventDefault();
    const ok = onLogin(login.email.trim().toLowerCase(), login.password);
    setLoginMsg(ok ? 'Sesión iniciada.' : 'Datos incorrectos. Si no tenés cuenta, elegí “Crear cuenta”.');
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="account-modal">
        <button className="close-btn" onClick={onClose}>×</button>
        <div className="account-tabs">
          <button className={`tab ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>Iniciar sesión</button>
          <button className={`tab ${tab === 'register' ? 'active' : ''}`} onClick={() => setTab('register')}>Crear cuenta</button>
        </div>

        {tab === 'login' ? (
          <div>
            <span className="kicker dark">CUENTA</span>
            <h2>Bienvenido de nuevo</h2>
            <p>Tu cuenta solo es necesaria al momento de confirmar el pago.</p>
            <form onSubmit={handleLogin}>
              <label>Email</label>
              <input type="email" placeholder="tu@email.com" required
                value={login.email} onChange={e => setLogin({ ...login, email: e.target.value })} />
              <label>Contraseña</label>
              <input type="password" placeholder="••••••••" required
                value={login.password} onChange={e => setLogin({ ...login, password: e.target.value })} />
              <button className="primary-btn full" type="submit">Iniciar sesión</button>
              <p className="form-message">{loginMsg}</p>
            </form>
          </div>
        ) : (
          <div>
            <span className="kicker dark">NUEVO VIAJERO</span>
            <h2>Creá tu cuenta</h2>
            <p>Registrate para poder confirmar tus compras.</p>
            <form onSubmit={handleRegister}>
              <label>Nombre</label>
              <input type="text" placeholder="Tu nombre" required
                value={register.name} onChange={e => setRegister({ ...register, name: e.target.value })} />
              <label>Email</label>
              <input type="email" placeholder="tu@email.com" required
                value={register.email} onChange={e => setRegister({ ...register, email: e.target.value })} />
              <label>Contraseña</label>
              <input type="password" minLength={4} placeholder="Mínimo 4 caracteres" required
                value={register.password} onChange={e => setRegister({ ...register, password: e.target.value })} />
              <button className="primary-btn full" type="submit">Registrarme</button>
              <p className="form-message">{registerMsg}</p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
