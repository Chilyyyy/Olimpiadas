# Backend de Horizonte Travel

El backend usa Node.js, Express, Supabase (PostgreSQL) y el SDK oficial de Mercado Pago. Supabase debe tener creadas las tablas y cargados los viajes antes de iniciar el servidor; el backend no modifica el esquema al arrancar.

## Preparación local

1. Instala Node.js 22.12.0 o superior.
2. Copia `.env.example` a `.env` y completa `DATABASE_URL`, `MERCADO_PAGO_ACCESS_TOKEN` y `JWT_SECRET`.
3. Ejecuta `npm ci` y luego `npm start`. Para desarrollo con reinicio automático, usa `npm run dev`.

La API queda disponible en `http://localhost:10000`. En desarrollo, Vite reenvía las solicitudes `/api` al backend. En Render, el mismo servidor también publica el frontend compilado desde `frontend/dist`.

No guardes credenciales en Git. En Render, configura `DATABASE_URL` y `MERCADO_PAGO_ACCESS_TOKEN` como variables privadas del servicio; `JWT_SECRET` debe ser estable entre reinicios.

## Rutas

- `GET /api/health`: comprueba que la API y la base estén disponibles.
- `GET /api/products`: muestra los viajes disponibles.
- `POST /api/auth/register`: crea una cuenta y devuelve una sesión.
- `POST /api/auth/login`: inicia sesión.
- `POST /api/orders`: crea una reserva pendiente y una preferencia Checkout Pro; requiere iniciar sesión.
- `POST /api/payments/confirm`: consulta el pago con Mercado Pago y confirma la reserva si fue aprobado.

El navegador se redirige a Mercado Pago para completar el pago. Al volver, el servidor verifica el estado, el importe, la moneda y la cuenta antes de marcar la reserva como pagada. El correo de la cuenta se envía como email del pagador para que Mercado Pago le entregue el comprobante. La URL de retorno se toma de `FRONTEND_URL` y, si no se define, de `RENDER_EXTERNAL_URL`; la vuelta automática solo se activa con una URL pública `https://`. Los access tokens de prueba usan el enlace sandbox del SDK.
