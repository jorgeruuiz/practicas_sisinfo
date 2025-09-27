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

export const app = express()

app.set('port', process.env.PORT || 3000)
app.set('trust proxy', true)

app.use(cors())
// Middleware para parsear JSON
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
// RUTAS DE USUARIO
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