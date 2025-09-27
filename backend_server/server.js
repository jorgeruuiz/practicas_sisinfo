const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());



// Configuración de conexión a la base de datos PostgreSQL
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'Cuestionados',
    password: 'cuestionados&123',
    port: 5432,
});

// Sirve los archivos estáticos desde la carpeta 'public'
app.use(express.static('public'));

// Nueva ruta para servir imágenes desde una ruta completa almacenada en la base de datos
app.get('/imagen', (req, res) => {
    const rutaCompleta = req.query.path;  // Se espera que la URL contenga ?path=CAMINO_COMPLETO_DE_LA_IMAGEN

    if (rutaCompleta) {
        res.sendFile(path.resolve(rutaCompleta));
    } else {
        res.status(400).send('Ruta de imagen no proporcionada.');
    }
});
// Ruta para servir el archivo HTML principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Ruta de registro de usuario
app.post('/register', async (req, res) => {
    const { nombre, correo, contrasena } = req.body; // Asegúrate de usar 'contrasena' y no 'contraseña'
    const permiso = false; // Valor predeterminado para permiso
    const puntos = 0; // Valor predeterminado para los puntos
    try {
        // Cifrar la contraseña antes de guardarla en la base de datos
        const hashedPassword = await bcrypt.hash(contrasena, 10);
        
        const result = await pool.query(
            'INSERT INTO "Usuario" ("Nombre", "Correo", "Permiso", "Puntos", "Contrasena") VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [nombre, correo, permiso, puntos, hashedPassword]
        );
        
        res.json({ user: result.rows[0] });
    } catch (error) {
        console.error("Error al registrar usuario:", error); // Mostrar error detallado en la terminal
        res.status(500).json({ message: 'Error al registrar usuario' });
    }
});

// Ruta de inicio de sesión
// Ruta de inicio de sesión
// Ruta de inicio de sesión (server.js)
app.post('/login', async (req, res) => {
    const { correo, contrasena } = req.body;

    try {
        // Verificar si el usuario existe en la base de datos
        const result = await pool.query('SELECT * FROM "Usuario" WHERE "Correo" = $1', [correo]);

        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Usuario no encontrado' });
        }

        const user = result.rows[0];

        // Comparar la contraseña ingresada con la almacenada
        const isPasswordMatch = await bcrypt.compare(contrasena, user.Contrasena);

        if (!isPasswordMatch) {
            return res.status(401).json({ message: 'Contraseña incorrecta' });
        }

        // Generar un token JWT para el usuario
        const token = jwt.sign({ id: user.id, nombre: user.Nombre }, 'clave_secreta', { expiresIn: '1h' });

        // Enviar el token y el userId al frontend
        res.json({ message: 'Inicio de sesión exitoso', token, userId: user.id });
    } catch (error) {
        console.error("Error al iniciar sesión:", error);
        res.status(500).json({ message: 'Error al iniciar sesión' });
    }
});


// Ruta para obtener el ranking de jugadores
app.get('/ranking', async (req, res) => {
    try {
        // Consulta a la base de datos para obtener a los usuarios ordenados por puntos (de mayor a menor)
        const result = await pool.query('SELECT "Nombre", "Puntos" FROM "Usuario" ORDER BY "Puntos" DESC LIMIT 10');

        res.json(result.rows); // Devolver los 10 mejores jugadores en formato JSON
    } catch (error) {
        console.error("Error al obtener el ranking:", error);
        res.status(500).json({ message: 'Error al obtener el ranking de jugadores' });
    }
});

// Iniciar el servidor en el puerto 3000
app.listen(3000, () => {
    console.log('Servidor corriendo en http://localhost:3000');
});


// Crear una partida competitiva
// server.js

// Crear una partida competitiva
// Crear una partida competitiva
app.post('/crear-partida', async (req, res) => {
    const { usuarioId, tematicaId, competitiva } = req.body; // Cambiar a tematicaId

    try {
        // Crear una nueva partida en la base de datos
        const result = await pool.query(`
            INSERT INTO public."Partida" ("Competitiva", "Fecha")
            VALUES ($1, $2) RETURNING "IdPartida"
        `, [competitiva, new Date()]);

        const idPartida = result.rows[0].IdPartida;

        // Guardar qué usuario participa en la partida
        await pool.query(`
            INSERT INTO public."ParticipaEn" ("IDUsuario", "IDPartida")
            VALUES ($1, $2)
        `, [usuarioId, idPartida]);

        await pool.query(`
            INSERT INTO public."SeBasaEn" ("IdPart", "id_Tematica")
            VALUES ($1, $2)
        `, [idPartida, tematicaId]);

        // Obtener 20 preguntas aleatorias de la temática seleccionada
        const preguntasResult = await pool.query(`
            SELECT * FROM public."Preguntas"
            WHERE "idTematica" = $1
            ORDER BY random() LIMIT 20
        `, [tematicaId]);

        const preguntas = preguntasResult.rows;

        if (preguntas.length === 0) {
            console.log(`No se encontraron preguntas para la temática con ID: ${tematicaId}`);
            return res.status(400).json({ message: 'No hay preguntas disponibles para esta temática' });
        }

        // Registrar las preguntas que se han seleccionado para la partida
        for (let pregunta of preguntas) {
            await pool.query(`
                INSERT INTO public."Tiene" ("IDP", "IDpreg")
                VALUES ($1, $2)
            `, [idPartida, pregunta.idPregunta]);
        }

        // Enviar la respuesta al frontend
        res.json({ message: 'Partida creada exitosamente', idPartida, preguntas });

    } catch (error) {
        console.error("Error al crear la partida:", error);
        res.status(500).json({ message: 'Error al crear la partida' });
    }
});

  


// Obtener 20 preguntas aleatorias de una temática
app.get('/preguntas/:tematicaId', async (req, res) => {
    const { tematicaId } = req.params;
    
    try {
        const result = await pool.query(
            'SELECT * FROM "Preguntas" WHERE "idTematica" = $1 ORDER BY RANDOM() LIMIT 20',
            [tematicaId]
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener preguntas:', error);
        res.status(500).json({ message: 'Error al obtener preguntas' });
    }
});

// Registrar una respuesta del usuario
app.post('/responder', async (req, res) => {
    const { partidaId, preguntaId, userId, respuesta } = req.body;

    try {
        // Verificar si el registro ya existe
        const checkQuery = `
            SELECT * FROM public."Tiene" WHERE "IDP" = $1 AND "IDpreg" = $2
        `;
        const checkResult = await pool.query(checkQuery, [partidaId, preguntaId]);

        if (checkResult.rows.length === 0) {
            // Si no existe, insertarlo
            const insertQuery = `
                INSERT INTO public."Tiene" ("IDP", "IDpreg") VALUES ($1, $2)
            `;
            await pool.query(insertQuery, [partidaId, preguntaId]);
        } else {
            console.log("La pregunta ya ha sido registrada para esta partida.");
        }

        // Aquí se asume que estás verificando si la respuesta del usuario es correcta
        const correcta = await verificarRespuesta(preguntaId, respuesta); // Esta función debería verificar si la respuesta es correcta
        
        // Actualizar los puntos del usuario en función de si la respuesta es correcta o incorrecta
        if (correcta) {
            await pool.query('UPDATE public."Usuario" SET "Puntos" = "Puntos" + 1 WHERE "id" = $1', [userId]);
        } else {
            await pool.query('UPDATE public."Usuario" SET "Puntos" = "Puntos" - 1 WHERE "id" = $1', [userId]);
        }

        // Enviar la respuesta al cliente
        res.json({ correcta }); // Esto envía un booleano 'correcta' que indica si la respuesta fue correcta o no
        return; // Salir de la función inmediatamente después de enviar la respuesta

    } catch (error) {
        console.error('Error al registrar respuesta:', error);

        // Asegurarse de que la respuesta solo se envíe si no se ha enviado antes
        if (!res.headersSent) {
            res.status(500).json({ message: 'Error al registrar respuesta' });
        }
    }
});

// Suponiendo que tienes esta función para verificar si la respuesta es correcta
async function verificarRespuesta(preguntaId, respuesta) {
    try {
        const result = await pool.query('SELECT "resCorrecta" FROM public."Preguntas" WHERE "idPregunta" = $1', [preguntaId]);
        if (result.rows.length > 0) {
            return result.rows[0].resCorrecta === respuesta;
        }
        return false;
    } catch (error) {
        console.error('Error al verificar la respuesta:', error);
        return false;
    }
}

// Obtener el historial de partidas del usuario
app.get('/historial', async (req, res) => {
    const userId = req.query.userId;

    try {
        const query = `
            SELECT p."Fecha", t."NombreTematica"
            FROM public."Partida" p
            JOIN public."SeBasaEn" sb ON p."IdPartida" = sb."IdPart"
            JOIN public."Tematica" t ON sb."id_Tematica" = t."IdTematica"
            JOIN public."ParticipaEn" pa ON pa."IDPartida" = p."IdPartida"
            WHERE pa."IDUsuario" = $1
            ORDER BY p."Fecha" DESC
            LIMIT 10;
        `;
        const result = await pool.query(query, [userId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener el historial:', error);
        res.status(500).json({ message: 'Error al obtener el historial' });
    }
});


