// ==== helpers ====
const sleep = (ms) => new Promise(r=>setTimeout(r,ms));
const clamp = (n,min,max)=>Math.max(min,Math.min(max,n));
const shuffle = (arr)=>{const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const unique = (arr)=>[...new Set(arr)];
async function pMap(items, concurrency, mapper, onProgress) {
  const ret = new Array(items.length);
  let next = 0, done = 0;
  const run = async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) break;
      try { ret[i] = await mapper(items[i], i); } catch { ret[i] = undefined; }
      done++; if (onProgress) onProgress(done, items.length);
      await new Promise(requestAnimationFrame);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, run));
  return ret;
}
const cleanText = (s="") => String(s).trim().replace(/\s+/g, " ");

// ==== STOPWORDS ====
const STOPWORDS = new Set([
  "the","a","an","is","are","am","was","were","be","been","being",
  "to","of","and","or","in","on","at","by","for","from","with","as","that",
  "this","these","those","it","its","it’s","he","she","they","them","his","her","their",
  "you","your","yours","i","me","my","we","our","ours",
  "but","if","then","than","so","because","while","although","though","however",
  "do","does","did","doing","done",
  "have","has","had","having",
  "will","would","shall","should","can","could","may","might","must",
  "there","here","where","when","why","how",
  "not","no","nor","only","very","too","also","just","more","most","some","any","such",
  "into","over","under","between","among","about","across","through","during","before","after",
  "usually","often","always","never","sometimes",
  "'s","'re","'m","'ve","'ll","'d"
]);
const isStopWord = (w="") => STOPWORDS.has(w.toLowerCase());

// ==== MOTIVATION QUOTES ====
const QUOTES = [
  "The secret of getting ahead is getting started. — Mark Twain",
  "It always seems impossible until it’s done. — Nelson Mandela",
  "Don’t watch the clock; do what it does. Keep going. — Sam Levenson",
  "Success is the sum of small efforts, repeated day in and day out. — R. Collier",
  "Dream big. Start small. Act now.",
  "You don’t have to be great to start, but you have to start to be great. — Zig Ziglar",
  "Quality is not an act, it is a habit. — Aristotle",
  "The best way out is always through. — Robert Frost",
  "Action is the foundational key to all success. — Pablo Picasso",
  "Everything you can imagine is real. — Pablo Picasso",
  "Make it work. Make it right. Make it fast. — Kent Beck",
  "Believe you can and you’re halfway there. — Theodore Roosevelt"
];
function setRandomQuote(){
  const el = document.getElementById('motivation-quote');
  if(!el) return;
  const q = QUOTES[Math.floor(Math.random()*QUOTES.length)];
  el.textContent = q;
}

// ==== DOM ====
const openBuilderBtn = document.getElementById("open-builder"),
      builderModal = document.getElementById("builder-modal"),
      builderBackdrop = document.getElementById("modal-backdrop"),
      builderClose = document.getElementById("modal-close"),
      resultsModal = document.getElementById("results-modal"),
      resultsBackdrop = document.getElementById("results-backdrop"),
      resultsClose = document.getElementById("results-close"),
      wordEl = document.getElementById("word"),
      wordIpaEl = document.getElementById("word-ipa"),
      speakBtn = document.getElementById("speak-btn"),
      optionsEl = document.getElementById("options"),
      progressBar = document.getElementById("progress-bar"),
      progressText = document.getElementById("progress-text"),
      liveStatus = document.getElementById("live-status"),
      scoreText = document.getElementById("score-text"),
      resultsNote = document.getElementById("results-note"),
      resultsDetails = document.getElementById("results-details"),
      restartBtn = document.getElementById("restart-btn"),
      restartInlineBtn = document.getElementById("restart-inline"),
      modeBtns = {
        words: document.getElementById("mode-words"),
        pairs: document.getElementById("mode-pairs"),
        paragraph: document.getElementById("mode-paragraph")
      },
      taMain = document.getElementById("ta-main"),
      paraControls = document.getElementById("para-controls"),
      pickCount = document.getElementById("pick-count"),
      extractPreview = document.getElementById("extract-preview"),
      builderStatus = document.getElementById("builder-status"),
      btnBuild = document.getElementById("btn-build"),
      sampleBtn = document.getElementById("load-sample");

let DATASET=[],ORDER=[],qIndex=0,score=0,CURRENT_MODE="words";
let AUDIO_CACHE = {};

// ==== Default đề ====
const DEFAULT_WORDS = unique([
  "abandon","frugal","resilient","candid","pragmatic",
  "gregarious","ornate","rejuvenate","coherent","tenacious"
]);
const DEFAULT_FALLBACK_PAIRS = [
  { word:"abandon", meaning:"từ bỏ; bỏ rơi", pos:"động từ", ipa:[], meanings:["từ bỏ; bỏ rơi"], audio:[] },
  { word:"frugal", meaning:"tiết kiệm; thanh đạm", pos:"tính từ", ipa:[], meanings:["tiết kiệm; thanh đạm"], audio:[] },
  { word:"resilient", meaning:"kiên cường; nhanh hồi phục", pos:"tính từ", ipa:[], meanings:["kiên cường; nhanh hồi phục"], audio:[] },
  { word:"candid", meaning:"thẳng thắn; thật thà", pos:"tính từ", ipa:[], meanings:["thẳng thắn; thật thà"], audio:[] },
  { word:"pragmatic", meaning:"thực dụng; thực tế", pos:"tính từ", ipa:[], meanings:["thực dụng; thực tế"], audio:[] },
  { word:"gregarious", meaning:"thích giao du; bầy đàn", pos:"tính từ", ipa:[], meanings:["thích giao du; bầy đàn"], audio:[] },
  { word:"ornate", meaning:"trang trí cầu kỳ", pos:"tính từ", ipa:[], meanings:["trang trí cầu kỳ"], audio:[] },
  { word:"rejuvenate", meaning:"trẻ hóa; hồi sinh", pos:"động từ", ipa:[], meanings:["trẻ hóa; hồi sinh"], audio:[] },
  { word:"coherent", meaning:"mạch lạc; chặt chẽ", pos:"tính từ", ipa:[], meanings:["mạch lạc; chặt chẽ"], audio:[] },
  { word:"tenacious", meaning:"kiên trì; bền bỉ", pos:"tính từ", ipa:[], meanings:["kiên trì; bền bỉ"], audio:[] }
];

// ==== localStorage ====
//const LS_KEY = 'vq_last_dataset_v1';
function saveLastSet(dataset, source='unknown'){
  try{
    if(!Array.isArray(dataset) || dataset.length < 4) return;
    const payload = { dataset, source, createdAt: new Date().toISOString() };
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
  }catch{}
}
function loadLastSet(){
  try{
    const txt = localStorage.getItem(LS_KEY);
    if(!txt) return null;
    const obj = JSON.parse(txt);
    if(!obj || !Array.isArray(obj.dataset) || obj.dataset.length < 4) return null;
    const ds = obj.dataset.filter(p=>p && p.word && (p.meaning || (p.meanings&&p.meanings.length)));
    if(ds.length < 4) return null;
    return { dataset: ds, meta: { source: obj.source, createdAt: obj.createdAt } };
  }catch{ return null; }
}

// ==== modal ====
const openModal=(el)=>el.setAttribute("aria-hidden","false");
const closeModal=(el)=>el.setAttribute("aria-hidden","true");
function clearBuilderInputs(message = 'Dán nội dung rồi bấm “Tạo đề từ dữ liệu”.') {
  if (taMain) taMain.value = "";
  if (extractPreview) extractPreview.textContent = "";
  if (builderStatus) builderStatus.textContent = message;
}
openBuilderBtn.onclick=()=>{ openModal(builderModal); clearBuilderInputs(); };
builderBackdrop.onclick=()=>closeModal(builderModal);
builderClose.onclick=()=>closeModal(builderModal);
resultsBackdrop.onclick=()=>closeModal(resultsModal);
resultsClose.onclick=()=>closeModal(resultsModal);
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){closeModal(builderModal);closeModal(resultsModal);}
});

// ==== mode ====
function setMode(name){
  CURRENT_MODE=name;
  for(const k in modeBtns) modeBtns[k].setAttribute("aria-pressed",k===name?"true":"false");
  if (taMain) taMain.placeholder=modeBtns[name].dataset.ph||"";
  if (paraControls) paraControls.hidden=name!=="paragraph";
  clearBuilderInputs(`Đang ở chế độ “${modeBtns[name].textContent}”. Dán nội dung rồi bấm “Tạo đề từ dữ liệu”.`);
}
modeBtns.words.onclick=()=>setMode("words");
modeBtns.pairs.onclick=()=>setMode("pairs");
modeBtns.paragraph.onclick=()=>setMode("paragraph");
setMode("words");

// ==== nhập liệu ====
function parseWords(t){
  const raw = unique(t.split(/\r?\n+/).map(s=>s.trim()).filter(Boolean));
  return raw.filter(w => w.length >= 2 && !isStopWord(w));
}
function parsePairs(t){
  const o=[];
  for(const l of t.split(/\r?\n+/)){
    const m=l.split(":");
    if(m.length>=2){
      const w=m.shift().trim(),mean=m.join(":").trim();
      if(w && mean) o.push({word:w,meaning:mean, audio:[], ipa:[], meanings:[mean]});
    }
  }
  return o;
}
function extractKeywords(txt,maxN){
  const nlp=window.nlp||null;
  let cands=[];
  if(!nlp){
    const toks=txt.toLowerCase().match(/[a-zA-Z][a-zA-Z'-]{2,}/g)||[];
    cands = toks;
  } else {
    const d=nlp(txt);
    const ns=d.nouns().out("array"), as=d.adjectives().out("array"), vs=d.verbs().out("array");
    cands=[...ns,...as,...vs].map(s=>s.toLowerCase());
  }
  const f=new Map();
  for(const w of cands){
    if (w.length<3) continue;
    if (isStopWord(w)) continue;
    f.set(w,(f.get(w)||0)+1);
  }
  return [...f.entries()].sort((a,b)=>b[1]-a[1]).slice(0,maxN).map(e=>e[0]);
}

// ==== WIKTIONARY (VI) ====
async function fetchWiktionaryPageVi(word) {
  const url = `https://vi.wiktionary.org/w/rest.php/v1/page/${encodeURIComponent(word)}`;
  const r = await fetch(url, { headers: { "Accept": "application/json" }});
  if (!r.ok) throw new Error("wiktionary http "+r.status);
  return r.json();
}
const POS_MAP = {
  interj: "thán từ", noun: "danh từ", "intr-verb": "nội động từ", "tran-verb": "ngoại động từ",
  verb: "động từ", adj: "tính từ", adv: "trạng từ", pron: "đại từ", prep: "giới từ", conj: "liên từ"
};
function stripWikiMarkup(s) {
  let t = s;
  t = t.replace(/\{\{[^{}]*\}\}/g, "");
  t = t.replace(/\[\[([^\|\]]+)\|([^\]]+)\]\]/g, "$2");
  t = t.replace(/\[\[([^\]]+)\]\]/g, "$1");
  t = t.replace(/'''+/g, "").replace(/''/g, "");
  t = t.replace(/<[^>]+>/g, "");
  t = t.replace(/^\s*[*;:]+/gm, "");
  t = t.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  return cleanText(t);
}
function extractIPA(wikitext) {
  const ipa = []; const re = /\{\{IPA\|([^}]+)\}\}/g; let m;
  while ((m = re.exec(wikitext)) !== null) {
    const parts = m[1].split(/[,;]\s*/).map(s=>s.trim());
    parts.forEach(p=>{ if (p) ipa.push(p); });
  }
  return [...new Set(ipa)].slice(0,4);
}
function extractPOS(wikitext) {
  const markers = []; const re = /\{\{-(interj|noun|verb|adj|adv|pron|prep|conj|intr-verb|tran-verb)-\}\}/g; let m;
  while ((m = re.exec(wikitext)) !== null) markers.push(m[1]);
  if (!markers.length) return null; const first = markers[0]; return POS_MAP[first] || first;
}
function extractAudioLinks(wikitext){
  // tìm {{pron-audio|file=En-us-hello.ogg|...}}
  const urls = [];
  const re = /\{\{pron-audio\s*\|[^}]*\}\}/g;
  let m;
  while ((m = re.exec(wikitext)) !== null) {
    const chunk = m[0];
    const fm = chunk.match(/file\s*=\s*([^|\}\n\r]+)/i);
    if (fm && fm[1]) {
      const filename = cleanText(fm[1]);
      // dùng Special:FilePath (Commons sẽ trả file gốc)
      const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}`;
      urls.push(url);
    }
  }
  return [...new Set(urls)];
}
function extractViDefinitionsFromWikitext(wikitext) {
  const lines = wikitext.split(/\r?\n/); const defs = [];
  for (const line of lines) {
    const m = line.match(/^\s*#\s+(.*)$/);
    if (m) { const cleaned = stripWikiMarkup(m[1]); if (cleaned && cleaned.length >= 2) defs.push(cleaned); }
  }
  const uniq = []; const seen = new Set();
  for (let d of defs) { d = d.replace(/\s*\.\s*$/, "."); const key = d.toLowerCase(); if (!seen.has(key)) { seen.add(key); uniq.push(d); } }
  return uniq;
}
async function getVietnameseEntry(word) {
  try {
    if (isStopWord(word)) return null;
    const json = await fetchWiktionaryPageVi(word);
    const src = json?.source || "";
    if (!src) throw new Error("no wikitext");
    const meanings = extractViDefinitionsFromWikitext(src);
    const pos = extractPOS(src);
    const ipa = extractIPA(src);
    const audio = extractAudioLinks(src);
    if (meanings.length) {
      const compact = meanings.find(d => d.length <= 140) || meanings[0];
      return { word, meaning: compact, meanings, pos, ipa, audio };
    }
    return null;
  } catch { return null; }
}

// === Xây bộ câu hỏi ===
async function buildPairsFromWords(words){
  const filtered = words.filter(w => w.length >= 2 && !isStopWord(w) && /^[a-zA-Z'-]+$/.test(w));
  if (builderStatus) builderStatus.textContent='Đang lấy dữ liệu từ Wiktionary… (0%)';
  const items = await pMap(
    filtered, 4, getVietnameseEntry,
    (done,total)=>{ if (builderStatus) builderStatus.textContent=`Đang lấy dữ liệu từ Wiktionary… (${Math.round(done*100/total)}%)`; }
  );
  const ok = items.filter(Boolean).slice(0, 80);
  return ok;
}

// ==== validate ====
function needAtLeastFour(l){return Array.isArray(l)&&l.length>=4;}

// ==== UI nhập ====
if (taMain) taMain.oninput=()=>{
  if(CURRENT_MODE!=='paragraph'){if (extractPreview) extractPreview.textContent='';return;}
  const t=taMain.value.trim();
  if(!t){if (extractPreview) extractPreview.textContent='';return;}
  const w=extractKeywords(t,Number(pickCount.value||12));
  if (extractPreview) extractPreview.textContent=w.length?`Đã trích (lọc từ phổ biến): ${w.slice(0,8).join(', ')}${w.length>8?'…':''}`:'';
};
if (pickCount) pickCount.onchange=()=>taMain.oninput?.();

function loadSample(){
  if(!taMain) return;
  if(CURRENT_MODE==='words'){
    taMain.value='abandon\nfrugal\nresilient\ncandid\nhello\nthe\nis\nare\nusually';
  }else if(CURRENT_MODE==='pairs'){
    taMain.value='abandon : từ bỏ; bỏ rơi\nfrugal : tiết kiệm; thanh đạm\nresilient : kiên cường; nhanh hồi phục\ncandid : thẳng thắn; thật thà\nhello : chào; a lô';
  }else{
    taMain.value='On a crisp autumn morning, the resilient community gathered... They are usually delighted by candid talks.';
  }
  taMain.oninput?.();
}
if (sampleBtn) sampleBtn.onclick=loadSample;

// ==== localStorage ====
const LS_KEY = 'vq_last_dataset_v1';
function saveLastSet(dataset, source='unknown'){
  try{
    if(!Array.isArray(dataset) || dataset.length < 4) return;
    const payload = { dataset, source, createdAt: new Date().toISOString() };
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
  }catch{}
}
function loadLastSet(){
  try{
    const txt = localStorage.getItem(LS_KEY);
    if(!txt) return null;
    const obj = JSON.parse(txt);
    if(!obj || !Array.isArray(obj.dataset) || obj.dataset.length < 4) return null;
    const ds = obj.dataset.filter(p=>p && p.word && (p.meaning || (p.meanings&&p.meanings.length)));
    if(ds.length < 4) return null;
    return { dataset: ds, meta: { source: obj.source, createdAt: obj.createdAt } };
  }catch{ return null; }
}

// ==== nút tạo đề ====
if (btnBuild) btnBuild.onclick=async()=>{
  let pairs=[];
  if(CURRENT_MODE==='words'){
    const ws=parseWords(taMain.value);
    if(!needAtLeastFour(ws)){builderStatus.textContent='Cần ≥ 4 từ (đã lọc từ phổ biến).';return;}
    builderStatus.textContent='Đang lấy dữ liệu từ Wiktionary…';
    pairs=await buildPairsFromWords(ws);
  }else if(CURRENT_MODE==='pairs'){
    pairs=parsePairs(taMain.value);
    if(!needAtLeastFour(pairs)){builderStatus.textContent='Cần ≥ 4 cặp hợp lệ.';return;}
  }else{
    const txt=taMain.value.trim();
    if(!txt){builderStatus.textContent='Hãy dán đoạn văn trước.';return;}
    const ws=extractKeywords(txt,Number(pickCount.value||12));
    if(!needAtLeastFour(ws)){builderStatus.textContent='Số từ trích (sau lọc) < 4.';return;}
    builderStatus.textContent=`Đã trích ${ws.length} từ. Đang tra Wiktionary…`;
    pairs=await buildPairsFromWords(ws);
  }

  pairs = (pairs||[]).filter(p=>p && p.word && (p.meaning || (p.meanings&&p.meanings.length)));
  if(!needAtLeastFour(pairs)){
    builderStatus.textContent='Không đủ mục có nghĩa (sau lọc). Hãy thêm nhiều từ hơn hoặc thử từ phổ biến hơn.';
    return;
  }
  DATASET=pairs;
  saveLastSet(DATASET, 'builder');
  startQuiz('Đề tùy chỉnh ('+pairs.length+' mục)');
  builderStatus.textContent='Đã tạo đề.';
  closeModal(builderModal);
  clearBuilderInputs();
};

// ==== quiz ====
function setProgress(c,t){
  const pct=t?(c/t)*100:0;
  progressBar.style.width=clamp(pct,0,100)+'%';
  progressText.textContent=`Câu ${c} trên ${t}`;
}
function announce(m){if (liveStatus) liveStatus.textContent=m;}
function pickOptionsFor(i){
  const c=DATASET[i],pool=DATASET.map(x=>x.meaning || (x.meanings?x.meanings[0]:""));
  const correct = c.meaning || (c.meanings?c.meanings[0]:"");
  const inc=shuffle(pool.filter(m=>m && m!==correct)).slice(0,3);
  return{word:c.word,options:shuffle([{text:correct,correct:true},...inc.map(t=>({text:t,correct:false}))])};
}
function renderQuestion(){
  if (!DATASET.length) { wordEl.textContent = "Chưa có dữ liệu."; optionsEl.innerHTML=""; speakBtn.hidden = true; wordIpaEl.textContent=''; return; }
  const total=ORDER.length,cur=Math.min(qIndex+1,total);
  setProgress(cur-1,total);
  const item=DATASET[ORDER[qIndex]];
  const {word,options}=pickOptionsFor(ORDER[qIndex]);
  wordEl.textContent=word;
  // Hiển thị IPA (nếu có)
  wordIpaEl.textContent = (item.ipa && item.ipa.length) ? `/${item.ipa[0]}/` : '';
  // Nút phát âm nếu có audio
  if (item.audio && item.audio.length) {
    speakBtn.hidden = false;
    speakBtn.onclick = ()=>playAudio(item.audio);
  } else {
    speakBtn.hidden = true;
    speakBtn.onclick = null;
  }

  optionsEl.innerHTML='';
  options.forEach((opt,i)=>{
    const w=document.createElement('div');
    w.className='option';
    w.tabIndex=0;
    w.role='button';
    w.ariaDisabled='false';
    const pick=()=>handleAnswer(w,opt.correct);
    w.onclick=pick;
    w.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick();}};
    const n=document.createElement('div');
    n.className='nbtn';
    n.textContent=String(i+1);
    const lab=document.createElement('div');
    lab.className='label';
    lab.textContent=opt.text;
    w.append(n,lab);
    optionsEl.appendChild(w);
  });
  const first=optionsEl.querySelector('.option');
  if(first)first.focus();
}
async function handleAnswer(wrap,isCorrect){
  if(wrap.getAttribute('aria-disabled')==='true')return;
  optionsEl.querySelectorAll('.option').forEach(el=>el.setAttribute('aria-disabled','true'));
  if(isCorrect){wrap.classList.add('correct');score++;announce('Đúng.');}
  else{wrap.classList.add('incorrect');announce('Sai.');}
  await sleep(800);
  qIndex++;
  if(qIndex>=ORDER.length)showResults();else renderQuestion();
}

// ==== Audio playback ====
function playAudio(list){
  // ưu tiên cache Audio object
  const key = list.join('|');
  if (!AUDIO_CACHE[key]) {
    // tạo hàng đợi thử lần lượt (nếu 1 file fail CORS/404 thì thử cái khác)
    AUDIO_CACHE[key] = list.map(u => new Audio(u));
  }
  const arr = AUDIO_CACHE[key];
  let i = 0;
  const tryPlay = ()=>{
    if (i >= arr.length) return;
    const a = arr[i++];
    a.currentTime = 0;
    a.play().catch(()=>tryPlay());
  };
  tryPlay();
}

// ==== results + details + link Wiktionary + nút audio ====
function wiktionaryLink(word){ return `https://vi.wiktionary.org/wiki/${encodeURIComponent(word)}`; }
function renderResultsDetails(){
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  ['Từ', 'Loại từ', 'IPA / 🔊', 'Nghĩa'].forEach(h=>{
    const th=document.createElement('th'); th.textContent=h; trh.appendChild(th);
  });
  thead.appendChild(trh); table.appendChild(thead);

  const tbody = document.createElement('tbody');
  DATASET.forEach(item=>{
    const tr=document.createElement('tr');

    const tdWord=document.createElement('td');
    const a=document.createElement('a');
    a.href=wiktionaryLink(item.word);
    a.target="_blank"; a.rel="noopener";
    a.textContent=item.word;
    tdWord.appendChild(a);

    const tdPos=document.createElement('td'); tdPos.textContent=item.pos || '';

    const tdPron=document.createElement('td');
    const spanIpa=document.createElement('span');
    spanIpa.textContent=(item.ipa && item.ipa.length)? `/${item.ipa[0]}/` : '';
    tdPron.appendChild(spanIpa);
    if (item.audio && item.audio.length){
      const b=document.createElement('button');
      b.className='icon-btn'; b.textContent='🔊'; b.title='Nghe phát âm'; b.ariaLabel='Nghe phát âm';
      b.style.marginLeft='8px';
      b.onclick=()=>playAudio(item.audio);
      tdPron.appendChild(b);
    }

    const tdMean=document.createElement('td');
    const firstMean = item.meaning || (item.meanings?item.meanings[0]:'');
    tdMean.textContent = firstMean;
    tdMean.title = (item.meanings && item.meanings.length>1) ? item.meanings.join(' | ') : firstMean;

    tr.append(tdWord,tdPos,tdPron,tdMean);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  resultsDetails.innerHTML = '';
  resultsDetails.appendChild(table);
}
function showResults(){
  setProgress(ORDER.length,ORDER.length);
  scoreText.textContent=`${score} / ${ORDER.length}`;
  resultsNote.textContent=`Số câu hỏi: ${DATASET.length}`;
  renderResultsDetails();
  openModal(resultsModal);
}

// ==== start/restart ====
function setProgress(c,t){
  const pct=t?(c/t)*100:0;
  progressBar.style.width=clamp(pct,0,100)+'%';
  progressText.textContent=`Câu ${c} trên ${t}`;
}
function startQuiz(note){
  if (!DATASET.length) return;
  score=0;qIndex=0;ORDER=shuffle([...Array(DATASET.length).keys()]);
  announce('Bắt đầu làm bài.');
  renderQuestion();
  if(note)resultsNote.textContent=note;
}
document.addEventListener('keydown',e=>{
  if(e.key==='r'||e.key==='R'){startQuiz();}
  if(resultsModal.getAttribute('aria-hidden')==='false'&&e.key==='Escape'){closeModal(resultsModal);}
  if(resultsModal.getAttribute('aria-hidden')==='false'&&(e.key==='r'||e.key==='R')){startQuiz();closeModal(resultsModal);}
  if(resultsModal.getAttribute('aria-hidden')==='false')return;
  const num=parseInt(e.key,10);
  if(num>=1&&num<=4){
    const opt=optionsEl.querySelectorAll('.option')[num-1];
    if(opt&&opt.getAttribute('aria-disabled')!=='true')opt.click();
  }
});
if (restartBtn) restartBtn.onclick=()=>{startQuiz();closeModal(resultsModal);};
if (restartInlineBtn) restartInlineBtn.onclick=()=>{startQuiz();};

// ==== Khởi tạo: khôi phục bộ gần nhất; set quote; nếu không có thì build default ====
async function initDefaultQuiz(){
  setRandomQuote();
  try{
    const restored = loadLastSet();
    if (restored) {
      DATASET = restored.dataset;
      startQuiz('Khôi phục bộ gần nhất ('+DATASET.length+' mục)');
      return;
    }

    // Build đề mặc định
    wordEl.textContent = "Đang tải đề mặc định…";
    progressBar.style.width='0%';
    progressText.textContent = "Đang chuẩn bị…";
    let pairs = await buildPairsFromWords(DEFAULT_WORDS);

    if (!needAtLeastFour(pairs)) {
      pairs = DEFAULT_FALLBACK_PAIRS;
    }
    DATASET = pairs;
    saveLastSet(DATASET, 'default');
    startQuiz('Đề mặc định ('+DATASET.length+' mục)');
  }catch{
    DATASET = DEFAULT_FALLBACK_PAIRS;
    saveLastSet(DATASET, 'default-fallback');
    startQuiz('Đề mặc định (fallback)');
  }
}
document.addEventListener('DOMContentLoaded', initDefaultQuiz);
