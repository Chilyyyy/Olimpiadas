
import { useCallback, useEffect, useRef, useState } from 'react';
import './booking.css';
import useGuardado from './hooks/useGuardado.js';
import useCart from './hooks/useCart.js';
import {
  photosByCountry,
  slides as sampleSlides,
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

function getTripPhoto(trip) {
  const samplePhoto = sampleTrips[trip.id]?.photo;

  if (samplePhoto) {
    return samplePhoto;
  }

  return photosByCountry[trip.country];
}

export default function App() {
  const [user, setUser] = useGuardado('horizonteUser', null);
  const [token, setToken] = useGuardado('horizonteToken', null);

  // Muestra estos viajes mientras el servidor carga el catálogo real.
  const [slides, setSlides] = useState(sampleSlides);
  const [trips, setTrips] = useState(sampleTrips);

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

  // Limpia timeouts pendientes al desmontar.
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));

  const showAviso = useCallback(message => {
    setAviso({ message, show: true });

    timers.current.push(
      setTimeout(() => setAviso(t => ({ ...t, show: false })), 2200)
    );
  }, []);

  // Administra el carrito de compras.
  const {
    setCart,
    normalizedCart,
    cartCount,
    cartTotal,
    addToCart,
    changeQuantity,
    removeFromCart,
    clearCart,
  } = useCart(trips, showAviso);

  // Carga los productos del servidor.
  useEffect(() => {
    let active = true;

    api.getProducts()
      .then(products => {
        if (!active || products.length === 0) return;

        const productsWithPhotos = products.map(trip => ({
          ...trip,
          photo: getTripPhoto(trip),
        }));

        const groups = new Map();

        productsWithPhotos.forEach(trip => {
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

        setTrips(Object.fromEntries(
          productsWithPhotos.map(trip => [trip.id, trip])
        ));
      })
      .catch(() => {
        if (active) {
          showAviso('No se pudo conectar con el servidor. Se muestran viajes de ejemplo.');
        }
      });

    return () => {
      active = false;
    };
  }, [showAviso]);

  // Quita los datos de acceso antiguos que se guardaban sin protección.
  useEffect(() => {
    if (user && !token) {
      setUser(null);
      return;
    }

    if (user?.password) {
      setUser({
        id: user.id,
        name: user.name,
        email: user.email,
      });
    }
  }, [user, token, setUser]);

  // Verifica el pago al volver de Mercado Pago.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (
      params.get('payment') !== 'return' ||
      paymentReturnHandled.current
    ) {
      return;
    }

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

    api.confirmPayment(token, paymentId)
      .then(result => {
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
      })
      .catch(error => showAviso(error.message));
  }, [token, setCart, showAviso]);

  // Actualiza el carrito al iniciar el checkout.
  const checkout = () => {
    if (!cartCount) {
      showAviso('Agregá al menos un viaje al carrito.');
      return;
    }

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

  // Lógica compartida para iniciar sesión.
  const loginUser = async (email, password, requiredRole) => {
    const session = await api.login({ email, password });

    if (requiredRole && session.user.role !== requiredRole) {
      throw new Error('Esta cuenta no tiene permisos de jefe de ventas.');
    }

    setToken(session.token);
    setUser(session.user);

    later(() => {
      setAccountOpen(false);
      setManagerLoginOpen(false);
    }, 500);

    showAviso(requiredRole
      ? 'Sesión de jefe de ventas iniciada.'
      : 'Sesión iniciada correctamente');
  };

  const handleLogin = (email, password) => {
    return loginUser(email, password);
  };

  const handleManagerLogin = (email, password) => {
    return loginUser(email, password, 'jefe_ventas');
  };

  // Agrega los productos publicados al catálogo.
  const addPublishedProduct = product => {
    const productWithPhoto = {
      ...product,
      photo: getTripPhoto(product),
    };

    setTrips(current => ({
      ...current,
      [productWithPhoto.id]: productWithPhoto,
    }));

    setSlides(current => {
      const existing = current.some(
        slide => slide.num === productWithPhoto.num
      );

      if (existing) {
        return current.map(slide => {
          if (slide.num !== productWithPhoto.num) return slide;

          const productExists = slide.trips.some(
            trip => trip.id === productWithPhoto.id
          );

          return {
            ...slide,
            trips: productExists
              ? slide.trips.map(trip => trip.id === productWithPhoto.id
                  ? productWithPhoto
                  : trip)
              : [...slide.trips, productWithPhoto],
          };
        });
      }

      return [...current, {
        num: productWithPhoto.num,
        title: productWithPhoto.category,
        cls: productWithPhoto.cls,
        desc: productWithPhoto.categoryDescription,
        trips: [productWithPhoto],
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
      const checkout = await api.createCheckout(
        token,
        Object.values(normalizedCart).map(booking => ({
          productId: booking.productId,
          quantity: booking.quantity,
          serviceType: booking.serviceType,
          departureDate: booking.departureDate,
          days: booking.days,
        }))
      );

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
