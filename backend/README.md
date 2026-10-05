# Backend de Horizonte Travel

El backend usa Node.js, Express, Supabase (PostgreSQL) y el SDK oficial de Mercado Pago. Supabase debe tener creadas las tablas y cargados los viajes antes de iniciar el servidor; el backend no modifica el esquema al arrancar.

Ejecuta `schema.sql` en Supabase para crear o actualizar las tablas antes de desplegar. El esquema es idempotente e incorpora a las cuentas el rol, a los pedidos su estado operativo y a los detalles de reserva el tipo de servicio, la fecha de salida, la duración y el total cotizado.

Para habilitar al jefe de ventas, crea primero una cuenta normal desde la página y asigna el rol desde una conexión administrativa a PostgreSQL:

```sql
UPDATE usuarios SET rol = 'jefe_ventas' WHERE email = 'ventas@tu-dominio.com';
```

El rol no se puede elegir en el registro público. La cuenta debe volver a iniciar sesión para utilizar el panel de ventas.

## Preparación local

1. Instala Node.js 22.12.0 o superior.
2. Copia `.env.example` a `.env` y completa `DATABASE_URL`, `MERCADO_PAGO_ACCESS_TOKEN` y `JWT_SECRET`. El envío de comprobantes por correo es opcional. Para habilitarlo con Gmail, configura `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER` con tu dirección y `SMTP_PASS` con una contraseña de aplicación de Google (no la contraseña habitual). `SMTP_FROM` también es opcional; si se omite, se usa `SMTP_USER`.
3. Ejecuta `npm ci` y luego `npm start`. Para desarrollo con reinicio automático, usa `npm run dev`.

La API queda disponible en `http://localhost:10000`. En desarrollo, Vite reenvía las solicitudes `/api` al backend. En Render, el mismo servidor también publica el frontend compilado desde `frontend/dist`.

No guardes credenciales en Git. En Render, configura `DATABASE_URL`, `MERCADO_PAGO_ACCESS_TOKEN` y las credenciales SMTP como variables privadas del servicio; `JWT_SECRET` debe ser estable entre reinicios. Gmail usa `smtp.gmail.com` con el puerto 465 y TLS implícito.

## Rutas

- `GET /api/health`: comprueba que la API y la base estén disponibles.
- `GET /api/products`: muestra los viajes disponibles.
- `POST /api/products`: carga un producto; requiere iniciar sesión como jefe de ventas.
- `POST /api/auth/register`: crea una cuenta y devuelve una sesión.
- `POST /api/auth/login`: inicia sesión.
- `POST /api/orders`: crea una reserva pendiente y una preferencia Checkout Pro; requiere iniciar sesión. Cada detalle recibe `productId`, `serviceType` (`paquete`, `viaje`, `hotel` o `vehiculo`), `departureDate` (`YYYY-MM-DD`), `days` y `quantity` (viajeros).
- `GET /api/orders`: devuelve los pedidos de la cuenta autenticada.
- `PATCH /api/orders/:orderId/items/:itemId`: modifica la cantidad, fecha o duración de un pedido propio pendiente de pago.
- `DELETE /api/orders/:orderId`: elimina un pedido propio pendiente de pago.
- `POST /api/orders/:orderId/checkout`: genera un enlace de pago actualizado después de modificar un pedido pendiente.
- `GET /api/sales/orders`: lista pedidos para el jefe de ventas.
- `PATCH /api/sales/orders/:orderId`: entrega un pedido pagado (`status: "entregado"`) o lo anula (`status: "anulado"`); requiere rol de jefe de ventas.
- `POST /api/payments/confirm`: consulta el pago con Mercado Pago y confirma la reserva si fue aprobado.

El navegador se redirige a Mercado Pago para completar el pago. Al volver, el servidor verifica el estado, el importe, la moneda y la cuenta antes de marcar la reserva como pagada, y envía al email de esa cuenta un comprobante con el detalle de la compra. El correo de la cuenta también se envía como email del pagador a Mercado Pago. Si el envío SMTP no está configurado o falla, el pago permanece aprobado y la interfaz informa que no se pudo enviar el comprobante. La URL de retorno se toma de `FRONTEND_URL` y, si no se define, de `RENDER_EXTERNAL_URL`; la vuelta automática solo se activa con una URL pública `https://`. Los access tokens de prueba usan el enlace sandbox del SDK.

El precio se calcula en el servidor con el precio vigente del destino para el primer viajero y suma $200.000 por cada viajero adicional por día. La fecha de salida debe ser hoy o futura y la duración debe estar entre 1 y 365 días.

La anulación cambia el estado operativo del pedido y no inicia un reembolso en Mercado Pago. Si el pedido ya está pagado, gestiona cualquier reembolso desde Mercado Pago.
