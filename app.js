// 主程式：畫面邏輯、計時器、資料綁定

const state = {
  selectedExerciseId: null,
  selectedRir: null,
  editingSetId: null,
  editingRir: null,
  editingOnSaved: null,
  beepAudioEl: null,
  timer: { remaining: 0, total: 0, running: false, intervalId: null },
};

// 短提示音（880Hz + 1046Hz 兩聲），用 <audio> 播放而不是 Web Audio API 現場合成，
// 因為 iPhone「加到主畫面」開啟的 App（standalone 模式）對 Web Audio API 常常不給播音效，
// 但用 <audio> 元素配合「使用者第一次點擊時先播一次」解鎖，相容性好很多。
const BEEP_SOUND_SRC = 'beep.wav';

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

  $$('#rirOptions .rir-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.selectedRir = parseInt(btn.dataset.rir, 10);
      clearRirSelection();
      btn.classList.add('selected');
    });
  });

  $('#saveSetBtn').addEventListener('click', saveCurrentSet);
}

function clearRirSelection() {
  $$('#rirOptions .rir-btn').forEach(b => b.classList.remove('selected'));
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
      ${deletable ? `
        <div class="row-actions">
          <button class="edit-btn" data-id="${s.id}">✏️</button>
          <button class="del-btn" data-id="${s.id}">✕</button>
        </div>
      ` : ''}
    </div>
  `).join('');
}

function bindDeleteButtons(containerSel, onChanged) {
  $$(`${containerSel} .del-btn`).forEach(btn => {
    btn.addEventListener('click', () => {
      Storage.deleteSet(btn.dataset.id);
      onChanged();
    });
  });
  $$(`${containerSel} .edit-btn`).forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id, onChanged));
  });
}

// ---------- Edit set modal ----------
function initEditModal() {
  const modal = $('#editSetModal');
  $$('#editRirOptions .rir-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.editingRir = parseInt(btn.dataset.rir, 10);
      $$('#editRirOptions .rir-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });
  $('#editSetCancel').addEventListener('click', () => modal.classList.add('hidden'));
  $('#editSetSave').addEventListener('click', saveEditedSet);
}

function openEditModal(id, onSaved) {
  const set = Storage.getAllSets().find(s => s.id === id);
  if (!set) return;
  state.editingSetId = id;
  state.editingRir = set.rir;
  state.editingOnSaved = onSaved;
  $('#editWeightInput').value = set.weight;
  $('#editRepsInput').value = set.reps;
  $$('#editRirOptions .rir-btn').forEach(b => {
    b.classList.toggle('selected', parseInt(b.dataset.rir, 10) === set.rir);
  });
  $('#editSetModal').classList.remove('hidden');
}

function saveEditedSet() {
  const weight = parseFloat($('#editWeightInput').value);
  const reps = parseInt($('#editRepsInput').value, 10);
  const rir = state.editingRir;

  if (isNaN(weight) || weight < 0) return alert('請輸入重量');
  if (isNaN(reps) || reps <= 0) return alert('請輸入次數');
  if (rir === null || rir === undefined) return alert('請選擇 RIR（還能做幾下）');

  Storage.updateSet(state.editingSetId, { weight, reps, rir });
  $('#editSetModal').classList.add('hidden');

  if (state.editingOnSaved) state.editingOnSaved();
  renderTodayAll();
  renderSuggestions();
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

// 手機瀏覽器（尤其 iPhone「加到主畫面」開的 App）規定音效一定要在「使用者親自點擊」的當下才能解鎖，
// 倒數結束是計時器自動觸發、不算使用者點擊，所以要在使用者第一次點擊畫面時，
// 就先把這個 <audio> 元素播一次（馬上暫停），之後才能用同一個元素真的播出聲音。
function unlockAudio() {
  if (state.beepAudioEl) return;
  try {
    const audio = new Audio(BEEP_SOUND_SRC);
    audio.volume = 1;
    const p = audio.play();
    if (p && p.then) {
      p.then(() => {
        audio.pause();
        audio.currentTime = 0;
      }).catch(() => {});
    }
    state.beepAudioEl = audio;
  } catch (e) { /* 瀏覽器不支援，略過 */ }
}

function playBeep() {
  if (!state.beepAudioEl) unlockAudio();
  const audio = state.beepAudioEl;
  if (!audio) return;
  try {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch (e) { /* 忽略播放失敗 */ }
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
  const groupSel = $('#historyGroupSelect');
  const exSel = $('#historyExerciseSelect');
  populateGroupSelect(groupSel, false);
  groupSel.value = 'chest';
  populateExerciseSelect(exSel, groupSel.value);

  groupSel.addEventListener('change', () => {
    populateExerciseSelect(exSel, groupSel.value);
    renderHistory();
  });
  exSel.addEventListener('change', renderHistory);
}

function renderHistory() {
  const exId = $('#historyExerciseSelect').value;
  const lastWeightEl = $('#historyLastWeight');
  const list = $('#historyList');

  if (!exId) {
    lastWeightEl.innerHTML = '';
    list.innerHTML = '<div class="empty-hint">請選擇一個動作</div>';
    return;
  }

  const ex = getExerciseById(exId);
  const sessions = Storage.getSessionsForExercise(exId);

  if (!sessions.length) {
    lastWeightEl.innerHTML = `
      <div class="last-weight-title">${ex.name}</div>
      <div class="last-weight-empty">尚無歷史紀錄，練過一次之後這裡就會顯示上次重量</div>
    `;
    list.innerHTML = '<div class="empty-hint">尚無歷史紀錄</div>';
    return;
  }

  const last = sessions[0];
  const topSet = last.sets.reduce((a, b) => (b.weight > a.weight ? b : a));
  const latestSet = last.sets[last.sets.length - 1];
  lastWeightEl.innerHTML = `
    <div class="last-weight-title">${ex.name}　<span class="tag">${last.date}</span></div>
    <div class="last-weight-stats">
      <div class="last-weight-stat">
        <div class="last-weight-stat-label">當天最重一組</div>
        <div class="last-weight-value">${fmtNum(topSet.weight)}<span class="last-weight-unit">kg</span></div>
        <div class="last-weight-detail">${topSet.reps} 下・RIR ${topSet.rir >= 4 ? '≥4' : topSet.rir}</div>
      </div>
      <div class="last-weight-stat">
        <div class="last-weight-stat-label">最近一次重量（最後一組）</div>
        <div class="last-weight-value">${fmtNum(latestSet.weight)}<span class="last-weight-unit">kg</span></div>
        <div class="last-weight-detail">${latestSet.reps} 下・RIR ${latestSet.rir >= 4 ? '≥4' : latestSet.rir}</div>
      </div>
    </div>
    <div class="last-weight-allsets">全部組數：${last.sets.map(s => `${fmtNum(s.weight)}kg×${s.reps}(RIR${s.rir >= 4 ? '≥4' : s.rir})`).join('、')}</div>
  `;

  list.innerHTML = sessions.map(sess => `
    <div class="history-session">
      <div class="history-session-date">${sess.date}</div>
      <div class="sets-list">${renderSetsList(sess.sets, false, true)}</div>
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
    $('#historyGroupSelect').value = group;
    populateExerciseSelect($('#historyExerciseSelect'), group);
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
  initEditModal();
  renderSuggestions();
  renderTodayAll();

  document.addEventListener('pointerdown', unlockAudio, { once: true });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
