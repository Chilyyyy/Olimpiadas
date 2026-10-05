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
     RETURNING id_usuarios, nombre, apellido, email`,
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
    },
  })
})

// Verifica los datos de acceso y devuelve una sesión.
app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  const password = String(req.body?.password ?? '')
  const result = await db.query(
    'SELECT id_usuarios, nombre, apellido, email, password_hash FROM usuarios WHERE email = $1',
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

    // El servidor usa precios de Supabase y el correo de la cuenta.
    const returnUrl = new URL('/?payment=return', frontendUrl).toString()
    const canAutoReturn = new URL(frontendUrl).protocol === 'https:'
    const preference = await new Preference(mercadoPagoClient).create({
      body: {
        items: pricedReservations.map((reservation, index) => ({
          id: `${reservation.product.slug}-${index + 1}`,
          title: `${reservation.product.producto.slice(0, 160)} - ${serviceLabels[reservation.serviceType]} - ${reservation.departureDate} - ${reservation.days} días - ${reservation.quantity} viajeros`,
          quantity: 1,
          unit_price: reservation.total,
          currency_id: 'ARS',
        })),
        payer: { email: payerEmail },
        external_reference: String(order.id_pedidos),
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

    if (!checkoutUrl) {
      throw apiError(502, 'Mercado Pago no devolvió un enlace de pago.')
    }

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
      'SELECT estado, fecha FROM pedidos WHERE id_pedidos = $1 AND id_usuarios = $2 FOR UPDATE',
      [orderId, req.userId],
    )
    const order = orderResult.rows[0]
    if (!order) throw apiError(404, 'No se encontró la reserva asociada a este pago.')

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