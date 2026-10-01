// Resumen para confirmar la compra.
import { trips, money } from '../datos.js';

export default function Pago({ cart, total, onClose, onConfirm }) {
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="payment-modal">
        <button className="close-btn" onClick={onClose}>×</button>
        <span className="kicker dark">PAGO</span>
        <h2>Confirmar compra</h2>
        <p>Estás por reservar los siguientes viajes:</p>
        <div className="payment-summary">
          {Object.entries(cart).map(([id, qty]) => (
            <div className="payment-line" key={id}>
              <span>{trips[id].name} × {qty}</span>
              <strong>{money(trips[id].price * qty)}</strong>
            </div>
          ))}
        </div>
        <div className="payment-total"><span>Total a pagar</span><strong>{money(total)}</strong></div>
        <button className="primary-btn full" onClick={onConfirm}>Confirmar reserva</button>
        <p className="secure-note">✓ Simulación de compra para el proyecto web</p>
      </div>
    </div>
  );
}
