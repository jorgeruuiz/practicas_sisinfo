import { db } from '../db/db.js';
import { usuario } from '../db/schemas/schemas.js';
import { eq } from 'drizzle-orm';
import crypto, { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { sendVerificationEmail, sendChangePasswdEmail } from './tokenSender.js';
import { httpRespuestaWebPositiva, httpRespuestaWebNegativa } from './htmlEnviables.js';
import { activeSockets } from '../../server.js';
import { ActiveXObjects } from '../rooms/rooms.js';

// Generar un token de verificación para el correo
const generateVerificationToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
};

// Generar un token de acceso para el usuario
const generateAccessToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
};

// Creación de un usuario nuevo y envío de un correo de verificación al correo proporcionado
// -----------------------------------------------------------------------------------------
export async function crearUsuario(req, res) {
    try {
        const NombreUser = req.body.NombreUser;
        const Correo = req.body.Correo;
        const Contrasena = req.body.Contrasena;

        if (!NombreUser || !Correo || !Contrasena) {
            res.status(400).json({ error: 'Faltan campos' });
            return
        }

        // Verificar si el correo ya está en uso
        const correoExistente = await db.select().from(usuario).where(eq(usuario.Correo, Correo));
        if (correoExistente.length > 0) {
            res.status(400).json({ error: 'El correo ya está en uso' });
            return
        }
        // Verificar que los campos tengan al menos 4 caracteres
        if (Contrasena.length < 4) {
            res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
            return
        }
        if (NombreUser.length < 4) {
            res.status(400).json({ error: 'El nombre de usuario debe tener al menos 4 caracteres' });
            return
        }

        // Hashear la contraseña antes de almacenarla
        const hashedPassword = await bcrypt.hash(Contrasena, 10);
        // Crear un identificador único para el usuario
        const id = uuidv4();
        // Crear un token de verificación para el correo 
        const token = generateVerificationToken(id)

        // Insertar el usuario en la base de datos
        await db.insert(usuario).values({
            id: id,
            FotoPerfil: null,
            NombreUser: NombreUser,
            Correo: Correo,
            Contrasena: hashedPassword,
            estadoUser: "unlogged",
            correoVerificado: "no",
            tokenVerificacion: token
        });

        // Enviar correo de verificación
        await sendVerificationEmail(Correo, token);
        console.log(token);
        res.json({ message: 'Registro exitoso. Revisa tu correo para verificar tu cuenta. ¡Ten cuidado!, el correo ha podido ser clasificado como spam.' });

    } catch (error) {
        console.log(error.message);
        res.status(400).json({ error: "Error al crear el usuario" });
    }
}

// Reenviar el correo de verificación al usuario
// -----------------------------------------------------------------------------------------
export async function resendVerificationEmail(req, res) {
    try {
        const Correo = req.body.Correo;
        if (!Correo) {
            res.status(400).json({ error: 'Faltan campos' });
            return;
        }
        // Verificar si el correo ya está en uso
        const correoExistente = await db.select().from(usuario).where(eq(usuario.Correo, Correo));
        if (correoExistente.length === 0) {
            res.status(400).json({ error: 'El correo no está registrado' });
            return;
        }
        const user = correoExistente[0];
        if (user.correoVerificado === 'yes') {
            res.status(400).json({ error: 'El correo ya ha sido verificado' });
            return;
        }
        // Crear un token de verificación para el correo
        const token = generateVerificationToken(user.id);
        // Actualizar el token de verificación en la base de datos
        await db.update(usuario).set({ tokenVerificacion: token }).where(eq(usuario.Correo, Correo));
        // Enviar correo de verificación
        await sendVerificationEmail(Correo, token);
        res.json({ message: 'Correo de verificación reenviado. ¡Ten cuidado!, el correo ha podido ser clasificado como spam.' });
    } catch (error) {
        res.status(500).json({ error: 'Error al reenviar el correo de verificación' });
    }
}

// Verificar el token de verificación del correo
// -----------------------------------------------------------------------------------------
export async function verifyEmail(req, res) {
    const token = req.query.token;
    const tokenString = String(token);

    // Validar que el token tiene tres partes (Header, Payload, Signature)
    if (!tokenString || tokenString.split('.').length !== 3) {
        return res.status(400).json({ error: 'Token malformado o inválido' });
    }

    try {
        console.log("Token recibido:", tokenString);
        const decoded = jwt.verify(tokenString, process.env.JWT_SECRET);
        const id = decoded.userId;

        // Actualiza la base de datos para marcar el email como verificado
        await db.update(usuario).set({ correoVerificado: 'yes' }).where(eq(usuario.id, id));

        res.send(httpRespuestaWebPositiva);
    } catch (error) {
        console.log("Error al verificar el token:", error.message);
        res.status(400).send(httpRespuestaWebNegativa);
    }
};

// Iniciar sesión con el usuario y verificar la contraseña
// -----------------------------------------------------------------------------------------
export async function login(req, res) {
    try {
        const NombreUser = req.body.NombreUser;
        const Contrasegna = req.body.Contrasena;

        if (!NombreUser || !Contrasegna) {
            res.status(400).json({ error: 'Faltan campos' });
            return;
        }

        const usuarios = await db.select().from(usuario).where(eq(usuario.NombreUser, NombreUser));
        if (usuarios.length === 0) {
            res.status(400).json({ error: 'Usuario no encontrado' });
            return;
        }

        const user = usuarios[0];

        // Comparar la contraseña hasheada con la ingresada
        const isMatch = await bcrypt.compare(Contrasegna, user.Contrasena);
        if (!isMatch) {
            res.status(400).json({ error: 'Contraseña incorrecta' });
            return;
        }

        // Comprobar si el correo del usuario ha sido verificado
        if (user.correoVerificado === 'no') {
            res.status(400).json({
                error: "Correo no verificado. Por favor, verifica tu correo antes de iniciar sesión"
            });
            return;
        }

        // Creacion del token de inicio de sesión
        const accessToken = generateAccessToken(user.id);

        // Actualizar el estado de sesión
        await db.update(usuario).set({ estadoUser: 'logged' }).where(eq(usuario.NombreUser, NombreUser));

        // Establecer en user el estado de sesión
        user.estadoUser = 'logged';
        const { Contrasena, tokenPasswd, tokenVerificacion, ...publicUser } = user;

        // Enviar el usuario y el token de acceso
        res.send({ mensaje: "Login exitoso", publicUser, accessToken });
        
        console.log(`Usuario ${user.NombreUser} ha iniciado sesión.`);

    } catch (error) {
        res.status(500).json({ error: 'Error al loguear el usuario' });
    }
}

// Función para autenticar un socket, comprobando que el token JWT es válido para ese usuario
// (este token se envía al cliente cuando el login ha sido exitoso)
// -----------------------------------------------------------------------------------------------
export async function authenticate(socket) {
    console.log("Autenticando usuario... con socket: " + socket.id);
    try {
        // Extraer el token de las query params (ej: io('http://localhost:3000?token=abc123'))
        const token = socket.handshake.query.token;

        // Si no se ha proporcionado un token, desconectar el socket
        if (!token) {
            console.error('No se ha proporcionado un token de autenticación, enviando desconexión...');
            socket.disconnect();
            return;
        }

        // Verificar y decodificar el token
        const decoded = jwt.decode(token);
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        console.log("Token verificado, el id del usuario es: " + JSON.stringify(verified.userId));

        const userId = decoded.userId;

        // Si ya existe un socket activo para este usuario (sesión activa), lo desconectamos
        // (solo permitimos una sesión por usuario)
        if (activeSockets.has(userId)) {
            const existingSocket = activeSockets.get(userId);
            console.log(`El usuario ${userId} ya tiene una sesión activa, desconectando el socket 
                ${existingSocket.id}...`);
            existingSocket.disconnect();
        }
        activeSockets.set(userId, socket);
        console.log(`Usuario ${userId} autenticado con socket ${socket.id}`);

    } catch (error) {
        console.error('Error al autenticar el socket:', error.message);
        socket.disconnect();
    }
}

// Cerrar sesión del usuario y eliminar el socket activo
// -----------------------------------------------------------------------------------------
export async function logout(req, res) {
    try {
        const NombreUser = req.body.NombreUser;
        console.log('Usuario: ', NombreUser, ' cerrando sesión...');

        if (!NombreUser) {
            res.status(400).json({ error: 'Faltan campos' });
            return;
        }

        // Recuperar el id del usuario
        const usuarios = await db.select().from(usuario).where(eq(usuario.NombreUser, NombreUser));
        if (usuarios.length === 0) {
            console.error("Usuario no encontrado en la base de datos");
            res.status(400).json({ error: 'Usuario no encontrado' });
            return;
        }
        const usuarioEncontrado = usuarios[0];
        await db.update(usuario).set({ estadoUser: 'unlogged' }).where(eq(usuario.NombreUser, NombreUser));

        // Desconectar el socket del usuario y eliminarlo de la lista de sockets activos
        activeSockets.delete(usuarioEncontrado.id);
        res.send('Usuario deslogueado correctamente');
    } catch (error) {
        res.status(500).json({ error: 'Error al desloguear el usuario' });
    }
}

// Editar el perfil del usuario
// -----------------------------------------------------------------------------------------
export async function editUser(req, res) {
    try {
        const id = req.body.id;
        const NombreUser = req.body.NombreUser;
        const FotoPerfil = !req.body.FotoPerfil ? 'none' : req.body.FotoPerfil;

        if (!id) {
            res.status(400).json({ error: 'Falta el id del usuario' });
            return;
        }
        if (!NombreUser || !FotoPerfil) {
            res.status(400).json({ error: 'Faltan campos' });
            return;
        }

        // Verificar que los campos tengan al menos 4 caracteres
        if (NombreUser.length < 4) {
            res.status(400).json({ error: 'El nombre de usuario debe tener al menos 4 caracteres' });
            return;
        }
        if (FotoPerfil.length < 4) {
            res.status(400).json({ error: 'La foto de perfil debe tener al menos 4 caracteres' });
            return;
        }

        // Buscar el usuario a editar
        const usuarios = await db.select().from(usuario).where(eq(usuario.id, id));
        if (usuarios.length === 0) {
            res.status(400).json({ error: 'Usuario no encontrado' });
            return;
        }
        const user = usuarios[0];
        if (user.estadoUser !== 'logged') {
            res.status(400).json({ error: 'Usuario no logueado. Inicie sesión para editar su perfil' });
            return;
        }
        if (user.correoVerificado === 'no') {
            res.status(400).json({ error: 'Correo no verificado. Por favor, verifica tu correo antes de editar tu perfil' });
            return;
        }

        // Modificar el usuario en la base de datos
        await db.update(usuario)
            .set({
                NombreUser: NombreUser,
                FotoPerfil: FotoPerfil,
            })
            .where(eq(usuario.id, id));
        user.FotoPerfil = FotoPerfil;
        user.NombreUser = NombreUser;
        const { Contrasena, tokenPasswd, tokenVerificacion, ...publicUser } = user;
        res.send({ mensaje: 'Usuario editado correctamente', publicUser });
    } catch (error) {
        res.status(500).json({ error: 'Error al editar el usuario' });
    }
}

// Enviar un correo de restablecimiento de contraseña
// -----------------------------------------------------------------------------------------
export async function sendPasswdReset(req, res) {
    try {
        const Correo = req.body.Correo;
        if (!Correo) {
            res.status(400).json({ error: 'Faltan campos' });
            return;
        }
        const usuarios = await db.select().from(usuario).where(eq(usuario.Correo, Correo));
        if (usuarios.length === 0) {
            res.status(400).json({ error: 'Correo no registrado' });
            return;
        }
        const user = usuarios[0];
        if (user.correoVerificado == 'no') {
            res.status(400).json({ error: 'El usuario debe haber verificado su correo para restablecer la contraseña.' });
            return;
        }
        // Crear un token de verificación para el correo de 9 caracteres
        const token = randomUUID().slice(0, 9);
        const hashedToken = await bcrypt.hash(token, 10);
        await db.update(usuario).set({ tokenPasswd: hashedToken }).where(eq(usuario.Correo, Correo));
        await sendChangePasswdEmail(Correo, token);
        res.json({ message: 'Correo de restablecimiento de contraseña enviado. ¡Ten cuidado!, el correo ha podido ser clasificado como spam.' });
    } catch (error) {
        res.status(500).json({ error: 'Error al enviar el correo de restablecimiento de contraseña' });
    }
}

// -----------------------------------------------------------------------------------------
// Restablecer la contraseña del usuario
// -----------------------------------------------------------------------------------------
export async function resetPasswd(req, res) {
    try {
        const token = req.body.token;
        const user = req.body.NombreUser;
        const Contrasegna = req.body.Contrasena;
        if (!token || !Contrasegna || !user) {
            res.status(400).json({ error: 'Faltan campos' });
            return;
        }
        if (Contrasegna.length < 4) {
            res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
            return;
        }
        const usuarios = await db.select().from(usuario).where(eq(usuario.NombreUser, user));
        if (usuarios.length === 0) {
            res.status(400).json({ error: 'Correo no registrado' });
            return;
        }
        const userAux = usuarios[0];
        if (userAux.correoVerificado === 'no') {
            res.status(400).json({ error: 'El usuario debe haber verificado su correo para restablecer la contraseña.' });
            return;
        }
        // Comparar el token de restablecimiento de contraseña
        const isMatch = await bcrypt.compare(token, userAux.tokenPasswd);
        if (!isMatch) {
            res.status(400).json({ error: 'Token incorrecto, no se reestablecerá la contraseña.' });
            return;
        }
        const hashedPassword = await bcrypt.hash(Contrasegna, 10);
        await db.update(usuario).set({ Contrasena: hashedPassword }).where(eq(usuario.id, userAux.id));
        res.json({ message: 'Contraseña restablecida correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al restablecer la contraseña' });
    }
}