// Acá está todo el estado: carrito, usuario y modales.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './booking.css';
import useGuardado from './hooks/useGuardado.js';
import {
  bookingTotal,
  slides as sampleSlides,
  todayArgentinaDate,
  trips as sampleTrips,
} from './datos.js';
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
import Pedidos from './components/Pedidos.jsx';

function bookingKey(booking) {
  return JSON.stringify([
    booking.productId,
    booking.serviceType,
    booking.departureDate,
    booking.days,
  ]);
}

function normalizeCart(cart, trips) {
  return Object.fromEntries(Object.entries(cart).map(([key, value]) => {
    if (typeof value !== 'number') return [key, value];
    const booking = {
      productId: key,
      serviceType: 'paquete',
      departureDate: todayArgentinaDate(),
      days: trips[key]?.days ?? 1,
      quantity: value,
    };
    return [bookingKey(booking), booking];
  }));
}

export default function App() {
  const [cart, setCart] = useGuardado('horizonteCart', {});
  const [user, setUser] = useGuardado('horizonteUser', null);
  const [token, setToken] = useGuardado('horizonteToken', null);
  // Muestra estos viajes mientras el servidor carga el catálogo real.
  const [slides, setSlides] = useState(sampleSlides);
  const [trips, setTrips] = useState(sampleTrips);
  const normalizedCart = useMemo(() => normalizeCart(cart, trips), [cart, trips]);

  const [cartOpen, setCartOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [managerLoginOpen, setManagerLoginOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [toast, setAviso] = useState({ message: '', show: false });
  const timers = useRef([]);
  const paymentReturnHandled = useRef(false);

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
    if (params.get('payment') !== 'return' || paymentReturnHandled.current) return;
    paymentReturnHandled.current = true;

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
        showAviso(result.emailSent
          ? 'Pago aprobado. Enviamos el comprobante a tu correo.'
          : 'Pago aprobado, pero no se pudo enviar el comprobante. Contactanos.');
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

  const cartCount = Object.values(normalizedCart).reduce(
    (sum, booking) => sum + booking.quantity,
    0,
  );
  const cartTotal = Object.values(normalizedCart).reduce((sum, booking) => {
    const trip = trips[booking.productId];
    return trip ? sum + bookingTotal(trip, booking) : sum;
  }, 0);

  useEffect(() => {
    if (Object.values(cart).some(value => typeof value === 'number')) {
      setCart(normalizedCart);
    }
  }, [cart, normalizedCart, setCart]);

  const addToCart = (id, options) => {
    const booking = { productId: id, ...options };
    const key = bookingKey(booking);
    const existingQuantity = normalizedCart[key]?.quantity ?? 0;
    if (existingQuantity + booking.quantity > 10) {
      showAviso('No se pueden reservar más de 10 viajeros por reserva.');
      return;
    }
    setCart(current => {
      const next = normalizeCart(current, trips);
      const existing = next[key];
      return { ...next, [key]: { ...booking, quantity: (existing?.quantity ?? 0) + booking.quantity } };
    });
    showAviso(`${trips[id].name} agregado al carrito`);
  };

  const changeQuantity = (key, amount) => {
    const currentBooking = normalizedCart[key];
    if (currentBooking && currentBooking.quantity + amount > 10) {
      showAviso('No se pueden reservar más de 10 viajeros por reserva.');
      return;
    }
    setCart(c => {
      const next = normalizeCart(c, trips);
      const booking = next[key];
      if (!booking) return next;
      const quantity = booking.quantity + amount;
      if (quantity <= 0) delete next[key];
      else next[key] = { ...booking, quantity };
      return next;
    });
  };

  const removeFromCart = key => {
    setCart(c => {
      const next = normalizeCart(c, trips);
      delete next[key];
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
    later(() => {
      setAccountOpen(false);
      setManagerLoginOpen(false);
    }, 500);
    showAviso('Sesión iniciada correctamente');
  };

  const handleManagerLogin = async (email, password) => {
    const session = await api.login({ email, password });
    if (session.user.role !== 'jefe_ventas') {
      throw new Error('Esta cuenta no tiene permisos de jefe de ventas.');
    }
    setToken(session.token);
    setUser(session.user);
    later(() => {
      setAccountOpen(false);
      setManagerLoginOpen(false);
    }, 500);
    showAviso('Sesión de jefe de ventas iniciada.');
  };

  const addPublishedProduct = product => {
    setTrips(current => ({ ...current, [product.id]: product }));
    setSlides(current => {
      const existing = current.some(slide => slide.num === product.num);
      if (existing) {
        return current.map(slide => slide.num === product.num
          ? { ...slide, trips: [...slide.trips, product] }
          : slide);
      }
      return [...current, {
        num: product.num,
        title: product.category,
        cls: product.cls,
        desc: product.categoryDescription,
        trips: [product],
      }];
    });
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setOrdersOpen(false);
    showAviso('Sesión cerrada.');
  };

  const finishPayment = async () => {
    setPaymentBusy(true);
    setPaymentError('');
    try {
      const checkout = await api.createCheckout(token, Object.values(normalizedCart).map(booking => ({
        productId: booking.productId,
        quantity: booking.quantity,
        serviceType: booking.serviceType,
        departureDate: booking.departureDate,
        days: booking.days,
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
        onOpenOrders={() => setOrdersOpen(true)}
        onOpenManagerLogin={() => setManagerLoginOpen(true)}
        onLogout={logout}
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
          cart={normalizedCart}
          trips={trips}
          total={cartTotal}
          onClose={() => setCartOpen(false)}
          onChange={changeQuantity}
          onRemove={removeFromCart}
          onClear={clearCart}
          onCheckout={checkout}
        />
      )}

      {(accountOpen || managerLoginOpen) && (
        <Cuenta
          managerOnly={managerLoginOpen}
          onClose={() => {
            setAccountOpen(false);
            setManagerLoginOpen(false);
          }}
          onRegister={handleRegister}
          onLogin={handleLogin}
          onManagerLogin={handleManagerLogin}
        />
      )}

      {ordersOpen && user && (
        <Pedidos
          user={user}
          token={token}
          onClose={() => setOrdersOpen(false)}
          onNotice={showAviso}
          onProductCreated={addPublishedProduct}
        />
      )}

      {paymentOpen && (
        <Pago
          cart={normalizedCart}
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
