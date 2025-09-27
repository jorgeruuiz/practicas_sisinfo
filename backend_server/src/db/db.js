import '../config/dotenv-config.js'
import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'

const client = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN
})

export const db = drizzle({
  client,
  schema: {
    // ...amistad,
    // ...apertura,
    // ...mensaje,
    // ...partida,
    // ...ranking,
    // ...reto,
    // ...usuario
  }
})