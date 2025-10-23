import { requireAuthOrRedirect, getPublicUser, clearAuth, getToken } from './app.js';
import { io } from 'socket.io-client';

requireAuthOrRedirect();
const publicUser = getPublicUser();
const token = getToken();

const lastEl = document.getElementById('last');
const meEl = document.getElementById('me');
meEl.innerText = `Conectado como: ${publicUser.NombreUser} (${publicUser.id})`;

// UI elements
const idleScreen = document.getElementById('idleScreen');
const waitingScreen = document.getElementById('waitingScreen');
const matchScreen = document.getElementById('matchScreen');
const questionsContainer = document.getElementById('questionsContainer');
const btnCheck = document.getElementById('btnCheck');
const matchResult = document.getElementById('matchResult');

// Backend expects the token in handshake.query.token (legacy style).
// Send the token in the query so the existing backend authenticate() finds it.
const socket = io('http://localhost:3000', { query: { token } });

socket.on('connect', () => {
  console.info('socket connected', socket.id);
});
socket.on('disconnect', () => {
  console.warn('socket disconnected');
  // show idle screen
  showScreen('idle');
});

// When server sends partidaLista, render the match UI
socket.on('partidaLista', (data) => {
  console.info('partidaLista received', data);
  lastEl.innerText = JSON.stringify(data, null, 2);
  startMatch(data);
});

socket.on('partidaFinalizada', (d) => {
  console.info('partidaFinalizada', d);
  lastEl.innerText = JSON.stringify(d, null, 2);
  // show result summary if needed
  matchResult.innerText = `Partida finalizada. Ganador: ${d.ganador || 'Empate'}`;
  showScreen('idle');
});

socket.on('partidaCreada', (d) => {
  console.info('partidaCreada', d);
  lastEl.innerText = JSON.stringify(d, null, 2);
});

// UI helpers
function showScreen(name) {
  idleScreen.style.display = name === 'idle' ? '' : 'none';
  waitingScreen.style.display = name === 'waiting' ? '' : 'none';
  matchScreen.style.display = name === 'match' ? '' : 'none';
}

document.getElementById('btnFind').onclick = () => {
  socket.emit('buscarPartida', { idJugador: publicUser.id });
  showScreen('waiting');
};
document.getElementById('btnLogout').onclick = () => { clearAuth(); window.location='index.html'; };

// Match state held in client (questions include correct answer but UI hides it)
let currentMatch = null;

function startMatch(data) {
  currentMatch = data; // { partidaId, preguntas: [...] }
  renderQuestions(data.preguntas || []);
  matchResult.innerText = '';
  showScreen('match');
}

function shuffleArray(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function renderQuestions(questions) {
  questionsContainer.innerHTML = '';
  questions.forEach((q, idx) => {
    // Prepare options keeping the correct answer available in data-correct but not shown
    const options = shuffleArray([
      { text: q.respuesta_correcta, isCorrect: true },
      { text: q.respuesta_incorrecta1, isCorrect: false },
      { text: q.respuesta_incorrecta2, isCorrect: false },
      { text: q.respuesta_incorrecta3, isCorrect: false }
    ]);

    const qEl = document.createElement('div');
    qEl.className = 'question';
    qEl.style.border = '1px solid #ddd';
    qEl.style.padding = '8px';
    qEl.style.marginBottom = '8px';

    const title = document.createElement('div');
    title.innerHTML = `<strong>Pregunta ${idx + 1}:</strong> ${q.pregunta}`;
    qEl.appendChild(title);

    const list = document.createElement('div');
    list.style.marginTop = '6px';

    options.forEach((opt, oidx) => {
      const optId = `q${idx}_o${oidx}`;
      const wrapper = document.createElement('div');
      wrapper.style.margin = '4px 0';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = `q_${idx}`;
      input.id = optId;
      input.dataset.correct = opt.isCorrect ? '1' : '0';
      const label = document.createElement('label');
      label.htmlFor = optId;
      label.innerText = opt.text;
      wrapper.appendChild(input);
      wrapper.appendChild(label);
      list.appendChild(wrapper);
    });

    qEl.appendChild(list);
    questionsContainer.appendChild(qEl);
  });
}

// When the user clicks 'Comprobar respuestas', compute total correct and emit reportResults
btnCheck.onclick = () => {
  if (!currentMatch) return;
  const preguntas = currentMatch.preguntas || [];
  let totalAciertos = 0;
  preguntas.forEach((q, idx) => {
    const radios = document.getElementsByName(`q_${idx}`);
    for (const r of radios) {
      if (r.checked) {
        if (r.dataset.correct === '1') totalAciertos++;
        break;
      }
    }
  });

  matchResult.innerText = `Has obtenido ${totalAciertos} aciertos de ${preguntas.length}`;

  // Emitir al backend para que este lo reciba y espere al otro jugador
  socket.emit('reportResults', { partidaId: currentMatch.partidaId, idJugador: publicUser.id, totalAciertos });
  // Tras enviar, mostrar waiting hasta que el servidor notifique finalización
  showScreen('waiting');
};
