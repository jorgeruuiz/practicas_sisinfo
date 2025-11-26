const { defineConfig } = require('drizzle-kit');
const dotenv = require('dotenv');
const path = require('path');

// Ensure dotenv loads the repo root .env when running drizzle from backend_server
dotenv.config({ path: path.join(__dirname, '..', '.env'), override: false });

module.exports = defineConfig({
  out: './src/db/drizzle',
  schema: './src/db/schemas/*',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.DATABASE_URL,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  },
});