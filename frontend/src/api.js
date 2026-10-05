// Usa la URL configurada o el proxy local de Vite.
const apiUrl = import.meta.env.VITE_API_URL || ''

// Envía una solicitud y convierte los errores del servidor en mensajes simples.
async function request(path, { token, ...options } = {}) {
  const response = await fetch(`${apiUrl}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      // El token permite llamar a las rutas que requieren iniciar sesión.
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(result.error || 'No se pudo completar la solicitud.')
    error.status = response.status
    throw error
  }
  return result
}

const api = {
  // Estas funciones conectan la interfaz con las rutas del backend.
  getProducts: () => request('/products'),
  register: data => request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  login: data => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  createCheckout: (token, items) => request('/orders', {
    method: 'POST',
    token,
    body: JSON.stringify({ items }),
  }),
  getOrders: token => request('/orders', { token }),
  updateOrderItem: (token, orderId, itemId, item) => request(
    `/orders/${orderId}/items/${itemId}`,
    { method: 'PATCH', token, body: JSON.stringify(item) },
  ),
  deleteOrder: (token, orderId) => request(`/orders/${orderId}`, {
    method: 'DELETE',
    token,
  }),
  checkoutOrder: (token, orderId) => request(`/orders/${orderId}/checkout`, {
    method: 'POST',
    token,
  }),
  getSalesOrders: token => request('/sales/orders', { token }),
  updateSalesOrder: (token, orderId, status) => request(`/sales/orders/${orderId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ status }),
  }),
  createProduct: (token, product) => request('/products', {
    method: 'POST',
    token,
    body: JSON.stringify(product),
  }),
  confirmPayment: (token, paymentId) => request('/payments/confirm', {
    method: 'POST',
    token,
    body: JSON.stringify({ paymentId }),
  }),
}

export default api