import express from 'express';
import cors from 'cors';
import { 
    crearUsuario, 
    resendVerificationEmail, 
    verifyEmail, 
    login, 
    logout, 
    editUser, 
    sendPasswdReset, 
    resetPasswd 
} from './src/login/login.js';

import {
    sendMessage,
    listMessagesBetween,
    deleteMessage
} from './src/chat/chat.js';
import { getUserByNombreUser } from './src/db/db_requests/db_requests.js';

export const app = express()

app.set('port', process.env.PORT || 3000)
app.set('trust proxy', true)
app.use(cors())
app.use(express.json());

// Ruta de prueba
app.get("/", (req, res) => {
    res.send("Servidor de la app de Cuestionados activo!");
});

// ------------------------------------------------------------------------------------------------
// RUTAS DE LA APLICACIÓN
// ------------------------------------------------------------------------------------------------
// Cada ruta maneja una funcionalidad específica de la aplicación
// Las rutas están organizadas por categorías: usuario, partidas, amigos, etc.
// Cada ruta llama a una función en un archivo separado que maneja la lógica de negocio
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