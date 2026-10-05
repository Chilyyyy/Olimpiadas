import { useEffect, useState } from 'react';
import { bookingTypeLabels, money, todayArgentinaDate } from '../datos.js';
import api from '../api.js';

const emptyProduct = {
  name: '',
  type: 'Paquete turístico',
  price: '',
  country: '',
  place: '',
  days: '1',
  rating: '5',
  category: '',
  description: '',
};

function orderStatus(order) {
  if (order.status === 'entregado') return 'Entregado';
  if (order.status === 'anulado') return 'Anulado';
  return order.paid ? 'Pago confirmado · pendiente de entrega' : 'Pendiente de pago';
}

export default function Pedidos({
  user,
  token,
  onClose,
  onNotice,
  onProductCreated,
}) {
  const isManager = user.role === 'jefe_ventas';
  const [orders, setOrders] = useState([]);
  const [product, setProduct] = useState(emptyProduct);
  const [activeTab, setActiveTab] = useState('orders');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const refreshOrders = async () => {
    setLoading(true);
    setError('');
    try {
      setOrders(isManager
        ? await api.getSalesOrders(token)
        : await api.getOrders(token));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshOrders();
  }, [token, isManager]);

  const updateItem = async (orderId, itemId, fields) => {
    setBusy(`item-${itemId}`);
    setError('');
    try {
      await api.updateOrderItem(token, orderId, itemId, fields);
      await refreshOrders();
      onNotice('Pedido actualizado. Genera un nuevo pago antes de pagar.');
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    } finally {
      setBusy('');
    }
  };

  const deleteOrder = async orderId => {
    if (!window.confirm(`¿Eliminar el pedido #${orderId}? Esta acción no se puede deshacer.`)) return;
    setBusy(`order-${orderId}`);
    setError('');
    try {
      await api.deleteOrder(token, orderId);
      await refreshOrders();
      onNotice('Pedido eliminado.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy('');
    }
  };

  const checkoutOrder = async orderId => {
    setBusy(`checkout-${orderId}`);
    setError('');
    try {
      const result = await api.checkoutOrder(token, orderId);
      window.location.assign(result.checkoutUrl);
    } catch (requestError) {
      setError(requestError.message);
      setBusy('');
    }
  };

  const changeStatus = async (orderId, status) => {
    const action = status === 'anulado' ? 'anular' : 'marcar como entregado';
    const refundNote = status === 'anulado' && orders.find(order => order.id === orderId)?.paid
      ? ' La anulación no procesa un reembolso automáticamente.'
      : '';
    if (!window.confirm(`¿${action} el pedido #${orderId}?${refundNote}`)) return;
    setBusy(`order-${orderId}`);
    setError('');
    try {
      await api.updateSalesOrder(token, orderId, status);
      await refreshOrders();
      onNotice(status === 'anulado' ? 'Pedido anulado.' : 'Pedido marcado como entregado.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy('');
    }
  };

  const addProduct = async event => {
    event.preventDefault();
    setBusy('product');
    setError('');
    try {
      const created = await api.createProduct(token, {
        ...product,
        price: Number(product.price),
        days: Number(product.days),
        rating: Number(product.rating),
      });
      onProductCreated(created);
      setProduct(emptyProduct);
      onNotice('Producto cargado y publicado en el catálogo.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="modal-backdrop dashboard-backdrop" onClick={event => event.target === event.currentTarget && onClose()}>
      <section className="sales-panel" aria-labelledby="orders-title">
        <header className="sales-header">
          <div>
            <span className="kicker dark">{isManager ? 'GESTIÓN COMERCIAL' : 'TU CUENTA'}</span>
            <h2 id="orders-title">{isManager ? 'Panel de ventas' : 'Mis pedidos'}</h2>
            <p>{user.name} · {user.email}</p>
          </div>
          <button className="close-btn" type="button" aria-label="Cerrar" onClick={onClose}>×</button>
        </header>

        {isManager && (
          <div className="sales-tabs" role="tablist" aria-label="Opciones de ventas">
            <button
              className={activeTab === 'orders' ? 'active' : ''}
              type="button"
              role="tab"
              aria-selected={activeTab === 'orders'}
              onClick={() => setActiveTab('orders')}
            >Pedidos pendientes</button>
            <button
              className={activeTab === 'products' ? 'active' : ''}
              type="button"
              role="tab"
              aria-selected={activeTab === 'products'}
              onClick={() => setActiveTab('products')}
            >Cargar producto</button>
          </div>
        )}

        {error && <p className="sales-error" role="alert">{error}</p>}

        {(!isManager || activeTab === 'orders') && (
          <div className="sales-content">
            {loading ? <p className="empty">Cargando pedidos…</p> : orders.length === 0 ? (
              <p className="empty">Todavía no hay pedidos para mostrar.</p>
            ) : orders.map(order => (
              <article className="order-card" key={order.id}>
                <div className="order-card-header">
                  <div>
                    <h3>Pedido #{order.id}</h3>
                    <small>{new Date(order.date).toLocaleString('es-AR')}</small>
                    {isManager && <small className="order-customer">{order.customer} · {order.email}</small>}
                  </div>
                  <span className={`order-status ${order.status}`}>{orderStatus(order)}</span>
                </div>

                {order.items.map(item => (
                  <OrderItem
                    key={item.id}
                    item={item}
                    order={order}
                    isManager={isManager}
                    busy={busy === `item-${item.id}`}
                    onSave={fields => updateItem(order.id, item.id, fields)}
                  />
                ))}

                <div className="order-total"><span>Total</span><strong>{money(order.total)}</strong></div>

                {isManager ? (
                  order.status === 'pendiente' && (
                    <div className="order-actions">
                      <button
                        type="button"
                        className="order-action"
                        disabled={!order.paid || busy === `order-${order.id}`}
                        onClick={() => changeStatus(order.id, 'entregado')}
                      >Entregar pedido</button>
                      <button
                        type="button"
                        className="order-action danger"
                        disabled={busy === `order-${order.id}`}
                        onClick={() => changeStatus(order.id, 'anulado')}
                      >Anular pedido</button>
                    </div>
                  )
                ) : (
                  order.status === 'pendiente' && !order.paid && (
                    <div className="order-actions">
                      <button
                        type="button"
                        className="order-action"
                        disabled={busy === `checkout-${order.id}`}
                        onClick={() => checkoutOrder(order.id)}
                      >{busy === `checkout-${order.id}` ? 'Conectando…' : 'Continuar al pago'}</button>
                      <button
                        type="button"
                        className="order-action danger"
                        disabled={busy === `order-${order.id}`}
                        onClick={() => deleteOrder(order.id)}
                      >Eliminar pedido</button>
                    </div>
                  )
                )}
              </article>
            ))}
          </div>
        )}

        {isManager && activeTab === 'products' && (
          <form className="product-form" onSubmit={addProduct}>
            <p>El nuevo producto aparecerá en el catálogo público de destinos.</p>
            <div className="product-fields">
              <label>Nombre
                <input required maxLength="255" value={product.name}
                  onChange={event => setProduct({ ...product, name: event.target.value })} />
              </label>
              <label>Tipo
                <input required value={product.type}
                  onChange={event => setProduct({ ...product, type: event.target.value })} />
              </label>
              <label>Precio por persona (ARS)
                <input required type="number" min="1" step="0.01" value={product.price}
                  onChange={event => setProduct({ ...product, price: event.target.value })} />
              </label>
              <label>Duración (días)
                <input required type="number" min="1" max="365" value={product.days}
                  onChange={event => setProduct({ ...product, days: event.target.value })} />
              </label>
              <label>País
                <input required maxLength="100" value={product.country}
                  onChange={event => setProduct({ ...product, country: event.target.value })} />
              </label>
              <label>Destino / ciudad
                <input required maxLength="100" value={product.place}
                  onChange={event => setProduct({ ...product, place: event.target.value })} />
              </label>
              <label>Categoría
                <input required maxLength="100" value={product.category}
                  onChange={event => setProduct({ ...product, category: event.target.value })} />
              </label>
              <label>Calificación (0 a 5)
                <input required type="number" min="0" max="5" step="0.1" value={product.rating}
                  onChange={event => setProduct({ ...product, rating: event.target.value })} />
              </label>
              <label className="product-description">Descripción
                <textarea required maxLength="2000" rows="4" value={product.description}
                  onChange={event => setProduct({ ...product, description: event.target.value })} />
              </label>
            </div>
            <button className="primary-btn full" type="submit" disabled={busy === 'product'}>
              {busy === 'product' ? 'Guardando…' : 'Publicar producto'}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

function OrderItem({ item, order, isManager, busy, onSave }) {
  const canEdit = !isManager && !order.paid && order.status === 'pendiente';
  const [editing, setEditing] = useState(false);
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [departureDate, setDepartureDate] = useState(item.departureDate?.slice(0, 10) || todayArgentinaDate());
  const [days, setDays] = useState(String(item.days || 1));

  const submit = async event => {
    event.preventDefault();
    const saved = await onSave({
      quantity: Number(quantity),
      departureDate,
      days: Number(days),
    });
    if (saved) setEditing(false);
  };

  return (
    <div className="order-item">
      <div className="order-item-summary">
        <span>{item.name} · {bookingTypeLabels[item.serviceType] || item.serviceType}</span>
        <strong>{money(item.total)}</strong>
      </div>
      <small>{item.quantity} viajeros · {item.days} días · salida {item.departureDate?.slice(0, 10)}</small>
      {canEdit && (editing ? (
        <form className="order-edit" onSubmit={submit}>
          <label>Viajeros
            <input type="number" min="1" max="10" required value={quantity}
              onChange={event => setQuantity(event.target.value)} />
          </label>
          <label>Fecha de salida
            <input type="date" min={todayArgentinaDate()} required value={departureDate}
              onChange={event => setDepartureDate(event.target.value)} />
          </label>
          <label>Días
            <input type="number" min="1" max="365" required value={days}
              onChange={event => setDays(event.target.value)} />
          </label>
          <button type="submit" className="order-action" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar cambios'}
          </button>
          <button type="button" className="order-action secondary-action" onClick={() => setEditing(false)}>Cancelar</button>
        </form>
      ) : (
        <button type="button" className="text-btn edit-order" onClick={() => setEditing(true)}>Modificar reserva</button>
      ))}
    </div>
  );
}
