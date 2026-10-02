# Backend de Horizonte Travel

El backend usa Node.js, Express, Supabase (PostgreSQL) y el SDK oficial de Mercado Pago. Supabase debe tener creadas las tablas y cargados los viajes antes de iniciar el servidor; el backend no modifica el esquema al arrancar.

## Preparación

1. Instala Node.js 20 o superior.
2. En `backend/.env`, configura la URL de Supabase en `DATABASE_URL` o conserva `VITE_DB_URL` y `VITE_DB_PASSWORD` si ya las tienes.
3. Configura `MERCADO_PAGO_ACCESS_TOKEN` con el access token privado. También se acepta el nombre existente `VITE_MERCADO_PAGO_ACCESS_TOKEN`; el token solo se usa en Node y nunca se envía al navegador.
4. Define `JWT_SECRET` con una clave estable: genera una con `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` y guarda el resultado en `backend/.env`. Si falta, la clave temporal cambia al reiniciar y las sesiones existentes vencen.
5. Ejecuta `npm install` y luego `npm run dev`.

La API queda disponible en `http://localhost:3000`. En desarrollo, Vite reenvía las solicitudes `/api` al backend.

## Rutas

- `GET /api/health`: comprueba que la API y la base estén disponibles.
- `GET /api/products`: muestra los viajes disponibles.
- `POST /api/auth/register`: crea una cuenta y devuelve una sesión.
- `POST /api/auth/login`: inicia sesión.
- `POST /api/orders`: crea una reserva pendiente y una preferencia Checkout Pro; requiere iniciar sesión.
- `POST /api/payments/confirm`: consulta el pago con Mercado Pago y confirma la reserva si fue aprobado.

El navegador se redirige a Mercado Pago para completar el pago. Al volver, el servidor verifica el estado, el importe, la moneda y la cuenta antes de marcar la reserva como pagada. El correo de la cuenta se envía como email del pagador para que Mercado Pago le entregue el comprobante. La vuelta automática solo se activa si `FRONTEND_URL` es una URL pública `https://`; Mercado Pago rechaza `auto_return` con `localhost`. Los access tokens de prueba usan el enlace sandbox del SDK.