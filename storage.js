// 本機儲存層：所有資料存在 localStorage，離線可用

const LS_KEYS = {
  sets: 'ft_sets',
  customExercises: 'ft_custom_exercises',
  restOverrides: 'ft_rest_overrides',
  dismissed: 'ft_dismissed_suggestions',
};

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error('讀取資料失敗', key, e);
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const Storage = {
  getAllExercises() {
    const custom = loadJSON(LS_KEYS.customExercises, []);
    return [...EXERCISES, ...custom];
  },

  addCustomExercise({ name, group, type }) {
    const custom = loadJSON(LS_KEYS.customExercises, []);
    const ex = {
      id: 'custom_' + uid(),
      name,
      group,
      type,
      increment: type === 'compound' ? 2.5 : 1.25,
      restSec: type === 'compound' ? 120 : 75,
      custom: true,
    };
    custom.push(ex);
    saveJSON(LS_KEYS.customExercises, custom);
    return ex;
  },

  getRestSec(exercise) {
    const overrides = loadJSON(LS_KEYS.restOverrides, {});
    return overrides[exercise.id] ?? exercise.restSec;
  },

  setRestSec(exerciseId, seconds) {
    const overrides = loadJSON(LS_KEYS.restOverrides, {});
    overrides[exerciseId] = seconds;
    saveJSON(LS_KEYS.restOverrides, overrides);
  },

  getAllSets() {
    return loadJSON(LS_KEYS.sets, []);
  },

  addSet({ exerciseId, weight, reps, rir }) {
    const sets = loadJSON(LS_KEYS.sets, []);
    const date = todayStr();
    const setsToday = sets.filter(s => s.exerciseId === exerciseId && s.date === date);
    const record = {
      id: uid(),
      date,
      timestamp: new Date().toISOString(),
      exerciseId,
      setNumber: setsToday.length + 1,
      weight,
      reps,
      rir,
    };
    sets.push(record);
    saveJSON(LS_KEYS.sets, sets);
    return record;
  },

  deleteSet(id) {
    const sets = loadJSON(LS_KEYS.sets, []).filter(s => s.id !== id);
    saveJSON(LS_KEYS.sets, sets);
  },

  getSetsForDate(date) {
    return this.getAllSets().filter(s => s.date === date);
  },

  getSetsForExercise(exerciseId) {
    return this.getAllSets()
      .filter(s => s.exerciseId === exerciseId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  },

  // 依日期分組，回傳依日期新到舊排序的 session 陣列：[{date, sets:[...]}]
  getSessionsForExercise(exerciseId, beforeDate = null) {
    let sets = this.getSetsForExercise(exerciseId);
    if (beforeDate) sets = sets.filter(s => s.date < beforeDate);
    const byDate = new Map();
    for (const s of sets) {
      if (!byDate.has(s.date)) byDate.set(s.date, []);
      byDate.get(s.date).push(s);
    }
    return [...byDate.entries()]
      .map(([date, sets]) => ({ date, sets }))
      .sort((a, b) => b.date.localeCompare(a.date));
  },

  getSetsForMuscleGroupSince(group, sinceDate) {
    const exercises = this.getAllExercises().filter(e => e.group === group);
    const ids = new Set(exercises.map(e => e.id));
    return this.getAllSets().filter(s => ids.has(s.exerciseId) && s.date >= sinceDate);
  },

  isDismissed(key) {
    const d = loadJSON(LS_KEYS.dismissed, {});
    return !!d[key];
  },

  dismiss(key) {
    const d = loadJSON(LS_KEYS.dismissed, {});
    d[key] = todayStr();
    saveJSON(LS_KEYS.dismissed, d);
  },
};
