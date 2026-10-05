import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import jwt from 'jsonwebtoken'
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago'
import nodemailer from 'nodemailer'
import { fileURLToPath } from 'node:url'
import db from './db.js'

const app = express()
const port = Number(process.env.PORT) || 10000
const frontendUrl = process.env.FRONTEND_URL
  || process.env.RENDER_EXTERNAL_URL
  || 'http://localhost:5173'
const frontendBuildPath = fileURLToPath(new URL('../frontend/dist/', import.meta.url))
const unwrap = value => value?.replace(/^´|´$/g, '')
const mercadoPagoAccessToken = unwrap(
  process.env.MERCADO_PAGO_ACCESS_TOKEN ?? process.env.VITE_MERCADO_PAGO_ACCESS_TOKEN,
)
const mercadoPagoClient = mercadoPagoAccessToken
  ? new MercadoPagoConfig({ accessToken: mercadoPagoAccessToken })
  : null
const smtpHost = process.env.SMTP_HOST?.trim()
const smtpUser = process.env.SMTP_USER?.trim()
const smtpPassword = process.env.SMTP_PASS
const smtpConfigured = Boolean(smtpUser || smtpPassword)
const smtpPort = Number(process.env.SMTP_PORT || 587)
if (smtpConfigured && (!smtpHost || !smtpUser || !smtpPassword)) {
  throw new Error('Configura SMTP_HOST, SMTP_USER y SMTP_PASS para habilitar el envío de correos.')
}
if (!smtpConfigured && (smtpHost || process.env.SMTP_FROM?.trim())) {
  console.warn('El envío de correos está deshabilitado; configura SMTP_USER y SMTP_PASS para habilitarlo.')
}
if (smtpConfigured && (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535)) {
  throw new Error('SMTP_PORT debe ser un puerto válido.')
}
const mailTransport = smtpConfigured
  ? nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPassword },
  })
  : null
const mailFrom = process.env.SMTP_FROM?.trim() || smtpUser
const jwtSecret = process.env.JWT_SECRET || (
  process.env.NODE_ENV === 'production' ? '' : randomBytes(32).toString('hex')
)

if (!jwtSecret) {
  throw new Error('Agrega JWT_SECRET a backend/.env antes de iniciar en producción.')
}

if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET no está definido; las sesiones locales se cerrarán al reiniciar.')
}

app.use(helmet())
app.use(cors({ origin: frontendUrl }))
app.use(express.json({ limit: '20kb' }))

// Crea un error con el código que debe recibir el navegador.
function apiError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

// Convierte los datos internos de un viaje al formato que ya usa React.
function formatProduct(row) {
  return {
    id: row.slug,
    code: row.codigo,
    name: row.producto,
    type: row.tipo,
    price: Number(row.precio),
    country: row.pais,
    photo: row.foto,
    place: row.lugar,
    days: Number(row.dias),
    rating: Number(row.rating),
    desc: row.descripcion,
    num: row.numero_categoria,
    category: row.categoria,
    cls: row.clase_categoria,
    categoryDescription: row.descripcion_categoria,
  }
}

// Revisa que la persona haya iniciado sesión antes de crear un pedido.
function requireLogin(req, _res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')

  if (!token) {
    return next(apiError(401, 'Inicia sesión para confirmar la reserva.'))
  }

  try {
    const session = jwt.verify(token, jwtSecret)
    req.userId = Number(session.sub)
    return next()
  } catch {
    return next(apiError(401, 'La sesión venció. Inicia sesión otra vez.'))
  }
}

async function requireSalesManager(req, _res, next) {
  const result = await db.query(
    'SELECT rol FROM usuarios WHERE id_usuarios = $1',
    [req.userId],
  )
  if (result.rows[0]?.rol !== 'jefe_ventas') {
    return next(apiError(403, 'Esta sección es exclusiva del jefe de ventas.'))
  }
  return next()
}

// Avisa si falta el token privado necesario para hablar con Mercado Pago.
function requireMercadoPago() {
  if (!mercadoPagoClient) {
    throw apiError(503, 'Configura el access token de Mercado Pago en backend/.env.')
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character])
}

function formatMoney(amount) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount)
}

const serviceLabels = {
  paquete: 'Paquete completo',
  viaje: 'Viaje simple',
  hotel: 'Reservación en hotel',
  vehiculo: 'Reservación de vehículo',
}
const extraPassengerDailyRate = 200000

function todayArgentinaDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

async function createCheckoutUrl(orderId, items, payerEmail) {
  const returnUrl = new URL('/?payment=return', frontendUrl).toString()
  const canAutoReturn = new URL(frontendUrl).protocol === 'https:'
  const preference = await new Preference(mercadoPagoClient).create({
    body: {
      items: items.map((item, index) => ({
        id: `${item.slug}-${index + 1}`,
        title: `${item.name.slice(0, 160)} - ${serviceLabels[item.serviceType]} - ${item.departureDate} - ${item.days} días - ${item.quantity} viajeros`,
        quantity: 1,
        unit_price: item.total,
        currency_id: 'ARS',
      })),
      payer: { email: payerEmail },
      external_reference: String(orderId),
      back_urls: {
        success: returnUrl,
        pending: returnUrl,
        failure: returnUrl,
      },
      ...(canAutoReturn ? { auto_return: 'approved' } : {}),
    },
  })
  const checkoutUrl = mercadoPagoAccessToken.startsWith('TEST-')
    ? preference.sandbox_init_point || preference.init_point
    : preference.init_point

  if (!checkoutUrl) throw apiError(502, 'Mercado Pago no devolvió un enlace de pago.')
  return checkoutUrl
}

async function listOrders(userId) {
  const result = await db.query(
    `SELECT o.id_pedidos, o.fecha, o.estado, o.estado_pedido,
            u.nombre, u.apellido, u.email,
            d.id_detalles, d.cantidad, d.precio_unitario, d.precio_total,
            d.tipo_servicio, d.fecha_salida, d.dias, p.slug, p.producto
     FROM pedidos o
     JOIN usuarios u ON u.id_usuarios = o.id_usuarios
     LEFT JOIN detalles_productos d ON d.id_pedidos = o.id_pedidos
     LEFT JOIN productos p ON p.id_productos = d.id_productos
     WHERE ($1::integer IS NULL OR o.id_usuarios = $1)
     ORDER BY o.fecha DESC, o.id_pedidos DESC, d.id_detalles`,
    [userId],
  )
  const orders = new Map()
  for (const row of result.rows) {
    if (!orders.has(row.id_pedidos)) {
      orders.set(row.id_pedidos, {
        id: row.id_pedidos,
        date: row.fecha,
        paid: row.estado,
        status: row.estado_pedido,
        customer: `${row.nombre} ${row.apellido}`.trim(),
        email: row.email,
        items: [],
        total: 0,
      })
    }
    if (row.id_detalles == null) continue
    const item = {
      id: row.id_detalles,
      productId: row.slug,
      name: row.producto,
      quantity: row.cantidad,
      unitPrice: Number(row.precio_unitario),
      total: Number(row.precio_total ?? Number(row.precio_unitario) * Number(row.cantidad)),
      serviceType: row.tipo_servicio,
      departureDate: row.fecha_salida,
      days: row.dias,
    }
    const order = orders.get(row.id_pedidos)
    order.items.push(item)
    order.total += item.total
  }
  return [...orders.values()]
}

// Comprueba que el backend puede conectarse a Supabase.
app.get('/api/health', async (_req, res) => {
  await db.query('SELECT 1')
  res.json({ status: 'ok' })
})

// Devuelve los viajes guardados en Supabase.
app.get('/api/products', async (_req, res) => {
  const result = await db.query(
    'SELECT * FROM productos WHERE slug IS NOT NULL ORDER BY numero_categoria, slug',
  )
  res.json(result.rows.map(formatProduct))
})

// Solo el jefe de ventas puede cargar productos nuevos.
app.post('/api/products', requireLogin, requireSalesManager, async (req, res) => {
  const name = String(req.body?.name ?? '').trim()
  const type = String(req.body?.type ?? 'Paquete turístico').trim()
  const country = String(req.body?.country ?? '').trim()
  const place = String(req.body?.place ?? '').trim()
  const category = String(req.body?.category ?? '').trim()
  const description = String(req.body?.description ?? '').trim()
  const price = Number(req.body?.price)
  const days = Number(req.body?.days)
  const rating = Number(req.body?.rating ?? 5)
  if (!name || name.length > 255 || !type || type.length > 100 || !country || country.length > 100
      || !place || place.length > 100 || !category || category.length > 100
      || !description || description.length > 2000) {
    throw apiError(400, 'Completa los datos del producto con textos válidos.')
  }
  if (!Number.isFinite(price) || price <= 0 || price > 1000000000
      || !Number.isInteger(days) || days < 1 || days > 365
      || !Number.isFinite(rating) || rating < 0 || rating > 5) {
    throw apiError(400, 'Revisa el precio, la duración y la calificación del producto.')
  }

  const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 80).replace(/-+$/g, '')
  if (!slug) throw apiError(400, 'El nombre no permite crear un identificador válido.')
  const existing = await db.query('SELECT 1 FROM productos WHERE slug = $1', [slug])
  if (existing.rowCount) throw apiError(409, 'Ya existe un producto con ese nombre.')

  let result
  try {
    result = await db.query(
      `INSERT INTO productos
         (codigo, producto, tipo, precio, slug, pais, foto, lugar, dias, rating,
          descripcion, numero_categoria, categoria, clase_categoria, descripcion_categoria)
       VALUES ($1, $2, $3, $4, $5, $6, 'custom-photo', $7, $8, $9, $10, '99', $11, 'custom', $11)
       RETURNING *`,
      [`PROD-${slug}-${Date.now()}`, name, type, price, slug, country, place, days, rating, description, category],
    )
  } catch (error) {
    if (error.code === '23505') throw apiError(409, 'Ya existe un producto con ese nombre.')
    throw error
  }
  res.status(201).json(formatProduct(result.rows[0]))
})

// Crea cuentas con contraseña cifrada y devuelve una sesión.
app.post('/api/auth/register', async (req, res) => {
  const name = String(req.body?.name ?? '').trim()
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  const password = String(req.body?.password ?? '')

  if (name.length < 2 || name.length > 100) {
    throw apiError(400, 'Escribe un nombre de entre 2 y 100 caracteres.')
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw apiError(400, 'Escribe un correo electrónico válido.')
  }
  if (password.length < 8 || password.length > 72) {
    throw apiError(400, 'La contraseña debe tener entre 8 y 72 caracteres.')
  }

  const [firstName, ...lastNameParts] = name.split(/\s+/)
  const passwordHash = await bcrypt.hash(password, 12)
  const result = await db.query(
    `INSERT INTO usuarios (nombre, apellido, email, password_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id_usuarios, nombre, apellido, email, rol`,
    [firstName, lastNameParts.join(' '), email, passwordHash],
  )
  const account = result.rows[0]
  const token = jwt.sign({ sub: String(account.id_usuarios) }, jwtSecret, { expiresIn: '7d' })

  res.status(201).json({
    token,
    user: {
      id: account.id_usuarios,
      name: `${account.nombre} ${account.apellido}`.trim(),
      email: account.email,
      role: account.rol,
    },
  })
})

// Verifica los datos de acceso y devuelve una sesión.
app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  const password = String(req.body?.password ?? '')
  const result = await db.query(
    'SELECT id_usuarios, nombre, apellido, email, password_hash, rol FROM usuarios WHERE email = $1',
    [email],
  )
  const account = result.rows[0]

  if (!account || !(await bcrypt.compare(password, account.password_hash))) {
    throw apiError(401, 'El correo o la contraseña no son correctos.')
  }

  const token = jwt.sign({ sub: String(account.id_usuarios) }, jwtSecret, { expiresIn: '7d' })
  res.json({
    token,
    user: {
      id: account.id_usuarios,
      name: `${account.nombre} ${account.apellido}`.trim(),
      email: account.email,
      role: account.rol,
    },
  })
})

// Crea una reserva pendiente y el enlace de pago de Mercado Pago.
app.post('/api/orders', requireLogin, async (req, res, next) => {
  requireMercadoPago()
  const items = req.body?.items
  if (!Array.isArray(items) || items.length === 0 || items.length > 20) {
    throw apiError(400, 'Agrega entre 1 y 20 viajes a la reserva.')
  }

  const reservations = []
  for (const item of items) {
    const productId = String(item?.productId ?? '').trim()
    const quantity = Number(item?.quantity)
    if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      throw apiError(400, 'La cantidad de viajeros de cada reserva debe ser de 1 a 10.')
    }
    const serviceType = String(item?.serviceType ?? '')
    if (!Object.hasOwn(serviceLabels, serviceType)) {
      throw apiError(400, 'Selecciona un tipo de reserva válido.')
    }
    const departureDate = String(item?.departureDate ?? '')
    if (!isValidDate(departureDate) || departureDate < todayArgentinaDate()) {
      throw apiError(400, 'La fecha de salida debe ser hoy o una fecha futura.')
    }
    const days = Number(item?.days)
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      throw apiError(400, 'La duración debe ser de 1 a 365 días.')
    }
    reservations.push({ productId, quantity, serviceType, departureDate, days })
  }

  const client = await db.connect()
  let transactionOpen = false
  try {
    await client.query('BEGIN')
    transactionOpen = true
    const productIds = [...new Set(reservations.map(reservation => reservation.productId))]
    const productResult = await client.query(
      'SELECT id_productos, slug, producto, precio FROM productos WHERE slug = ANY($1::text[])',
      [productIds],
    )
    if (productResult.rows.length !== productIds.length) {
      throw apiError(400, 'Uno de los viajes ya no está disponible.')
    }

    const products = new Map(productResult.rows.map(product => [product.slug, product]))
    const accountResult = await client.query(
      'SELECT email FROM usuarios WHERE id_usuarios = $1',
      [req.userId],
    )
    const payerEmail = accountResult.rows[0]?.email
    if (!payerEmail) throw apiError(404, 'No se encontró el correo de la cuenta.')

    const pricedReservations = reservations.map(reservation => {
      const product = products.get(reservation.productId)
      const total = Number(product.precio)
        + (reservation.quantity - 1) * extraPassengerDailyRate * reservation.days
      return { ...reservation, product, total }
    })
    const total = pricedReservations.reduce((sum, reservation) => sum + reservation.total, 0)

    const orderResult = await client.query(
      `INSERT INTO pedidos (fecha, estado, id_usuarios)
       VALUES (NOW(), FALSE, $1)
       RETURNING id_pedidos, fecha, estado`,
      [req.userId],
    )
    const order = orderResult.rows[0]
    await client.query(
      'INSERT INTO numero_pedidos (numero_pedidos) VALUES ($1)',
      [order.id_pedidos],
    )

    for (const reservation of pricedReservations) {
      await client.query(
        `INSERT INTO detalles_productos
           (numero_pedidos, cantidad, precio_unitario, id_pedidos, id_productos,
            tipo_servicio, fecha_salida, dias, precio_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          order.id_pedidos,
          reservation.quantity,
          reservation.product.precio,
          order.id_pedidos,
          reservation.product.id_productos,
          reservation.serviceType,
          reservation.departureDate,
          reservation.days,
          reservation.total,
        ],
      )
    }

    const checkoutUrl = await createCheckoutUrl(
      order.id_pedidos,
      pricedReservations.map(reservation => ({
        slug: reservation.product.slug,
        name: reservation.product.producto,
        serviceType: reservation.serviceType,
        departureDate: reservation.departureDate,
        days: reservation.days,
        quantity: reservation.quantity,
        total: reservation.total,
      })),
      payerEmail,
    )

    await client.query('COMMIT')
    transactionOpen = false

    res.status(201).json({
      id: order.id_pedidos,
      total,
      checkoutUrl,
    })
  } catch (error) {
    if (transactionOpen) await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
})

app.get('/api/orders', requireLogin, async (req, res) => {
  res.json(await listOrders(req.userId))
})

app.patch('/api/orders/:orderId/items/:itemId', requireLogin, async (req, res) => {
  const orderId = Number(req.params.orderId)
  const itemId = Number(req.params.itemId)
  const quantity = Number(req.body?.quantity)
  const departureDate = String(req.body?.departureDate ?? '')
  const days = Number(req.body?.days)
  if (!Number.isSafeInteger(orderId) || orderId < 1
      || !Number.isSafeInteger(itemId) || itemId < 1
      || !Number.isInteger(quantity) || quantity < 1 || quantity > 10
      || !isValidDate(departureDate) || departureDate < todayArgentinaDate()
      || !Number.isInteger(days) || days < 1 || days > 365) {
    throw apiError(400, 'Revisa la fecha, duración y cantidad del pedido.')
  }

  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const found = await client.query(
      `SELECT o.estado, o.estado_pedido, d.id_detalles, d.tipo_servicio,
              p.precio, p.slug
       FROM pedidos o
       JOIN detalles_productos d ON d.id_pedidos = o.id_pedidos
       JOIN productos p ON p.id_productos = d.id_productos
       WHERE o.id_pedidos = $1 AND o.id_usuarios = $2 AND d.id_detalles = $3
       FOR UPDATE OF o, d`,
      [orderId, req.userId, itemId],
    )
    const order = found.rows[0]
    if (!order) throw apiError(404, 'No se encontró el producto dentro de tu pedido.')
    if (order.estado || order.estado_pedido !== 'pendiente') {
      throw apiError(409, 'Solo puedes modificar pedidos pendientes de pago.')
    }
    const unitPrice = Number(order.precio)
    const total = unitPrice + (quantity - 1) * extraPassengerDailyRate * days
    await client.query(
      `UPDATE detalles_productos
       SET cantidad = $1, fecha_salida = $2, dias = $3,
           precio_unitario = $4, precio_total = $5
       WHERE id_detalles = $6`,
      [quantity, departureDate, days, unitPrice, total, itemId],
    )
    await client.query('COMMIT')
    res.json({ ok: true })
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
})

app.delete('/api/orders/:orderId', requireLogin, async (req, res) => {
  const orderId = Number(req.params.orderId)
  if (!Number.isSafeInteger(orderId) || orderId < 1) {
    throw apiError(400, 'El número de pedido no es válido.')
  }

  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const found = await client.query(
      'SELECT estado, estado_pedido FROM pedidos WHERE id_pedidos = $1 AND id_usuarios = $2 FOR UPDATE',
      [orderId, req.userId],
    )
    const order = found.rows[0]
    if (!order) throw apiError(404, 'No se encontró el pedido.')
    if (order.estado || order.estado_pedido !== 'pendiente') {
      throw apiError(409, 'Solo puedes eliminar pedidos pendientes de pago.')
    }
    await client.query('DELETE FROM detalles_productos WHERE id_pedidos = $1', [orderId])
    await client.query('DELETE FROM numero_pedidos WHERE numero_pedidos = $1', [orderId])
    await client.query('DELETE FROM pedidos WHERE id_pedidos = $1', [orderId])
    await client.query('COMMIT')
    res.json({ ok: true })
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
})

app.post('/api/orders/:orderId/checkout', requireLogin, async (req, res) => {
  requireMercadoPago()
  const orderId = Number(req.params.orderId)
  if (!Number.isSafeInteger(orderId) || orderId < 1) {
    throw apiError(400, 'El número de pedido no es válido.')
  }
  const orderResult = await db.query(
    `SELECT o.estado, o.estado_pedido, u.email
     FROM pedidos o JOIN usuarios u ON u.id_usuarios = o.id_usuarios
     WHERE o.id_pedidos = $1 AND o.id_usuarios = $2`,
    [orderId, req.userId],
  )
  const order = orderResult.rows[0]
  if (!order) throw apiError(404, 'No se encontró el pedido.')
  if (order.estado || order.estado_pedido !== 'pendiente') {
    throw apiError(409, 'Este pedido ya no está pendiente de pago.')
  }
  const itemsResult = await db.query(
    `SELECT p.slug, p.producto, d.tipo_servicio,
            COALESCE(d.fecha_salida, CURRENT_DATE) AS fecha_salida,
            COALESCE(d.dias, p.dias, 1) AS dias, d.cantidad,
            COALESCE(d.precio_total, d.cantidad * d.precio_unitario) AS precio_total
     FROM detalles_productos d
     JOIN productos p ON p.id_productos = d.id_productos
     WHERE d.id_pedidos = $1 ORDER BY d.id_detalles`,
    [orderId],
  )
  if (itemsResult.rowCount === 0) throw apiError(409, 'El pedido no contiene productos.')
  const items = itemsResult.rows.map(item => ({
    slug: item.slug,
    name: item.producto,
    serviceType: item.tipo_servicio,
    departureDate: item.fecha_salida instanceof Date
      ? item.fecha_salida.toISOString().slice(0, 10)
      : String(item.fecha_salida).slice(0, 10),
    days: Number(item.dias),
    quantity: Number(item.cantidad),
    total: Number(item.precio_total),
  }))
  const checkoutUrl = await createCheckoutUrl(orderId, items, order.email)
  res.json({ checkoutUrl })
})

app.get('/api/sales/orders', requireLogin, requireSalesManager, async (_req, res) => {
  res.json(await listOrders(null))
})

app.patch('/api/sales/orders/:orderId', requireLogin, requireSalesManager, async (req, res) => {
  const orderId = Number(req.params.orderId)
  const status = String(req.body?.status ?? '')
  if (!Number.isSafeInteger(orderId) || orderId < 1
      || !['entregado', 'anulado'].includes(status)) {
    throw apiError(400, 'Selecciona una acción válida para el pedido.')
  }
  const found = await db.query(
    'SELECT estado, estado_pedido FROM pedidos WHERE id_pedidos = $1',
    [orderId],
  )
  const order = found.rows[0]
  if (!order) throw apiError(404, 'No se encontró el pedido.')
  if (order.estado_pedido !== 'pendiente') {
    throw apiError(409, 'El pedido ya fue entregado o anulado.')
  }
  if (status === 'entregado' && !order.estado) {
    throw apiError(409, 'Solo se pueden entregar pedidos con el pago confirmado.')
  }
  await db.query('UPDATE pedidos SET estado_pedido = $1 WHERE id_pedidos = $2', [status, orderId])
  res.json({ ok: true })
})

// Confirma la reserva solo si Mercado Pago aprobó el pago.
app.post('/api/payments/confirm', requireLogin, async (req, res) => {
  requireMercadoPago()
  const paymentId = String(req.body?.paymentId ?? '').trim()
  if (!/^\d+$/.test(paymentId)) {
    throw apiError(400, 'Falta un identificador de pago válido.')
  }

  // Consulta el pago directamente a Mercado Pago; no confía en la URL de retorno.
  const payment = await new Payment(mercadoPagoClient).get({ id: paymentId })
  const orderId = Number(payment.external_reference)
  if (!Number.isSafeInteger(orderId) || orderId < 1) {
    throw apiError(400, 'El pago no está asociado a una reserva válida.')
  }

  const ownerResult = await db.query(
    'SELECT id_pedidos FROM pedidos WHERE id_pedidos = $1 AND id_usuarios = $2',
    [orderId, req.userId],
  )
  if (ownerResult.rowCount === 0) {
    throw apiError(404, 'No se encontró la reserva asociada a este pago.')
  }

  if (payment.status !== 'approved') {
    return res.json({ orderId, status: payment.status || 'pending' })
  }
  if (payment.currency_id !== 'ARS') {
    throw apiError(400, 'La moneda del pago no coincide con la reserva.')
  }

  const client = await db.connect()
  let receipt
  let expectedTotal
  try {
    await client.query('BEGIN')
    const orderResult = await client.query(
      'SELECT estado, estado_pedido, fecha FROM pedidos WHERE id_pedidos = $1 AND id_usuarios = $2 FOR UPDATE',
      [orderId, req.userId],
    )
    const order = orderResult.rows[0]
    if (!order) throw apiError(404, 'No se encontró la reserva asociada a este pago.')
    if (order.estado_pedido === 'anulado') {
      throw apiError(409, 'El pedido fue anulado y no puede confirmarse.')
    }

    const totalResult = await client.query(
      `SELECT COALESCE(SUM(COALESCE(precio_total, cantidad * precio_unitario)), 0)::numeric AS total
       FROM detalles_productos WHERE id_pedidos = $1`,
      [orderId],
    )
    expectedTotal = Number(totalResult.rows[0].total)
    if (Math.round(Number(payment.transaction_amount) * 100) !== Math.round(expectedTotal * 100)) {
      throw apiError(400, 'El importe del pago no coincide con la reserva.')
    }

    const [accountResult, itemsResult] = await Promise.all([
      client.query(
        'SELECT nombre, apellido, email FROM usuarios WHERE id_usuarios = $1',
        [req.userId],
      ),
      client.query(
        `SELECT p.producto, d.cantidad, d.precio_unitario, d.precio_total,
                d.tipo_servicio, d.fecha_salida, d.dias
         FROM detalles_productos d
         JOIN productos p ON p.id_productos = d.id_productos
         WHERE d.id_pedidos = $1
         ORDER BY d.id_detalles`,
        [orderId],
      ),
    ])
    const account = accountResult.rows[0]
    if (!account?.email) throw apiError(404, 'No se encontró el correo de la cuenta.')
    receipt = {
      name: `${account.nombre} ${account.apellido}`.trim(),
      email: account.email,
      date: order.fecha,
      items: itemsResult.rows,
    }

    if (!order.estado) {
      await client.query('UPDATE pedidos SET estado = TRUE WHERE id_pedidos = $1', [orderId])
      await client.query(
        `INSERT INTO ventas (numero_pedidos, precio_total)
         SELECT $1, $2
         WHERE NOT EXISTS (
           SELECT 1 FROM ventas WHERE numero_pedidos = $1
         )`,
        [orderId, expectedTotal],
      )
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  let emailSent = false
  try {
    if (!mailTransport) throw new Error('Configura el servicio SMTP para enviar comprobantes.')
    const itemLines = receipt.items.map(item => {
      const lineTotal = item.precio_total == null
        ? Number(item.precio_unitario) * Number(item.cantidad)
        : Number(item.precio_total)
      const departureDate = item.fecha_salida
        ? new Date(`${item.fecha_salida}T00:00:00.000Z`).toLocaleDateString('es-AR', { timeZone: 'UTC' })
        : 'No especificada'
      const reservation = `${serviceLabels[item.tipo_servicio] || 'Reserva'} · ${departureDate} · ${item.dias || 1} días · ${item.cantidad} viajeros`
      return `${item.producto} — ${reservation} — ${formatMoney(lineTotal)}`
    })
    const itemHtml = receipt.items.map(item => {
      const lineTotal = item.precio_total == null
        ? Number(item.precio_unitario) * Number(item.cantidad)
        : Number(item.precio_total)
      const departureDate = item.fecha_salida
        ? new Date(`${item.fecha_salida}T00:00:00.000Z`).toLocaleDateString('es-AR', { timeZone: 'UTC' })
        : 'No especificada'
      const reservation = `${serviceLabels[item.tipo_servicio] || 'Reserva'} · ${departureDate} · ${item.dias || 1} días · ${item.cantidad} viajeros`
      return `<li>${escapeHtml(item.producto)} — ${escapeHtml(reservation)} — ${formatMoney(lineTotal)}</li>`
    }).join('')
    const approvedAt = payment.date_approved
      ? new Date(payment.date_approved)
      : new Date(receipt.date)
    const date = new Intl.DateTimeFormat('es-AR', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'America/Argentina/Buenos_Aires',
    }).format(approvedAt)

    const delivery = await mailTransport.sendMail({
      from: mailFrom,
      to: receipt.email,
      subject: `Comprobante de pago - Horizonte Travel (reserva #${orderId})`,
      text: [
        `Hola ${receipt.name},`,
        'Tu pago fue aprobado. Este es el comprobante de tu reserva:',
        `Reserva: #${orderId}`,
        `Pago de Mercado Pago: ${paymentId}`,
        `Fecha: ${date}`,
        ...itemLines,
        `Total pagado: ${formatMoney(expectedTotal)}`,
      ].join('\n'),
      html: `<h1>Comprobante de pago</h1>
        <p>Hola ${escapeHtml(receipt.name)}, tu pago fue aprobado.</p>
        <p><strong>Reserva:</strong> #${orderId}<br>
        <strong>Pago de Mercado Pago:</strong> ${escapeHtml(paymentId)}<br>
        <strong>Fecha:</strong> ${escapeHtml(date)}</p>
        <ul>${itemHtml}</ul>
        <p><strong>Total pagado: ${formatMoney(expectedTotal)}</strong></p>
        <p>Gracias por elegir Horizonte Travel.</p>`,
    })
    if (delivery.accepted.length === 0) {
      throw new Error('El servidor SMTP no aceptó el correo de la cuenta.')
    }
    emailSent = true
  } catch (error) {
    console.error(`No se pudo enviar el comprobante de la reserva ${orderId}:`, error)
  }

  res.json({ orderId, status: 'approved', total: expectedTotal, emailSent })
})

app.use(express.static(frontendBuildPath))

// Muestra los errores esperados sin exponer detalles internos de la base.
app.use((error, _req, res, _next) => {
  if (error.code === '23505') {
    return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' })
  }
  if (error.status) {
    return res.status(error.status).json({ error: error.message })
  }

  console.error(error)
  return res.status(500).json({ error: 'Ocurrió un error. Inténtalo de nuevo.' })
})

async function startServer() {
  await db.query('SELECT 1')
  app.listen(port, () => console.log(`Servidor listo en el puerto ${port}`))
}

startServer().catch(error => {
  console.error('No se pudo iniciar el servidor:', error.message)
  process.exitCode = 1
})