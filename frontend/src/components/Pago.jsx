// Muestra el resumen antes de abrir el checkout de Mercado Pago.
import { money } from '../datos.js';

export default function Pago({ cart, trips, total, busy, error, onClose, onConfirm }) {
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="payment-modal">
        <button className="close-btn" onClick={onClose}>×</button>
        <span className="kicker dark">MERCADO PAGO</span>
        <h2>Continuar con el pago</h2>
        <p>Revisá tu reserva. Para pagar, te llevaremos al checkout seguro de Mercado Pago.</p>
        <div className="payment-summary">
          {Object.entries(cart).map(([id, qty]) => (
            <div className="payment-line" key={id}>
              <span>{trips[id].name} × {qty}</span>
              <strong>{money(trips[id].price * qty)}</strong>
            </div>
          ))}
        </div>
        <div className="payment-total"><span>Total a pagar</span><strong>{money(total)}</strong></div>
        {error && <p className="form-message">{error}</p>}
        <button className="primary-btn full" onClick={onConfirm} disabled={busy}>
          {busy ? 'Conectando con Mercado Pago...' : 'Ir a Mercado Pago'}
        </button>
        <p className="secure-note">✓ El pago se procesa en Mercado Pago</p>
      </div>
    </div>
  );
}
