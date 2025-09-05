// =================== Utility helpers ===================
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const sampleN = (arr, n, excludeIndex = -1) => {
  const pool = arr.map((v, i) => ({ v, i })).filter(obj => obj.i !== excludeIndex);
  return shuffle(pool).slice(0, n).map(obj => obj.v);
};

// =================== Default embedded dataset (EN->VI) ===================
const EMBEDDED_DEFAULT = [
  {word: "abate", meaning: "giảm bớt; dịu đi"},
  {word: "benevolent", meaning: "nhân từ; tốt bụng"},
  {word: "candid", meaning: "thẳng thắn; thật thà"},
  {word: "daunt", meaning: "làm nản chí; đe doạ"},
  {word: "elated", meaning: "phấn chấn; hớn hở"},
  {word: "frugal", meaning: "tiết kiệm; thanh đạm"},
  {word: "gregarious", meaning: "hoà đồng; thích giao du"},
  {word: "hamper", meaning: "cản trở"},
  {word: "impartial", meaning: "công bằng; vô tư"},
  {word: "jubilant", meaning: "vui mừng hớn hở"},
  {word: "kinetic", meaning: "(thuộc) chuyển động"},
  {word: "lucid", meaning: "rõ ràng; dễ hiểu"},
  {word: "meticulous", meaning: "tỉ mỉ; kỹ lưỡng"},
  {word: "nonchalant", meaning: "thờ ơ; lãnh đạm"},
  {word: "ornate", meaning: "trang trí cầu kỳ"},
  {word: "pragmatic", meaning: "thực dụng; thực tế"},
  {word: "quell", meaning: "dẹp yên; đàn áp"},
  {word: "resilient", meaning: "kiên cường; nhanh hồi phục"},
  {word: "succinct", meaning: "ngắn gọn; súc tích"},
  {word: "tenacious", meaning: "kiên trì; bền bỉ"}
];

// =================== Validation & normalization ===================
function normalizeRaw(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    return Object.entries(raw).map(([word, meaning]) => ({ word, meaning }));
  }
  return [];
}
function validatePairs(rawPairs) {
  const seen = new Set();
  const valid = [];
  for (const item of rawPairs) {
    if (!item) continue;
    const word = String(item.word ?? "").trim();
    const meaning = String(item.meaning ?? "").trim();
    if (!word || !meaning) continue;
    const key = word.toLowerCase() + "\u0000" + meaning.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    valid.push({ word, meaning });
  }
  return valid;
}

// =================== DOM refs ===================
const wordEl = document.getElementById('word');
const optionsEl = document.getElementById('options');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const liveStatus = document.getElementById('live-status');
const resultsSection = document.getElementById('results');
const quizSection = document.getElementById('quiz');
const scoreText = document.getElementById('score-text');
const resultsNote = document.getElementById('results-note');
const restartBtn = document.getElementById('restart-btn');
const datasetBadge = document.getElementById('dataset-badge');
const fileInput = document.getElementById('file-input');
const resetDefaultBtn = document.getElementById('reset-default');

// =================== Quiz state ===================
const ADVANCE_DELAY = 800;
let DATASET = [];
let SOURCE = 'Default dataset';
let order = [];
let qIndex = 0;
let score = 0;

function updateDatasetBadge() { datasetBadge.textContent = SOURCE; }

function setProgress(current, total) {
  const pct = total ? (current / total) * 100 : 0;
  progressBar.style.width = clamp(pct, 0, 100) + '%';
  progressBar.setAttribute('aria-valuenow', String(Math.round(pct)));
  progressBar.setAttribute('role', 'progressbar');
  progressBar.setAttribute('aria-valuemin', '0');
  progressBar.setAttribute('aria-valuemax', '100');
  progressText.textContent = `Question ${current} of ${total}`;
}

function announce(msg) { liveStatus.textContent = msg; }

function pickOptionsFor(index) {
  const correct = DATASET[index];
  const incorrect = sampleN(DATASET, 3, index).map(x => x.meaning);
  const options = shuffle([ {text: correct.meaning, correct: true}, ...incorrect.map(t => ({text: t, correct: false})) ]);
  return { word: correct.word, options };
}

function renderQuestion() {
  const total = order.length;
  const currentNo = Math.min(qIndex + 1, total);
  setProgress(currentNo - 1, total);

  const idx = order[qIndex];
  const { word, options } = pickOptionsFor(idx);

  wordEl.textContent = word;
  optionsEl.innerHTML = '';

  options.forEach((opt, i) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'option';
    wrapper.setAttribute('role', 'button');
    wrapper.setAttribute('tabindex', '0');
    wrapper.setAttribute('aria-disabled', 'false');

    const onChoose = () => handleAnswer(wrapper, opt.correct);
    wrapper.addEventListener('click', onChoose);
    wrapper.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChoose(); }
    });

    const nbtn = document.createElement('div');
    nbtn.className = 'nbtn';
    nbtn.textContent = String(i + 1);
    nbtn.setAttribute('aria-hidden', 'true');

    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = opt.text;

    wrapper.appendChild(nbtn);
    wrapper.appendChild(label);
    optionsEl.appendChild(wrapper);
  });

  const first = optionsEl.querySelector('.option');
  if (first) first.focus();
}

async function handleAnswer(wrapper, isCorrect) {
  if (wrapper.getAttribute('aria-disabled') === 'true') return;
  disableAllOptions();
  if (isCorrect) { wrapper.classList.add('correct'); score++; announce('Correct.'); }
  else { wrapper.classList.add('incorrect'); announce('Incorrect.'); }
  await sleep(ADVANCE_DELAY);
  qIndex++;
  if (qIndex >= order.length) { showResults(); } else { renderQuestion(); }
}

function disableAllOptions() {
  optionsEl.querySelectorAll('.option').forEach(el => {
    el.setAttribute('aria-disabled', 'true');
  });
}

function showResults() {
  setProgress(order.length, order.length);
  quizSection.hidden = true;
  resultsSection.hidden = false;
  scoreText.textContent = `${score} / ${order.length}`;
  resultsNote.textContent = SOURCE;
  restartBtn.focus();
}

function startQuiz() {
  score = 0; qIndex = 0;
  order = shuffle([...Array(DATASET.length).keys()]);
  resultsSection.hidden = true;
  quizSection.hidden = false;
  announce('Quiz started.');
  renderQuestion();
}

// =================== Loading datasets ===================
async function loadDefault() {
  try {
    const res = await fetch('vocab.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('No vocab.json found');
    const json = await res.json();
    const normalized = normalizeRaw(json);
    const valid = validatePairs(normalized);
    if (valid.length >= 4) {
      DATASET = valid;
      SOURCE = `Default: vocab.json (${valid.length} pairs)`;
      updateDatasetBadge();
      return;
    }
    throw new Error('Not enough valid pairs in vocab.json');
  } catch (e) {
    const valid = validatePairs(EMBEDDED_DEFAULT);
    DATASET = valid;
    SOURCE = `Embedded default (EN→VI, ${valid.length} pairs)`;
    updateDatasetBadge();
  }
}

async function loadFromFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve({ ok: false, reason: 'Failed to read file' });
    reader.onload = () => {
      try {
        const json = JSON.parse(String(reader.result));
        const normalized = normalizeRaw(json);
        const valid = validatePairs(normalized);
        if (valid.length >= 4) {
          DATASET = valid;
          SOURCE = `Custom file: ${file.name} (${valid.length} pairs)`;
          updateDatasetBadge();
          resolve({ ok: true });
        } else {
          resolve({ ok: false, reason: 'At least 4 valid pairs required' });
        }
      } catch (err) {
        resolve({ ok: false, reason: 'Invalid JSON format' });
      }
    };
    reader.readAsText(file);
  });
}

// =================== Events ===================
document.addEventListener('keydown', (e) => {
  if (!resultsSection.hidden && (e.key === 'r' || e.key === 'R')) { startQuiz(); return; }
  if (resultsSection.hidden) {
    const num = parseInt(e.key, 10);
    if (num >= 1 && num <= 4) {
      const opt = optionsEl.querySelectorAll('.option')[num - 1];
      if (opt && opt.getAttribute('aria-disabled') !== 'true') opt.click();
    }
  }
  if (e.key === 'r' || e.key === 'R') { startQuiz(); }
});

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const res = await loadFromFile(file);
  if (!res.ok) {
    announce(`Custom file invalid: ${res.reason}. Falling back to default.`);
    await loadDefault();
  }
  startQuiz();
  fileInput.value = '';
});

resetDefaultBtn.addEventListener('click', async () => { await loadDefault(); startQuiz(); });
restartBtn.addEventListener('click', () => startQuiz());

// =================== Init ===================
(async function init() { await loadDefault(); startQuiz(); })();