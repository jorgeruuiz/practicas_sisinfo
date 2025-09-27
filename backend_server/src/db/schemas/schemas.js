import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { sql } from "drizzle-orm";

// ------------------------------------------------------------------------------------------------
// SCHEMAS DE LA BASE DE DATOS
// ------------------------------------------------------------------------------------------------
// Cada schema representa una tabla en la base de datos
// Se definen los campos y sus tipos, así como las relaciones entre tablas
// ------------------------------------------------------------------------------------------------

// ------------------------------------------------------------------------------------------------
// Definición de las tablas
// ------------------------------------------------------------------------------------------------

// ------------------------------------------------------------------------------------------------
// USUARIO
// ------------------------------------------------------------------------------------------------
export const usuario = sqliteTable('usuario', {
    id: text('id').primaryKey(),
    created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
    FotoPerfil: text('FotoPerfil'),
    NombreUser: text('NombreUser').unique(),
    Correo: text('Correo').unique(),
    Contrasena: text('Contrasena').notNull(),
    EstadoPartida: text('EstadoPartida'),
    Amistades: integer('Amistades'),
    Puntuacion: integer('Puntuacion').default(1200),
    correoVerificado: text('correoVerificado'),
    estadoUser: text('estadoUser'),
    tokenVerificacion: text('tokenVerificacion'),
    tokenPasswd: text('tokenPasswd'),
    totalGames: integer('totalGames').default(0),
    totalWins: integer('totalWins').default(0),
    totalLosses: integer('totalLosses').default(0),
    totalDraws: integer('totalDraws').default(0),
    actualStreak: integer('actualStreak').default(0),
    maxStreak: integer('maxStreak').default(0),
    lastOnline: integer('lastOnline').default(0)
})

// Uso de zod internamente para validar los datos
export const userSelectSchema = createSelectSchema(usuario).partial()
export const userInsertSchema = createInsertSchema(usuario).partial()

// ------------------------------------------------------------------------------------------------
// PARTIDA
// ------------------------------------------------------------------------------------------------
export const partidaCompetitiva = sqliteTable('partidaCompetitiva', {
    id: text('id').primaryKey(),
    created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
    Jugador1: text('Jugador1').references(() => usuario.id),
    Jugador2: text('Jugador2').references(() => usuario.id),
    Ganador: text('Ganador').references(() => usuario.id),
    Variacion_J1: integer('Variacion_J1'),
    Variacion_J2: integer('Variacion_J2')
})

export const partidaSelectSchema = createSelectSchema(partidaCompetitiva).partial()
export const partidaInsertSchema = createInsertSchema(partidaCompetitiva).partial()

// ------------------------------------------------------------------------------------------------
// PREGUNTAS
// ------------------------------------------------------------------------------------------------
export const preguntas = sqliteTable('preguntas', {
    id: text('id').primaryKey(),
    created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
    pregunta: text('pregunta').notNull(),
    respuesta_correcta: text('respuesta_correcta').notNull(),
    respuesta_incorrecta1: text('respuesta_incorrecta1').notNull(),
    respuesta_incorrecta2: text('respuesta_incorrecta2').notNull(),
    respuesta_incorrecta3: text('respuesta_incorrecta3').notNull(),
    tematica: text('tematica').notNull(),
    dificultad: text('dificultad').notNull()
})

export const preguntasSelectSchema = createSelectSchema(preguntas).partial()
export const preguntasInsertSchema = createInsertSchema(preguntas).partial()