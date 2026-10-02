// Panel del carrito.
import { money } from '../datos.js';

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
            <div className="empty">Todavía no agregaste ningún viaje.<br />Explorá los destinos y sumá tus paquetes.</div>
          ) : (
            entries.map(([id, qty]) => {
              const trip = trips[id];
              return (
                <div className="cart-row" key={id}>
                  <div className="cart-row-head">
                    <div>
                      <h3>{trip.name}</h3>
                      <small>{trip.country} · {money(trip.price)} por pasaje</small>
                    </div>
                    <button className="remove" onClick={() => onRemove(id)}>Eliminar</button>
                  </div>
                  <div className="quantity">
                    <button onClick={() => onChange(id, -1)}>−</button>
                    <strong>{qty}</strong>
                    <button onClick={() => onChange(id, 1)}>+</button>
                    <span className="row-subtotal">{money(trip.price * qty)}</span>
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
