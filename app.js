/* ============================================================
   SimRad · app.js  —  Versión con carga local de archivos JSON
   Sin dependencias · HTML/CSS/JS puro · Compatible GitHub Pages
   ============================================================ */

'use strict';

// ══════════════════════════════════════════════════════════════
// ESTADO
// ══════════════════════════════════════════════════════════════
const state = {
  bancoPreguntasCompleto: [],
  archivosInfo:           [],
  preguntasExamen:        [],
  incorrectasDetalle:     [],
  indiceActual:           0,
  correctas:              0,
  incorrectas:            0,
  totalExamen:            30,   // siempre 30 preguntas
  respondida:             false,
};

// ══════════════════════════════════════════════════════════════
// REFERENCIAS DOM
// ══════════════════════════════════════════════════════════════
const screens = {
  start:   document.getElementById('screen-start'),
  exam:    document.getElementById('screen-exam'),
  results: document.getElementById('screen-results'),
  review:  document.getElementById('screen-review'),
};

const el = {
  // Carga de archivos
  dropZone:      document.getElementById('drop-zone'),
  dropIdle:      document.getElementById('drop-idle'),
  dropOverMsg:   document.getElementById('drop-over-msg'),
  fileInput:     document.getElementById('file-input'),
  filesList:     document.getElementById('files-list'),
  bancoResumen:  document.getElementById('banco-resumen'),
  bancoTotal:    document.getElementById('banco-total'),
  btnLimpiar:    document.getElementById('btn-limpiar'),
  errorMsg:      document.getElementById('error-msg'),
  configSection: document.getElementById('config-section'),
  btnIniciar:    document.getElementById('btn-iniciar'),

  // Examen
  scoreDisplay:  document.getElementById('score-display'),
  progressLabel: document.getElementById('progress-label'),
  progressPct:   document.getElementById('progress-pct'),
  progressBar:   document.getElementById('progress-bar'),
  qNum:          document.getElementById('q-num'),
  qCategory:     document.getElementById('q-category'),
  qText:         document.getElementById('q-text'),
  optionsGrid:   document.getElementById('options-grid'),
  feedbackBox:   document.getElementById('feedback-box'),
  feedbackIcon:  document.getElementById('feedback-icon'),
  feedbackText:  document.getElementById('feedback-text'),
  btnNext:       document.getElementById('btn-next'),

  // Resultados
  badgeEmoji:           document.getElementById('badge-emoji'),
  resultsTitle:         document.getElementById('results-title'),
  resultsSub:           document.getElementById('results-sub'),
  statCorrectas:        document.getElementById('stat-correctas'),
  statPct:              document.getElementById('stat-pct'),
  statIncorrectas:      document.getElementById('stat-incorrectas'),
  gradeBarFill:         document.getElementById('grade-bar-fill'),
  gradeLabel:           document.getElementById('grade-label'),
  btnReintentar:        document.getElementById('btn-reintentar'),
  btnInicio:            document.getElementById('btn-inicio'),
  btnVerIncorrectas:    document.getElementById('btn-ver-incorrectas'),
  reviewCountBadge:     document.getElementById('review-count-badge'),

  // Revisión
  reviewSubtitle:       document.getElementById('review-subtitle'),
  reviewList:           document.getElementById('review-list'),
  btnBackResults:       document.getElementById('btn-back-results'),
  btnReintentarReview:  document.getElementById('btn-reintentar-review'),
  btnInicioReview:      document.getElementById('btn-inicio-review'),
};

const LETRAS = ['A', 'B', 'C', 'D'];

// ══════════════════════════════════════════════════════════════
// NAVEGACIÓN
// ══════════════════════════════════════════════════════════════
function mostrarPantalla(nombre) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[nombre].classList.add('active');
  window.scrollTo(0, 0);
}

// ══════════════════════════════════════════════════════════════
// LECTURA DE ARCHIVOS JSON LOCALES
// ══════════════════════════════════════════════════════════════

/**
 * Lee un File como texto y lo parsea como JSON.
 * Devuelve una promesa con { nombre, preguntas } o rechaza con error.
 */
/**
 * Normaliza una pregunta aceptando múltiples variantes de campos.
 * Soporta:
 *   - "correcta" / "respuesta correcta" / "respuesta_correcta" / "respuesta" / "answer" / "correct"
 *   - Valor como número (0,1,2,3) o letra ("A","B","C","D") o texto completo de la opción
 *   - Opciones con prefijo de letra: "A) ...", "B) ..."
 */
function normalizarPregunta(p) {
  // ── Campo "pregunta" ──
  const textoPregunta =
    p.pregunta   ??
    p.question   ??
    p.enunciado  ??
    null;

  // ── Campo "opciones" ──
  const listaOpciones =
    p.opciones   ??
    p.options    ??
    p.respuestas ??
    null;

  // ── Campo "correcta" — múltiples nombres posibles ──
  const rawCorrecta =
    p.correcta                 ??
    p['respuesta correcta']    ??
    p['respuesta_correcta']    ??
    p.respuestaCorrecta        ??
    p.respuesta                ??
    p.answer                   ??
    p.correct                  ??
    null;

  if (
    typeof textoPregunta !== 'string' ||
    !Array.isArray(listaOpciones)     ||
    rawCorrecta === null
  ) return null;

  let indiceCorrecta;

  if (typeof rawCorrecta === 'number') {
    // Ya es índice numérico (0, 1, 2, 3)
    indiceCorrecta = rawCorrecta;

  } else if (typeof rawCorrecta === 'string') {
    const val = rawCorrecta.trim();

    // Caso 1: es un número en string ("0", "1", "2", "3")
    const comoNum = parseInt(val, 10);
    if (!isNaN(comoNum) && String(comoNum) === val) {
      indiceCorrecta = comoNum;

    // Caso 2: es una letra sola ("A", "B", "C", "D") — mayúscula o minúscula
    } else if (/^[a-dA-D]$/.test(val)) {
      indiceCorrecta = val.toUpperCase().charCodeAt(0) - 65; // A=0, B=1, C=2, D=3

    // Caso 3: coincide con el texto exacto de una opción (con o sin prefijo "A) ")
    } else {
      indiceCorrecta = listaOpciones.findIndex(o => {
        const oLimpia = o.trim().toLowerCase();
        const vLimpia = val.toLowerCase();
        return oLimpia === vLimpia ||
               oLimpia.replace(/^[a-d]\)\s*/i, '') === vLimpia;
      });
    }
  }

  if (
    typeof indiceCorrecta !== 'number' ||
    isNaN(indiceCorrecta)              ||
    indiceCorrecta < 0                 ||
    indiceCorrecta >= listaOpciones.length
  ) return null;

  return {
    pregunta: textoPregunta,
    opciones: listaOpciones,
    correcta: indiceCorrecta,
  };
}

function leerArchivoJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!Array.isArray(data)) {
          reject(new Error(`"${file.name}" no contiene un array JSON válido.`));
          return;
        }

        // Normalizar cada pregunta
        const normalizadas = [];
        const invalidas    = [];
        data.forEach((p, i) => {
          const n = normalizarPregunta(p);
          if (n) normalizadas.push(n);
          else   invalidas.push(i + 1);
        });

        if (normalizadas.length === 0) {
          reject(new Error(
            `"${file.name}" no tiene preguntas con formato reconocible.\n` +
            `Campos aceptados — respuesta: "correcta", "respuesta correcta", "respuesta_correcta"\n` +
            `Opciones: "opciones", "options", "respuestas"`
          ));
          return;
        }

        // Avisar de parciales pero no bloquear
        if (invalidas.length > 0) {
          console.warn(`[SimRad] "${file.name}": ${invalidas.length} pregunta(s) omitidas (filas ${invalidas.slice(0,5).join(', ')}${invalidas.length > 5 ? '…' : ''})`);
        }

        resolve({ nombre: file.name, preguntas: normalizadas });
      } catch (err) {
        reject(new Error(`"${file.name}" no es un JSON válido: ${err.message}`));
      }
    };
    reader.onerror = () => reject(new Error(`No se pudo leer "${file.name}".`));
    reader.readAsText(file, 'UTF-8');
  });
}

/**
 * Procesa una lista de File objects, los lee, los combina y actualiza la UI.
 */
async function procesarArchivos(files) {
  ocultarError();

  const archivosJSON = Array.from(files).filter(f => f.name.endsWith('.json'));
  if (archivosJSON.length === 0) {
    mostrarError('No se encontraron archivos .json en la selección.');
    return;
  }

  // Leer todos en paralelo
  let resultados;
  try {
    resultados = await Promise.all(archivosJSON.map(leerArchivoJSON));
  } catch (err) {
    mostrarError(err.message);
    return;
  }

  // Agregar al banco (sin duplicar archivos ya cargados)
  let nuevos = 0;
  resultados.forEach(({ nombre, preguntas }) => {
    const yaExiste = state.archivosInfo.find(a => a.nombre === nombre);
    if (!yaExiste) {
      state.archivosInfo.push({ nombre, cantidad: preguntas.length });
      // Añadir la fuente a cada pregunta para mostrarla en el examen
      preguntas.forEach(p => {
        p._fuente = nombre.replace('.json', '');
      });
      state.bancoPreguntasCompleto.push(...preguntas);
      nuevos++;
    }
  });

  if (nuevos === 0) {
    mostrarError('Todos los archivos seleccionados ya estaban cargados.');
    return;
  }

  actualizarUIBanco();
}

// ══════════════════════════════════════════════════════════════
// ACTUALIZAR UI DEL BANCO
// ══════════════════════════════════════════════════════════════
function actualizarUIBanco() {
  const total = state.bancoPreguntasCompleto.length;

  // Lista de archivos
  el.filesList.innerHTML = '';
  state.archivosInfo.forEach(({ nombre, cantidad }) => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `
      <div class="file-item-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
      </div>
      <div class="file-item-info">
        <span class="file-item-name">${nombre}</span>
        <span class="file-item-count">${cantidad} pregunta${cantidad !== 1 ? 's' : ''}</span>
      </div>
      <div class="file-item-ok">✓</div>
    `;
    el.filesList.appendChild(item);
  });

  el.filesList.classList.remove('hidden');
  el.bancoTotal.textContent = total;
  el.bancoResumen.classList.remove('hidden');
  el.configSection.classList.remove('hidden');

  // Ocultar zona drop si ya hay archivos (reducir espacio)
  el.dropIdle.querySelector('.drop-title').textContent = 'Agregar más archivos';
  el.dropIdle.querySelector('.drop-sub').textContent = 'Arrastra o haz clic';
}

// ══════════════════════════════════════════════════════════════
// LIMPIAR BANCO
// ══════════════════════════════════════════════════════════════
function limpiarBanco() {
  state.bancoPreguntasCompleto = [];
  state.archivosInfo           = [];
  el.filesList.innerHTML       = '';
  el.filesList.classList.add('hidden');
  el.bancoResumen.classList.add('hidden');
  el.configSection.classList.add('hidden');
  ocultarError();
  el.fileInput.value = '';

  // Restaurar texto del drop zone
  el.dropIdle.querySelector('.drop-title').textContent = 'Arrastra tus archivos JSON aquí';
  el.dropIdle.querySelector('.drop-sub').textContent   = 'o haz clic para seleccionarlos';
  el.numPreguntas.textContent = '10';
}

// ══════════════════════════════════════════════════════════════
// MENSAJES DE ERROR
// ══════════════════════════════════════════════════════════════
function mostrarError(msg) {
  el.errorMsg.innerHTML = `⚠ ${msg.replace(/\n/g, '<br/>')}`;
  el.errorMsg.classList.remove('hidden');
}
function ocultarError() {
  el.errorMsg.classList.add('hidden');
  el.errorMsg.textContent = '';
}

// ══════════════════════════════════════════════════════════════
// DRAG & DROP
// ══════════════════════════════════════════════════════════════
let dragCounter = 0; // contador para manejar eventos dragenter/dragleave anidados

el.dropZone.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragCounter++;
  el.dropZone.classList.add('drag-over');
  el.dropIdle.classList.add('hidden');
  el.dropOverMsg.classList.remove('hidden');
});

el.dropZone.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter <= 0) {
    dragCounter = 0;
    el.dropZone.classList.remove('drag-over');
    el.dropIdle.classList.remove('hidden');
    el.dropOverMsg.classList.add('hidden');
  }
});

el.dropZone.addEventListener('dragover', (e) => {
  e.preventDefault(); // necesario para permitir el drop
});

el.dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dragCounter = 0;
  el.dropZone.classList.remove('drag-over');
  el.dropIdle.classList.remove('hidden');
  el.dropOverMsg.classList.add('hidden');

  const files = e.dataTransfer.files;
  if (files.length > 0) procesarArchivos(files);
});

// Clic en la zona abre el selector de archivos
el.dropZone.addEventListener('click', () => el.fileInput.click());

// Input file nativo
el.fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) procesarArchivos(e.target.files);
});

// ══════════════════════════════════════════════════════════════
// LIMPIAR BANCO
// ══════════════════════════════════════════════════════════════
el.btnLimpiar.addEventListener('click', limpiarBanco);

// ══════════════════════════════════════════════════════════════
// INICIAR EXAMEN
// ══════════════════════════════════════════════════════════════
el.btnIniciar.addEventListener('click', () => {
  if (state.bancoPreguntasCompleto.length === 0) {
    mostrarError('Carga al menos un archivo JSON antes de iniciar.');
    return;
  }
  iniciarExamen();
});

// ══════════════════════════════════════════════════════════════
// LÓGICA DEL EXAMEN
// ══════════════════════════════════════════════════════════════

function mezclar(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function iniciarExamen() {
  const total = Math.min(state.totalExamen, state.bancoPreguntasCompleto.length);
  state.preguntasExamen     = mezclar(state.bancoPreguntasCompleto).slice(0, total);
  state.indiceActual        = 0;
  state.correctas           = 0;
  state.incorrectas         = 0;
  state.incorrectasDetalle  = [];
  state.respondida          = false;

  actualizarScore();
  mostrarPantalla('exam');
  mostrarPreguntaActual();
}

function mostrarPreguntaActual() {
  const pregunta = state.preguntasExamen[state.indiceActual];
  const num      = state.indiceActual + 1;
  const total    = state.preguntasExamen.length;

  // Re-animar tarjeta
  const card = document.getElementById('question-card');
  card.style.animation = 'none';
  void card.offsetWidth;
  card.style.animation = '';

  el.qNum.textContent      = String(num).padStart(2, '0');
  el.qText.textContent     = pregunta.pregunta;
  el.qCategory.textContent = pregunta._fuente || 'Radiología';

  const pct = Math.round(((num - 1) / total) * 100);
  el.progressBar.style.width   = pct + '%';
  el.progressLabel.textContent = `Pregunta ${num} de ${total}`;
  el.progressPct.textContent   = pct + '%';

  el.feedbackBox.classList.add('hidden');
  el.btnNext.classList.add('hidden');
  state.respondida = false;

  // Renderizar opciones
  el.optionsGrid.innerHTML = '';
  pregunta.opciones.forEach((texto, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';

    const letra = document.createElement('span');
    letra.className   = 'option-letter';
    letra.textContent = LETRAS[i];

    const label = document.createElement('span');
    label.className   = 'option-label';
    label.textContent = texto;

    btn.appendChild(letra);
    btn.appendChild(label);
    btn.addEventListener('click', () => seleccionarRespuesta(i));
    el.optionsGrid.appendChild(btn);
  });
}

function seleccionarRespuesta(indiceSeleccionado) {
  if (state.respondida) return;
  state.respondida = true;

  const pregunta   = state.preguntasExamen[state.indiceActual];
  const correcta   = pregunta.correcta;
  const esCorrecta = indiceSeleccionado === correcta;

  if (esCorrecta) state.correctas++;
  else {
    state.incorrectas++;
    state.incorrectasDetalle.push({
      pregunta:         pregunta.pregunta,
      respuestaCorrecta: pregunta.opciones[correcta],
      fuente:           pregunta._fuente || 'Radiología',
    });
  }

  const botones = el.optionsGrid.querySelectorAll('.option-btn');
  botones.forEach((btn, i) => {
    btn.disabled = true;
    if (i === correcta)                          btn.classList.add('correct');
    if (i === indiceSeleccionado && !esCorrecta) btn.classList.add('wrong');
    if (i === correcta && !esCorrecta)           btn.classList.add('reveal');
  });

  el.feedbackBox.classList.remove('hidden', 'ok', 'fail');
  if (esCorrecta) {
    el.feedbackBox.classList.add('ok');
    el.feedbackIcon.textContent = '✓';
    el.feedbackText.textContent = '¡Correcto! Muy bien.';
  } else {
    el.feedbackBox.classList.add('fail');
    el.feedbackIcon.textContent = '✗';
    el.feedbackText.textContent =
      `Incorrecto. La respuesta correcta es: "${pregunta.opciones[correcta]}".`;
  }

  const esFinal = state.indiceActual === state.preguntasExamen.length - 1;
  el.btnNext.querySelector('span').textContent = esFinal ? 'Ver resultados' : 'Siguiente';
  el.btnNext.classList.remove('hidden');

  actualizarScore();
}

function siguientePregunta() {
  if (state.indiceActual === state.preguntasExamen.length - 1) {
    mostrarResultados();
    return;
  }
  state.indiceActual++;
  mostrarPreguntaActual();
}

function actualizarScore() {
  const respondidas = state.correctas + state.incorrectas;
  el.scoreDisplay.textContent = `${state.correctas} / ${respondidas}`;
}

function mostrarResultados() {
  const total     = state.preguntasExamen.length;
  const correctas = state.correctas;
  const pct       = Math.round((correctas / total) * 100);

  el.progressBar.style.width   = '100%';
  el.progressPct.textContent   = '100%';
  el.progressLabel.textContent = 'Completado';

  el.statCorrectas.textContent   = correctas;
  el.statPct.textContent         = pct + '%';
  el.statIncorrectas.textContent = state.incorrectas;

  let color, emoji, titulo, sub, labelTexto;
  if (pct >= 90) {
    color = '#10b981'; emoji = '🏆'; titulo = '¡Excelente!';
    sub = 'Dominio sobresaliente del tema.'; labelTexto = 'SOBRESALIENTE';
  } else if (pct >= 75) {
    color = '#6366f1'; emoji = '🎯'; titulo = '¡Muy bien!';
    sub = 'Buen dominio de los conceptos.'; labelTexto = 'NOTABLE';
  } else if (pct >= 60) {
    color = '#f59e0b'; emoji = '📚'; titulo = 'Aprobado';
    sub = 'Sigue repasando para mejorar.'; labelTexto = 'SUFICIENTE';
  } else {
    color = '#f43f5e'; emoji = '💡'; titulo = 'Necesitas repasar';
    sub = 'Revisa los temas con atención.'; labelTexto = 'INSUFICIENTE';
  }

  el.badgeEmoji.textContent    = emoji;
  el.resultsTitle.textContent  = titulo;
  el.resultsSub.textContent    = sub;
  el.gradeLabel.textContent    = labelTexto;
  el.gradeBarFill.style.background = `linear-gradient(90deg, ${color}, ${color}99)`;
  el.gradeBarFill.style.boxShadow  = `0 0 14px ${color}55`;

  // Botón de revisión — solo si hay incorrectas
  const numIncorrectas = state.incorrectasDetalle.length;
  if (numIncorrectas > 0) {
    el.reviewCountBadge.textContent = numIncorrectas;
    el.btnVerIncorrectas.classList.remove('hidden');
  } else {
    el.btnVerIncorrectas.classList.add('hidden');
  }

  mostrarPantalla('results');

  requestAnimationFrame(() => {
    setTimeout(() => { el.gradeBarFill.style.width = pct + '%'; }, 80);
  });
}

// ══════════════════════════════════════════════════════════════
// PANTALLA DE REVISIÓN DE INCORRECTAS
// ══════════════════════════════════════════════════════════════
function mostrarRevision() {
  const lista = state.incorrectasDetalle;

  el.reviewSubtitle.textContent =
    `${lista.length} pregunta${lista.length !== 1 ? 's' : ''} para repasar`;

  el.reviewList.innerHTML = '';

  lista.forEach((item, i) => {
    const card = document.createElement('div');
    card.className = 'review-card';
    card.style.animationDelay = `${i * 0.05}s`;
    card.innerHTML = `
      <div class="review-card-header">
        <span class="review-card-num">${String(i + 1).padStart(2, '0')}</span>
        <span class="review-card-fuente">${item.fuente}</span>
      </div>
      <p class="review-card-pregunta">${item.pregunta}</p>
      <div class="review-card-respuesta">
        <span class="review-respuesta-label">Respuesta correcta</span>
        <span class="review-respuesta-texto">${item.respuestaCorrecta}</span>
      </div>
    `;
    el.reviewList.appendChild(card);
  });

  mostrarPantalla('review');
}

// Botones de la pantalla de revisión
el.btnVerIncorrectas.addEventListener('click', mostrarRevision);

el.btnBackResults.addEventListener('click', () => mostrarPantalla('results'));

el.btnReintentarReview.addEventListener('click', () => iniciarExamen());

el.btnInicioReview.addEventListener('click', () => {
  mostrarPantalla('start');
});

// ══════════════════════════════════════════════════════════════
el.btnNext.addEventListener('click', () => {
  if (!state.respondida) return;
  siguientePregunta();
});

el.btnReintentar.addEventListener('click', () => {
  iniciarExamen();
});

el.btnInicio.addEventListener('click', () => {
  mostrarPantalla('start');
});
