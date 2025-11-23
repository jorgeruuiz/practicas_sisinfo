import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import fetch from 'node-fetch';
import { io } from 'socket.io-client';

async function runWithCredentials(NombreUser, Contrasena) {
  console.log('Iniciando login...');
  const res = await fetch('http://localhost:8080/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ NombreUser, Contrasena })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error('Login fallido:', err);
    process.exit(1);
  }

  const body = await res.json();
  const accessToken = body.accessToken;
  const publicUser = body.publicUser;

  if (!accessToken || !publicUser) {
    console.error('Respuesta de login no contiene accessToken/publicUser', body);
    process.exit(1);
  }

  console.log('Login OK, user id:', publicUser.id);

  // Conectar via socket.io con token en query
  const socket = io(`http://localhost:8080?token=${accessToken}`);

  socket.on('connect', () => {
    console.log('Socket conectado:', socket.id);
    // Emitir buscarPartida usando el id que nos dio el servidor
    socket.emit('buscarPartida', { idJugador: publicUser.id });
  });

  socket.on('partidaCreada', (d) => console.log('partidaCreada', d));
  socket.on('partidaEncontrada', (d) => console.log('partidaEncontrada', d));
  socket.on('error', (e) => console.log('socket error', e));

  // Mostrar preguntas recibidas cuando la partida está lista
  socket.on('partidaLista', (payload) => {
    try {
      console.log('\n--- partidaLista recibida ---');
      console.log('partidaId:', payload.partidaId);
      const qs = payload.preguntas || [];
      console.log(`Preguntas recibidas: ${qs.length}`);
      qs.forEach((q, idx) => {
        console.log(`\n${idx + 1}. ${q.pregunta}`);
        console.log(`   A) ${q.respuesta_correcta}`);
        console.log(`   B) ${q.respuesta_incorrecta1}`);
        console.log(`   C) ${q.respuesta_incorrecta2}`);
        console.log(`   D) ${q.respuesta_incorrecta3}`);
        if (q.tematica) console.log(`   Temática: ${q.tematica}`);
        if (q.dificultad) console.log(`   Dificultad: ${q.dificultad}`);
      });
      console.log('--- fin de preguntas ---\n');
      // Simular tiempo de respuesta del jugador y enviar total de aciertos
      try {
        const totalPreg = qs.length;
        // Simular aciertos aleatorios entre 0 y totalPreg
        const simulatedAciertos = Math.floor(Math.random() * (totalPreg + 1));
        const delayMs = 2000 + Math.floor(Math.random() * 4000); // 2-6s
        console.log(`Simulando envío de ${simulatedAciertos} aciertos en ${delayMs}ms...`);
        setTimeout(() => {
          // Evento personalizado para reportar resultados; el servidor debe escuchar este evento
          socket.emit('reportResults', { partidaId: payload.partidaId, idJugador: publicUser.id, totalAciertos: simulatedAciertos });
          console.log('Reporte enviado:', { partidaId: payload.partidaId, totalAciertos: simulatedAciertos });
        }, delayMs);

        setTimeout(async () => {
            console.log('Simulando desconexión del socket');
            socket.disconnect();
            process.exit(0);
            
        }, delayMs + 2000); // desconectar 2s después de enviar resultados

      } catch (e) {
        console.error('Error al simular envio de aciertos:', e);
      }
    } catch (e) {
      console.error('Error mostrando partidaLista:', e);
    }
  });

  socket.on('partidaFinalizada', (summary) => {
    console.log('partidaFinalizada recibida:', summary);
  });

  socket.on('disconnect', () => {
    console.log('Socket desconectado');
    process.exit(0);
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length >= 2) {
    const [NombreUser, Contrasena] = args;
    await runWithCredentials(NombreUser, Contrasena);
    return;
  }

  const rl = readline.createInterface({ input, output });
  try {
    const NombreUser = await rl.question('NombreUser: ');
    const Contrasena = await rl.question('Contrasena: ');
    await runWithCredentials(NombreUser, Contrasena);
  } finally {
    rl.close();
  }
}

main().catch(err => {
  console.error('Error en testClient:', err);
  process.exit(1);
});
