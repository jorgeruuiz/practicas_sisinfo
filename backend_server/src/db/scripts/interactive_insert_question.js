import readline from 'readline';
import '../../config/dotenv-config.js';
import { db } from '../../db/db.js';
import { preguntas } from '../schemas/schemas.js';
import { v4 as uuidv4 } from 'uuid';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(q) { return new Promise(res=> rl.question(q, ans=> res(ans))); }

async function insertQuestion(obj) {
  const row = {
    id: uuidv4(),
    pregunta: obj.pregunta,
    respuesta_correcta: obj.respuesta_correcta,
    respuesta_incorrecta1: obj.respuesta_incorrecta1 || '',
    respuesta_incorrecta2: obj.respuesta_incorrecta2 || '',
    respuesta_incorrecta3: obj.respuesta_incorrecta3 || '',
    tematica: obj.tematica || '',
    dificultad: obj.dificultad || ''
  };
  try {
    await db.insert(preguntas).values(row).run();
    console.log('Insertada pregunta con id:', row.id);
  } catch (e) {
    console.error('Error insertando pregunta:', e);
  }
}

async function interactive() {
  console.log('Insertar nueva pregunta en tabla `preguntas`. Deja en blanco para omitir respuestas opcionales.');
  const tematica = await ask('Temática: ');
  const pregunta = await ask('Pregunta: ');
  const respA = await ask('Respuesta A: ');
  const respB = await ask('Respuesta B: ');
  const respC = await ask('Respuesta C: ');
  const respD = await ask('Respuesta D: ');
  const correcta = await ask('Letra de la respuesta correcta (A/B/C/D): ');
  const dificultad = await ask('Dificultad (opcional): ');

  // map correct letter to text
  const map = { a: respA, b: respB, c: respC, d: respD };
  const obj = {
    tematica, pregunta,
    respuesta_correcta: (map[(correcta||'').toLowerCase()]||'').trim(),
    respuesta_incorrecta1: '', respuesta_incorrecta2: '', respuesta_incorrecta3: '',
    dificultad: dificultad || ''
  };
  // fill incorrects in order
  const incorrects = [respA, respB, respC, respD].filter(t=>t && t.trim() !== obj.respuesta_correcta);
  obj.respuesta_incorrecta1 = incorrects[0] || '';
  obj.respuesta_incorrecta2 = incorrects[1] || '';
  obj.respuesta_incorrecta3 = incorrects[2] || '';

  await insertQuestion(obj);
  rl.close();
}

async function testInsert() {
  console.log('Insertando pregunta de prueba...');
  await insertQuestion({ tematica: 'PRUEBA', pregunta: '¿Pregunta de prueba?', respuesta_correcta: 'Sí', respuesta_incorrecta1: 'No', respuesta_incorrecta2: 'Quizá', respuesta_incorrecta3: '', dificultad: 'fácil' });
  process.exit(0);
}

if (process.argv.includes('--test')) testInsert();
else if (process.argv[1] && process.argv[1].endsWith('interactive_insert_question.js')) interactive();
