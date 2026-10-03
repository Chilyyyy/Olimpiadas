# Olimpiadas

Horizonte Travel es una aplicación React/Vite con una API Node/Express, PostgreSQL en Supabase y pagos con Mercado Pago.

## Requisitos

- Node.js 22.12.0 (versión fijada en `.node-version`).
- Una base PostgreSQL de Supabase con las tablas y los viajes requeridos por la API.
- Un access token privado de Mercado Pago para habilitar los pagos.

## Desarrollo local

1. Copia `backend/.env.example` a `backend/.env` y completa `DATABASE_URL`, `MERCADO_PAGO_ACCESS_TOKEN` y `JWT_SECRET`. Puedes generar el secreto JWT con `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
2. Instala dependencias y arranca la API:

   ```sh
   npm ci --prefix backend
   npm start --prefix backend
   ```

3. En otra terminal, instala dependencias y arranca Vite:

   ```sh
   npm ci --prefix frontend
   npm run dev --prefix frontend
   ```

Vite reenvía las solicitudes `/api` al backend local. La API también está disponible en `http://localhost:10000`.

## Despliegue en Render

El archivo `render.yaml` define un único Web Service para compilar el frontend y servirlo junto con la API.

1. Sube el repositorio a GitHub sin incluir archivos `.env` ni credenciales.
2. En Render, crea un Blueprint y conecta el repositorio. Render leerá `render.yaml`.
3. Al crear el servicio, completa `DATABASE_URL` con la URL de PostgreSQL de Supabase y `MERCADO_PAGO_ACCESS_TOKEN` con el access token privado de Mercado Pago. Render genera `JWT_SECRET` y el servicio usa automáticamente `RENDER_EXTERNAL_URL` para los retornos de pago.
4. Espera a que termine el despliegue y verifica `https://<tu-servicio>.onrender.com/api/health`.

El endpoint de salud requiere que Render pueda conectarse a la base de datos. Configura Supabase para permitir esa conexión y crea allí el esquema y los datos antes de desplegar. No guardes secretos en GitHub ni en variables `VITE_*`; las variables privadas se configuran en Render.

## Equipo

Axel Inclan, Germán Fredes, Lucas Martín Pirola y Alejandro Gauna.
