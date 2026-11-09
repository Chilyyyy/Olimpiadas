import { useCallback, useEffect, useMemo } from 'react';
import useGuardado from './useGuardado.js';
import { bookingTotal, todayArgentinaDate } from '../datos.js';

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

export default function useCart(trips, showAviso) {
  const [cart, setCart] = useGuardado('horizonteCart', {});

  const normalizedCart = useMemo(
    () => normalizeCart(cart, trips),
    [cart, trips]
  );

  // Actualiza los carritos antiguos al formato actual.
  useEffect(() => {
    if (Object.values(cart).some(value => typeof value === 'number')) {
      setCart(normalizedCart);
    }
  }, [cart, normalizedCart, setCart]);

  const cartCount = Object.values(normalizedCart).reduce(
    (sum, booking) => sum + booking.quantity,
    0
  );

  const cartTotal = Object.values(normalizedCart).reduce((sum, booking) => {
    const trip = trips[booking.productId];

    return trip ? sum + bookingTotal(trip, booking) : sum;
  }, 0);

  const addToCart = useCallback((id, options) => {
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

      return {
        ...next,
        [key]: {
          ...booking,
          quantity: (existing?.quantity ?? 0) + booking.quantity,
        },
      };
    });

    showAviso(`${trips[id].name} agregado al carrito`);
  }, [normalizedCart, trips, setCart, showAviso]);

  const changeQuantity = useCallback((key, amount) => {
    const currentBooking = normalizedCart[key];

    if (currentBooking && currentBooking.quantity + amount > 10) {
      showAviso('No se pueden reservar más de 10 viajeros por reserva.');
      return;
    }

    setCart(current => {
      const next = normalizeCart(current, trips);
      const booking = next[key];

      if (!booking) return next;

      const quantity = booking.quantity + amount;

      if (quantity <= 0) {
        delete next[key];
      } else {
        next[key] = { ...booking, quantity };
      }

      return next;
    });
  }, [normalizedCart, trips, setCart, showAviso]);

  const removeFromCart = useCallback(key => {
    setCart(current => {
      const next = normalizeCart(current, trips);
      delete next[key];

      return next;
    });
  }, [trips, setCart]);

  const clearCart = useCallback(() => {
    setCart({});
    showAviso('Carrito vacío');
  }, [setCart, showAviso]);

  return {
    cart,
    setCart,
    normalizedCart,
    cartCount,
    cartTotal,
    addToCart,
    changeQuantity,
    removeFromCart,
    clearCart,
  };
}
