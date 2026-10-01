// Acá está todo el estado: carrito, usuario y modales.
import { useCallback, useEffect, useRef, useState } from 'react';
import useGuardado from './hooks/useGuardado.js';
import { trips, money } from './datos.js';
import Menu from './components/Menu.jsx';
import Portada from './components/Portada.jsx';
import Destinos from './components/Destinos.jsx';
import Servicios from './components/Servicios.jsx';
import Contacto from './components/Contacto.jsx';
import Pie from './components/Pie.jsx';
import Carrito from './components/Carrito.jsx';
import Cuenta from './components/Cuenta.jsx';
import Pago from './components/Pago.jsx';
import Aviso from './components/Aviso.jsx';

export default function App() {
  const [cart, setCart] = useGuardado('horizonteCart', {});
  const [user, setUser] = useGuardado('horizonteUser', null);

  const [cartOpen, setCartOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [toast, setAviso] = useState({ message: '', show: false });
  const timers = useRef([]);

  // Limpia timeouts pendientes al desmontar
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));

  const showAviso = useCallback(message => {
    setAviso({ message, show: true });
    timers.current.push(setTimeout(() => setAviso(t => ({ ...t, show: false })), 2200));
  }, []);

  const cartCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => sum + trips[id].price * qty, 0);

  const addToCart = id => {
    setCart(c => ({ ...c, [id]: (c[id] || 0) + 1 }));
    showAviso(`${trips[id].name} agregado al carrito`);
  };

  const changeQuantity = (id, amount) => {
    setCart(c => {
      const next = { ...c, [id]: (c[id] || 0) + amount };
      if (next[id] <= 0) delete next[id];
      return next;
    });
  };

  const removeFromCart = id => {
    setCart(c => {
      const next = { ...c };
      delete next[id];
      return next;
    });
  };

  const clearCart = () => { setCart({}); showAviso('Carrito vacío'); };

  const checkout = () => {
    if (!cartCount) { showAviso('Agregá al menos un viaje al carrito.'); return; }
    if (!user) {
      setCartOpen(false);
      setAccountOpen(true);
      showAviso('Para pagar necesitás una cuenta.');
      return;
    }
    setPaymentOpen(true);
  };

  const handleRegister = newUser => {
    setUser(newUser);
    later(() => setAccountOpen(false), 700);
    showAviso('Cuenta creada. Ya podés pagar.');
  };

  const handleLogin = (email, password) => {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('horizonteUser')); } catch { /* vacío */ }
    if (saved && saved.email === email && saved.password === password) {
      setUser(saved);
      later(() => setAccountOpen(false), 500);
      showAviso('Sesión iniciada correctamente');
      return true;
    }
    return false;
  };

  const finishPayment = () => {
    const total = cartTotal;
    setCart({});
    setPaymentOpen(false);
    showAviso(`Reserva confirmada por ${money(total)}`);
    later(() => setCartOpen(true), 600);
  };

  return (
    <>
      <Menu
        user={user}
        cartCount={cartCount}
        onOpenAccount={() => setAccountOpen(true)}
        onOpenCart={() => setCartOpen(true)}
      />

      <main>
        <Portada onOpenCart={() => setCartOpen(true)} />
        <Destinos onAdd={addToCart} />
        <Servicios />
        <Contacto />
      </main>

      <Pie />

      {cartOpen && (
        <Carrito
          cart={cart}
          total={cartTotal}
          onClose={() => setCartOpen(false)}
          onChange={changeQuantity}
          onRemove={removeFromCart}
          onClear={clearCart}
          onCheckout={checkout}
        />
      )}

      {accountOpen && (
        <Cuenta
          user={user}
          onClose={() => setAccountOpen(false)}
          onRegister={handleRegister}
          onLogin={handleLogin}
        />
      )}

      {paymentOpen && (
        <Pago
          cart={cart}
          total={cartTotal}
          onClose={() => setPaymentOpen(false)}
          onConfirm={finishPayment}
        />
      )}

      <Aviso message={toast.message} show={toast.show} />
    </>
  );
}
