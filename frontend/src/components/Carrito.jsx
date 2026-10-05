// Panel del carrito.
import { bookingTotal, bookingTypeLabels, money } from '../datos.js';

export default function Carrito({ cart, trips, total, onClose, onChange, onRemove, onClear, onCheckout }) {
  const entries = Object.entries(cart);

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <aside className="cart-panel">
        <div className="modal-header">
          <div><span className="kicker dark">TU RESERVA</span><h2>Carrito</h2></div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="cart-items">
          {entries.length === 0 ? (
            <div className="empty">Todavía no agregaste ninguna reserva.<br />Elegí un destino y configurá tu viaje.</div>
          ) : (
            entries.map(([key, booking]) => {
              const trip = trips[booking.productId];
              if (!trip) return null;
              const subtotal = bookingTotal(trip, booking);
              return (
                <div className="cart-row" key={key}>
                  <div className="cart-row-head">
                    <div>
                      <h3>{trip.name}</h3>
                      <small>{trip.country} · {bookingTypeLabels[booking.serviceType]}</small>
                    </div>
                    <button className="remove" onClick={() => onRemove(key)}>Eliminar</button>
                  </div>
                  <p className="cart-booking-details">
                    Salida: {booking.departureDate} · {booking.days} días
                  </p>
                  <div className="quantity">
                    <button aria-label={`Quitar un viajero de ${trip.name}`} onClick={() => onChange(key, -1)}>−</button>
                    <strong>{booking.quantity}</strong>
                    <button
                      aria-label={`Agregar un viajero a ${trip.name}`}
                      disabled={booking.quantity >= 10}
                      onClick={() => onChange(key, 1)}
                    >+</button>
                    <span className="row-subtotal">{money(subtotal)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="cart-summary"><span>Total</span><strong>{money(total)}</strong></div>
        <button className="primary-btn full" onClick={onCheckout}>Continuar al pago</button>
        <button className="text-btn" onClick={onClear}>Vaciar carrito</button>
      </aside>
    </div>
  );
}
