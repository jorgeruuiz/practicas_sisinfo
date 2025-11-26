import express from 'express';
import cors from 'cors';
import path from 'path'; // <--- 1. Importar el módulo 'path'

import { 
    crearUsuario, 
    resendVerificationEmail, 
    verifyEmail, 
    login, 
    logout, 
    editUser, 
    sendPasswdReset, 
    resetPasswd,
    changePassword
} from './src/login/login.js';

import {
    sendMessage,
    listMessagesBetween,
    deleteMessage
} from './src/chat/chat.js';
import { getUserByNombreUser, getUserById, getUsersByIds, getQuestionsByTopic } from './src/db/db_requests/db_requests.js';

export const app = express()

// CORRECCIÓN: Cambiado el puerto por defecto de 3000 a 8080
// para que coincida con la configuración de exposición de Docker (8080:8080).
app.set('port', process.env.PORT || 8080) 
app.set('trust proxy', true)
app.use(cors())
app.use(express.json());

// ------------------------------------------------------------------------------------------------
// RUTAS DE LA APLICACIÓN (API REST)
// ------------------------------------------------------------------------------------------------

// ------------------------------------------------------------------------------------------------
// RUTAS DE TRATAMIENTO DE USUARIO
// ------------------------------------------------------------------------------------------------
app.post('/register', async (req, res) => {
    await crearUsuario(req, res);
});

app.post('/resendVerification', async (req, res) => {
    await resendVerificationEmail(req, res);
});

app.get('/verificar', async (req, res) => {
    await verifyEmail(req, res);
});

app.post('/login', async (req, res) => {
    await login(req, res);
});

app.post('/logout', async (req, res) => {
    await logout(req, res);
});

app.post('/editUser', async (req, res) => {
    await editUser(req, res);
});

app.post('/sendPasswdReset', async (req, res) => {
    await sendPasswdReset(req, res);
});

app.post('/tryResetPasswd', async (req, res) => {
    await resetPasswd(req, res);
});

// Cambiar contraseña (requiere contraseña actual)
app.post('/changePassword', async (req, res) => {
    await changePassword(req, res);
});

// ------------------------------------------------------------------------------------------------
// RUTAS DE CHAT ENTRE AMIGOS
// ------------------------------------------------------------------------------------------------
app.post('/chat/sendMessage', async (req, res) => {
    await sendMessage(req, res);
});

app.get('/chat/thread', async (req, res) => {
    await listMessagesBetween(req, res);
});

app.delete('/chat/message/:id', async (req, res) => {
    await deleteMessage(req, res);
});

// Lookup user by username
app.get('/user/byName', async (req, res) => {
    try {
        const name = req.query.name;
        if (!name) return res.status(400).json({ error: 'Missing name query' });
        const u = await getUserByNombreUser(name);
        if (!u) return res.status(404).json({ error: 'User not found' });
        return res.status(200).json({ id: u.id, NombreUser: u.NombreUser, Puntuacion: u.Puntuacion });
    } catch (err) {
        console.error('GET /user/byName error', err);
        return res.status(500).json({ error: 'Internal error' });
    }
});

// Lookup user by id (single)
app.get('/user/byId', async (req, res) => {
    try {
        const id = req.query.id;
        if (!id) return res.status(400).json({ error: 'Missing id query' });
        const u = await getUserById(id);
        if (!u) return res.status(404).json({ error: 'User not found' });
        return res.status(200).json({
            id: u.id,
            NombreUser: u.NombreUser,
            Puntuacion: u.Puntuacion,
            totalGames: u.totalGames || 0,
            totalWins: u.totalWins || 0,
            totalLosses: u.totalLosses || 0,
            totalDraws: u.totalDraws || 0,
            actualStreak: u.actualStreak || 0,
            maxStreak: u.maxStreak || 0
        });
    } catch (err) {
        console.error('GET /user/byId error', err);
        return res.status(500).json({ error: 'Internal error' });
    }
});

// Lookup multiple users by comma-separated ids: /user/byIds?ids=1,2,3
app.get('/user/byIds', async (req, res) => {
    try {
        const raw = req.query.ids || '';
        const ids = raw.split(',').map(s => String(s || '').trim()).filter(Boolean);
        if (ids.length === 0) return res.status(400).json({ error: 'Missing ids query' });
        const rows = await getUsersByIds(ids);
        const users = (rows || []).map(u => ({ id: u.id, NombreUser: u.NombreUser, Puntuacion: u.Puntuacion }));
        return res.status(200).json({ users });
    } catch (err) {
        console.error('GET /user/byIds error', err);
        return res.status(500).json({ error: 'Internal error' });
    }
});

// Obtener preguntas por tematica: /questions/byTopic?topic=Historia&limit=10
app.get('/questions/byTopic', async (req, res) => {
    try {
        const topic = req.query.topic;
        const limit = parseInt(req.query.limit || '10', 10) || 10;
        if (!topic) return res.status(400).json({ error: 'Missing topic query' });
        const rows = await getQuestionsByTopic(topic, limit);
        // map to a clean shape
        const questions = (rows || []).map(q => ({
            id: q.id,
            pregunta: q.pregunta,
            respuesta_correcta: q.respuesta_correcta,
            respuesta_incorrecta1: q.respuesta_incorrecta1,
            respuesta_incorrecta2: q.respuesta_incorrecta2,
            respuesta_incorrecta3: q.respuesta_incorrecta3,
            tematica: q.tematica,
            dificultad: q.dificultad
        }));
        return res.status(200).json({ questions });
    } catch (err) {
        console.error('GET /questions/byTopic error', err);
        return res.status(500).json({ error: 'Internal error' });
    }
});

// ------------------------------------------------------------------------------------------------
// CONFIGURACIÓN PARA SERVIR EL FRONTEND DE REACT
// (static + catch-all debe ir AL FINAL para no interceptar rutas API)
// ------------------------------------------------------------------------------------------------

const buildPath = path.join(path.resolve(), 'public');

// Middleware para servir archivos estáticos (CSS, JS, imágenes, etc.)
app.use(express.static(buildPath));

// Ruta Catch-all (.*): Sirve index.html para el routing de React
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
});