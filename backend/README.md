# Backend de Horizonte Travel

Para que la parte de ventas funcione necesitamos tener **Node.js**, **Supabase** y **Mercado Pago** configurados.

Primero ejecutamos el archivo `schema.sql` en Supabase para crear las tablas.

Después, en la carpeta `backend`, copiamos `.env.example` y lo cambiamos a `.env`. Ahí ponemos los datos de Supabase, Mercado Pago y una clave secreta.

Para instalar y arrancar el backend:

```sh
npm ci
npm start
```

El servidor queda funcionando en:

`http://localhost:10000`

Para usar el **panel de ventas**, primero creamos una cuenta normal desde la página. Después le damos el rol de `jefe_ventas` desde Supabase:

```sql
UPDATE usuarios SET rol = 'jefe_ventas'
WHERE email = 'ventas@olimpiadas-programacion2026.onrender.com';
```

Después cerramos sesión y volvemos a entrar. Con eso ya podemos entrar al panel y **ver las ventas, entregar pedidos o anularlos**.
