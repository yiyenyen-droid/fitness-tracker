// 主程式：畫面邏輯、計時器、資料綁定

const state = {
  selectedExerciseId: null,
  selectedRir: null,
  timer: { remaining: 0, total: 0, running: false, intervalId: null },
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function todayLabel() {
  const d = new Date();
  const days = ['日', '一', '二', '三', '四', '五', '六'];
  return `${d.getMonth() + 1}/${d.getDate()}（${days[d.getDay()]}）`;
}

function getExerciseById(id) {
  return Storage.getAllExercises().find(e => e.id === id);
}

// ---------- Tabs ----------
function initTabs() {
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.tab-btn').forEach(b => b.classList.remove('active'));
      $$('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      $(`#tab-${btn.dataset.tab}`).classList.add('active');
      if (btn.dataset.tab === 'history') renderHistory();
    });
  });
}

// ---------- Exercise pickers ----------
function populateGroupSelect(selectEl, includeAll) {
  selectEl.innerHTML = '';
  if (includeAll) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '全部部位';
    selectEl.appendChild(opt);
  }
  Object.entries(MUSCLE_GROUPS)
    .sort((a, b) => a[1].order - b[1].order)
    .forEach(([key, val]) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = val.name;
      selectEl.appendChild(opt);
    });
}

function populateExerciseSelect(selectEl, group) {
  selectEl.innerHTML = '';
  const exercises = Storage.getAllExercises()
    .filter(e => !group || e.group === group)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
  exercises.forEach(e => {
    const opt = document.createElement('option');
    opt.value = e.id;
    opt.textContent = e.name;
    selectEl.appendChild(opt);
  });
}

function initExercisePicker() {
  const groupSelect = $('#groupSelect');
  const exerciseSelect = $('#exerciseSelect');
  populateGroupSelect(groupSelect, false);
  groupSelect.value = 'chest';
  populateExerciseSelect(exerciseSelect, groupSelect.value);

  groupSelect.addEventListener('change', () => {
    populateExerciseSelect(exerciseSelect, groupSelect.value);
    selectExercise(exerciseSelect.value, true);
  });
  exerciseSelect.addEventListener('change', () => selectExercise(exerciseSelect.value, true));

  if (exerciseSelect.value) selectExercise(exerciseSelect.value, false);
}

// autoStartRest: 使用者手動切換動作時（表示要換下一個動作了）自動開始組間／動作間的休息倒數
function selectExercise(id, autoStartRest) {
  if (!id) return;
  state.selectedExerciseId = id;
  state.selectedRir = null;
  const ex = getExerciseById(id);

  $('#exercisePanel').classList.remove('hidden');
  $('#currentExerciseName').textContent = ex.name;
  $('#currentExerciseTag').textContent =
    `${MUSCLE_GROUPS[ex.group]?.name || ex.group} · ${ex.type === 'compound' ? '複合動作' : '孤立動作'}`;

  renderLastSessionRef(ex);
  resetTimerForExercise(ex);
  renderRestLabel(ex);
  renderTodaySetsForExercise(ex);
  clearRirSelection();
  $('#weightInput').value = '';
  $('#repsInput').value = '';

  if (autoStartRest) startTimer();
}

function renderLastSessionRef(ex) {
  const sessions = Storage.getSessionsForExercise(ex.id);
  const el = $('#lastSessionRef');
  if (!sessions.length) {
    el.textContent = '尚無歷史紀錄';
    return;
  }
  const last = sessions[0];
  const parts = last.sets.map(s => `${fmtNum(s.weight)}kg×${s.reps}(RIR${s.rir >= 4 ? '≥4' : s.rir})`);
  el.textContent = `上次（${last.date}）：${parts.join('、')}`;
}

function fmtNum(n) {
  return Number.isInteger(n) ? n : n;
}

// ---------- Set input ----------
function initSetInput() {
  $$('.stepper-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target === 'weight' ? '#weightInput' : '#repsInput';
      const input = $(targetId);
      const delta = parseFloat(btn.dataset.delta);
      const current = parseFloat(input.value) || 0;
      let next = current + delta;
      if (next < 0) next = 0;
      input.value = Number.isInteger(delta) ? Math.round(next) : next;
    });
  });

  $$('.rir-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.selectedRir = parseInt(btn.dataset.rir, 10);
      clearRirSelection();
      btn.classList.add('selected');
    });
  });

  $('#saveSetBtn').addEventListener('click', saveCurrentSet);
}

function clearRirSelection() {
  $$('.rir-btn').forEach(b => b.classList.remove('selected'));
}

function saveCurrentSet() {
  const weight = parseFloat($('#weightInput').value);
  const reps = parseInt($('#repsInput').value, 10);
  const rir = state.selectedRir;

  if (isNaN(weight) || weight < 0) return alert('請輸入重量');
  if (isNaN(reps) || reps <= 0) return alert('請輸入次數');
  if (rir === null || rir === undefined) return alert('請選擇 RIR（還能做幾下）');

  Storage.addSet({ exerciseId: state.selectedExerciseId, weight, reps, rir });

  const ex = getExerciseById(state.selectedExerciseId);
  renderTodaySetsForExercise(ex);
  renderTodayAll();
  renderSuggestions();
  clearRirSelection();
  state.selectedRir = null;
  startTimer(); // 紀錄完自動開始組間計時
}

function renderTodaySetsForExercise(ex) {
  const today = new Date().toISOString().slice(0, 10);
  const sets = Storage.getSetsForExercise(ex.id).filter(s => s.date === today);
  $('#todaySetsList').innerHTML = renderSetsList(sets, true, true);
  bindDeleteButtons('#todaySetsList', () => {
    renderTodaySetsForExercise(ex);
    renderTodayAll();
    renderSuggestions();
  });
}

function renderSetsList(sets, deletable, showExerciseName) {
  if (!sets.length) return '<div class="empty-hint">尚未紀錄</div>';
  return sets.map(s => `
    <div class="set-row" data-id="${s.id}">
      <div class="set-info">
        ${showExerciseName ? `<span class="ex-name-pill">${getExerciseById(s.exerciseId)?.name || ''}</span>` : ''}
        <span class="set-num">#${s.setNumber}</span>
        <span>${fmtNum(s.weight)}kg × ${s.reps}</span>
        <span class="rir-pill">RIR ${s.rir >= 4 ? '≥4' : s.rir}</span>
      </div>
      ${deletable ? `<button class="del-btn" data-id="${s.id}">✕</button>` : ''}
    </div>
  `).join('');
}

function bindDeleteButtons(containerSel, onDeleted) {
  $$(`${containerSel} .del-btn`).forEach(btn => {
    btn.addEventListener('click', () => {
      Storage.deleteSet(btn.dataset.id);
      onDeleted();
    });
  });
}

function renderTodayAll() {
  const today = new Date().toISOString().slice(0, 10);
  const sets = Storage.getSetsForDate(today);
  const exercises = Storage.getAllExercises();
  const byExercise = new Map();
  for (const s of sets) {
    if (!byExercise.has(s.exerciseId)) byExercise.set(s.exerciseId, []);
    byExercise.get(s.exerciseId).push(s);
  }
  if (!byExercise.size) {
    $('#todayAllList').innerHTML = '<div class="empty-hint">今天還沒有紀錄任何動作</div>';
    return;
  }
  let html = '';
  for (const [exId, exSets] of byExercise) {
    const ex = exercises.find(e => e.id === exId);
    html += `<div class="exercise-group-heading">${ex ? ex.name : exId}</div>`;
    html += renderSetsList(exSets, false);
  }
  $('#todayAllList').innerHTML = html;
}

// ---------- Timer ----------
function renderRestLabel(ex) {
  $('#restSecLabel').textContent = Storage.getRestSec(ex);
}

function resetTimerForExercise(ex) {
  stopTimer();
  const sec = Storage.getRestSec(ex);
  state.timer.total = sec;
  state.timer.remaining = sec;
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const { remaining } = state.timer;
  const m = Math.floor(Math.max(remaining, 0) / 60).toString().padStart(2, '0');
  const s = Math.floor(Math.max(remaining, 0) % 60).toString().padStart(2, '0');
  const el = $('#timerDisplay');
  el.textContent = `${m}:${s}`;
  el.classList.toggle('warning', remaining <= 10 && remaining > 0);
  el.classList.toggle('done', remaining <= 0);
}

function startTimer() {
  if (state.timer.remaining <= 0) {
    const ex = getExerciseById(state.selectedExerciseId);
    state.timer.remaining = Storage.getRestSec(ex);
    state.timer.total = state.timer.remaining;
  }
  if (state.timer.running) return;
  state.timer.running = true;
  $('#timerStartPause').textContent = '暫停';
  state.timer.intervalId = setInterval(() => {
    state.timer.remaining -= 1;
    updateTimerDisplay();
    if (state.timer.remaining <= 0) {
      clearInterval(state.timer.intervalId);
      state.timer.running = false;
      $('#timerStartPause').textContent = '開始';
      onTimerDone();
    }
  }, 1000);
}

function pauseTimer() {
  clearInterval(state.timer.intervalId);
  state.timer.running = false;
  $('#timerStartPause').textContent = '開始';
}

function stopTimer() {
  clearInterval(state.timer.intervalId);
  state.timer.running = false;
  $('#timerStartPause').textContent = '開始';
}

function onTimerDone() {
  playBeep();
  if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [880, 1046].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.28);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.28 + 0.25);
      osc.start(ctx.currentTime + i * 0.28);
      osc.stop(ctx.currentTime + i * 0.28 + 0.26);
    });
  } catch (e) { /* 部分瀏覽器需使用者互動才能播放音效，忽略錯誤 */ }
}

function initTimerControls() {
  $('#timerStartPause').addEventListener('click', () => {
    state.timer.running ? pauseTimer() : startTimer();
  });
  $('#timerReset').addEventListener('click', () => {
    const ex = getExerciseById(state.selectedExerciseId);
    resetTimerForExercise(ex);
  });
  $('#timerMinus').addEventListener('click', () => {
    state.timer.remaining = Math.max(0, state.timer.remaining - 15);
    updateTimerDisplay();
  });
  $('#timerPlus').addEventListener('click', () => {
    state.timer.remaining += 15;
    updateTimerDisplay();
  });
  $('#editRestBtn').addEventListener('click', () => {
    const ex = getExerciseById(state.selectedExerciseId);
    const current = Storage.getRestSec(ex);
    const input = prompt('設定這個動作的預設休息秒數：', current);
    if (input === null) return;
    const sec = parseInt(input, 10);
    if (isNaN(sec) || sec <= 0) return alert('請輸入正確的秒數');
    Storage.setRestSec(ex.id, sec);
    renderRestLabel(ex);
    resetTimerForExercise(ex);
  });
}

// ---------- Suggestions ----------
function renderSuggestions() {
  const suggestions = Suggestions.getActiveSuggestions();
  const area = $('#suggestionsArea');
  if (!suggestions.length) {
    area.innerHTML = '';
    return;
  }
  area.innerHTML = suggestions.map(s => `
    <div class="suggestion-card ${s.type}">
      <div class="suggestion-title">${s.type === 'increase' ? '📈' : '⚠️'} ${s.title}</div>
      <div class="suggestion-reason">為什麼：${s.reason}</div>
      <div class="suggestion-adjust">怎麼做：${s.adjust}</div>
      <button class="suggestion-dismiss" data-key="${s.key}">知道了，先不提醒</button>
    </div>
  `).join('');
  $$('.suggestion-dismiss').forEach(btn => {
    btn.addEventListener('click', () => {
      Storage.dismiss(btn.dataset.key);
      renderSuggestions();
    });
  });
}

// ---------- History ----------
function initHistoryTab() {
  const sel = $('#historyExerciseSelect');
  populateExerciseSelect(sel, null);
  sel.addEventListener('change', renderHistory);
}

function renderHistory() {
  const sel = $('#historyExerciseSelect');
  if (!sel.value) {
    populateExerciseSelect(sel, null);
  }
  const exId = sel.value;
  const list = $('#historyList');
  if (!exId) {
    list.innerHTML = '<div class="empty-hint">請選擇一個動作</div>';
    return;
  }
  const sessions = Storage.getSessionsForExercise(exId);
  if (!sessions.length) {
    list.innerHTML = '<div class="empty-hint">尚無歷史紀錄</div>';
    return;
  }
  list.innerHTML = sessions.map(sess => `
    <div class="history-session">
      <div class="history-session-date">${sess.date}</div>
      <div class="sets-list">${renderSetsList(sess.sets, false)}</div>
    </div>
  `).join('');
}

// ---------- Custom exercise modal ----------
function initCustomExerciseModal() {
  const modal = $('#customExerciseModal');
  populateGroupSelect($('#customExGroup'), false);

  $('#addCustomBtn').addEventListener('click', () => modal.classList.remove('hidden'));
  $('#customExCancel').addEventListener('click', () => modal.classList.add('hidden'));

  $('#customExSave').addEventListener('click', () => {
    const name = $('#customExName').value.trim();
    const group = $('#customExGroup').value;
    const type = $('#customExType').value;
    if (!name) return alert('請輸入動作名稱');

    const ex = Storage.addCustomExercise({ name, group, type });
    modal.classList.add('hidden');
    $('#customExName').value = '';

    $('#groupSelect').value = group;
    populateExerciseSelect($('#exerciseSelect'), group);
    $('#exerciseSelect').value = ex.id;
    selectExercise(ex.id);
    populateExerciseSelect($('#historyExerciseSelect'), null);
  });
}

// ---------- Init ----------
function init() {
  $('#todayDate').textContent = todayLabel();
  initTabs();
  initExercisePicker();
  initSetInput();
  initTimerControls();
  initHistoryTab();
  initCustomExerciseModal();
  renderSuggestions();
  renderTodayAll();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
