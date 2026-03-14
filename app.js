/* ============================================================
   SimRad · app.js  —  Versión con carga local de archivos JSON
   Sin dependencias · HTML/CSS/JS puro · Compatible GitHub Pages
   ============================================================ */

'use strict';

// ══════════════════════════════════════════════════════════════
// ESTADO
// ══════════════════════════════════════════════════════════════
const state = {
  bancoPreguntasCompleto: [],  // preguntas combinadas de todos los JSON
  archivosInfo:           [],  // { nombre, cantidad } por archivo cargado
  preguntasExamen:        [],  // selección aleatoria para el examen actual
  indiceActual:           0,
  correctas:              0,
  incorrectas:            0,
  totalExamen:            10,
  respondida:             false,
};

// ══════════════════════════════════════════════════════════════
// REFERENCIAS DOM
// ══════════════════════════════════════════════════════════════
const screens = {
  start:   document.getElementById('screen-start'),
  exam:    document.getElementById('screen-exam'),
  results: document.getElementById('screen-results'),
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

  // Configuración
  numPreguntas: document.getElementById('num-preguntas'),
  btnMenos:     document.getElementById('btn-menos'),
  btnMas:       document.getElementById('btn-mas'),
  btnIniciar:   document.getElementById('btn-iniciar'),

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
  badgeEmoji:      document.getElementById('badge-emoji'),
  resultsTitle:    document.getElementById('results-title'),
  resultsSub:      document.getElementById('results-sub'),
  statCorrectas:   document.getElementById('stat-correctas'),
  statPct:         document.getElementById('stat-pct'),
  statIncorrectas: document.getElementById('stat-incorrectas'),
  gradeBarFill:    document.getElementById('grade-bar-fill'),
  gradeLabel:      document.getElementById('grade-label'),
  btnReintentar:   document.getElementById('btn-reintentar'),
  btnInicio:       document.getElementById('btn-inicio'),
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
        // Validar que cada pregunta tenga la estructura mínima
        const invalidas = data.filter(
          (p, i) => typeof p.pregunta !== 'string' ||
                    !Array.isArray(p.opciones) ||
                    typeof p.correcta !== 'number'
        );
        if (invalidas.length > 0) {
          reject(new Error(
            `"${file.name}" tiene ${invalidas.length} pregunta(s) con formato incorrecto.\n` +
            `Asegúrate de que cada pregunta tenga: "pregunta", "opciones" y "correcta".`
          ));
          return;
        }
        resolve({ nombre: file.name, preguntas: data });
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

  // Configurar stepper
  const valActual = parseInt(el.numPreguntas.textContent);
  el.numPreguntas.textContent = Math.min(valActual, total);
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
// STEPPER
// ══════════════════════════════════════════════════════════════
el.btnMenos.addEventListener('click', () => {
  const v = parseInt(el.numPreguntas.textContent);
  if (v > 1) el.numPreguntas.textContent = v - 1;
});

el.btnMas.addEventListener('click', () => {
  const v   = parseInt(el.numPreguntas.textContent);
  const max = state.bancoPreguntasCompleto.length;
  if (v < max) el.numPreguntas.textContent = v + 1;
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
  state.totalExamen = parseInt(el.numPreguntas.textContent);
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
  state.preguntasExamen = mezclar(state.bancoPreguntasCompleto).slice(0, total);
  state.indiceActual    = 0;
  state.correctas       = 0;
  state.incorrectas     = 0;
  state.respondida      = false;

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
  else            state.incorrectas++;

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

  mostrarPantalla('results');

  requestAnimationFrame(() => {
    setTimeout(() => { el.gradeBarFill.style.width = pct + '%'; }, 80);
  });
}

// ══════════════════════════════════════════════════════════════
// BOTONES DE RESULTADOS
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
  // Sincronizar stepper con banco actual
  const max = state.bancoPreguntasCompleto.length;
  if (max > 0) {
    el.numPreguntas.textContent = Math.min(
      parseInt(el.numPreguntas.textContent), max
    );
  }
});
