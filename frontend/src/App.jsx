// Acá está todo el estado: carrito, usuario y modales.
import { useCallback, useEffect, useRef, useState } from 'react';
import useGuardado from './hooks/useGuardado.js';
import { slides as sampleSlides, trips as sampleTrips } from './datos.js';
import api from './api.js';
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
  const [token, setToken] = useGuardado('horizonteToken', null);
  // Muestra estos viajes mientras el servidor carga el catálogo real.
  const [slides, setSlides] = useState(sampleSlides);
  const [trips, setTrips] = useState(sampleTrips);

  const [cartOpen, setCartOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [toast, setAviso] = useState({ message: '', show: false });
  const timers = useRef([]);

  // Limpia timeouts pendientes al desmontar
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));

  const showAviso = useCallback(message => {
    setAviso({ message, show: true });
    timers.current.push(setTimeout(() => setAviso(t => ({ ...t, show: false })), 2200));
  }, []);

  useEffect(() => {
    let active = true;
    api.getProducts().then(products => {
      if (!active || products.length === 0) return;

      const groups = new Map();
      products.forEach(trip => {
        if (!groups.has(trip.num)) {
          groups.set(trip.num, {
            num: trip.num,
            title: trip.category,
            cls: trip.cls,
            desc: trip.categoryDescription,
            trips: [],
          });
        }
        groups.get(trip.num).trips.push(trip);
      });

      setSlides([...groups.values()]);
      setTrips(Object.fromEntries(products.map(trip => [trip.id, trip])));
    }).catch(() => {
      if (active) showAviso('No se pudo conectar con el servidor. Se muestran viajes de ejemplo.');
    });
    return () => { active = false; };
  }, [showAviso]);

  // Quita los datos de acceso antiguos que se guardaban sin protección en el navegador.
  useEffect(() => {
    if (user && !token) {
      setUser(null);
      return;
    }
    if (user?.password) {
      setUser({ id: user.id, name: user.name, email: user.email });
    }
  }, [user, token, setUser]);

  // Verifica el pago con el servidor al volver de Mercado Pago.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') !== 'return') return;

    const paymentId = params.get('payment_id');
    const returnedStatus = params.get('status') || params.get('collection_status');
    window.history.replaceState({}, '', '/');

    if (!paymentId || !token) {
      showAviso(returnedStatus === 'rejected'
        ? 'El pago fue rechazado.'
        : 'No se pudo confirmar el pago. Inicia sesión para revisar la reserva.');
      return;
    }

    api.confirmPayment(token, paymentId).then(result => {
      if (result.status === 'approved') {
        setCart({});
        window.scrollTo({ top: 0, behavior: 'instant' });
        window.alert('gracias por su compra, le enviamos el comprobante a su correo');
        return;
      }

      const messages = {
        pending: 'El pago está pendiente de aprobación.',
        in_process: 'Mercado Pago está procesando el pago.',
        rejected: 'El pago fue rechazado.',
      };
      showAviso(messages[result.status] || 'El pago todavía no está aprobado.');
    }).catch(error => showAviso(error.message));
  }, [token, setCart, showAviso]);

  const cartCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => (
    sum + (trips[id]?.price ?? 0) * qty
  ), 0);

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

  const handleRegister = async newUser => {
    const session = await api.register(newUser);
    setToken(session.token);
    setUser(session.user);
    later(() => setAccountOpen(false), 700);
    showAviso('Cuenta creada. Ya podés pagar.');
  };

  const handleLogin = async (email, password) => {
    const session = await api.login({ email, password });
    setToken(session.token);
    setUser(session.user);
    later(() => setAccountOpen(false), 500);
    showAviso('Sesión iniciada correctamente');
  };

  const finishPayment = async () => {
    setPaymentBusy(true);
    setPaymentError('');
    try {
      const checkout = await api.createCheckout(token, Object.entries(cart).map(([productId, quantity]) => ({
        productId,
        quantity,
      })));
      window.location.assign(checkout.checkoutUrl);
    } catch (error) {
      if (error.status === 401) {
        setToken(null);
        setUser(null);
        setPaymentOpen(false);
        setAccountOpen(true);
        showAviso('La sesión venció. Inicia sesión otra vez para pagar.');
        return;
      }
      setPaymentError(error.message);
    } finally {
      setPaymentBusy(false);
    }
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
        <Destinos slides={slides} onAdd={addToCart} />
        <Servicios />
        <Contacto />
      </main>

      <Pie />

      {cartOpen && (
        <Carrito
          cart={cart}
          trips={trips}
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
          trips={trips}
          total={cartTotal}
          busy={paymentBusy}
          error={paymentError}
          onClose={() => setPaymentOpen(false)}
          onConfirm={finishPayment}
        />
      )}

      <Aviso message={toast.message} show={toast.show} />
    </>
  );
}
