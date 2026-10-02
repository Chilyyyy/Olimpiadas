import dotenv from 'dotenv'
import { Pool } from 'pg'
import { fileURLToPath } from 'node:url'

// Lee la configuración guardada en backend/.env.
dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)) })

// Quita los signos ´ que están al inicio y al final de algunos valores.
const unwrap = (value) => value?.replace(/^´|´$/g, '')
const password = unwrap(process.env.DATABASE_PASSWORD ?? process.env.VITE_DB_PASSWORD)
const urlTemplate = unwrap(process.env.DATABASE_URL ?? process.env.VITE_DB_URL)
const passwordPlaceholder = '${VITE_DB_PASSWORD}'

if (!urlTemplate) {
  throw new Error('Falta DATABASE_URL en backend/.env')
}

if (urlTemplate.includes(passwordPlaceholder) && !password) {
  throw new Error('Falta DATABASE_PASSWORD en backend/.env')
}

// Prepara la contraseña antes de colocarla dentro de la dirección.
const connectionString = urlTemplate.replace(
  passwordPlaceholder,
  encodeURIComponent(password ?? ''),
)

// Mantiene conexiones listas para reutilizarlas en las consultas.
const db = new Pool({ connectionString })

export default db