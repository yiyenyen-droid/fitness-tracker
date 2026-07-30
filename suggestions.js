// 建議引擎：根據 RIR 趨勢判斈是否該加重或減量
// 每個建議都包含 message（怎麼調整）與 reason（為什麼觸發）

function maxWeight(sets) {
  return Math.max(...sets.map(s => s.weight));
}

function avgRir(sets) {
  if (!sets.length) return null;
  return sets.reduce((sum, s) => sum + s.rir, 0) / sets.length;
}

function fmt(n) {
  return Number.isInteger(n) ? n : n.toFixed(1);
}

const Suggestions = {
  // 單一動作：加重建議 —— 連續2次訓練所有正式組 RIR >= 3
  checkWeightIncrease(exercise) {
    const sessions = Storage.getSessionsForExercise(exercise.id);
    if (sessions.length < 2) return null;
    const last2 = sessions.slice(0, 2);
    const allHigh = last2.every(sess => sess.sets.every(s => s.rir >= 3));
    if (!allHigh) return null;

    const recentMax = maxWeight(last2[0].sets);
    const adjust = exercise.increment > 0
      ? `下次訓練建議加重 ${exercise.increment}kg（約 ${fmt(recentMax + exercise.increment)}kg）`
      : `建議增加次數，或改做更進階的變化動作（此動作不易直接加重）`;

    return {
      key: `inc_${exercise.id}`,
      type: 'increase',
      exerciseId: exercise.id,
      title: `${exercise.name}：可以加重了`,
      reason: `最近 2 次訓練，所有正式組的 RIR 都在 3 以上，代表目前重量對你來說餘力充足、刺激已經不夠。`,
      adjust,
    };
  },

  // 單一動作：減量建議 —— 複合動作連續2次／孤立動作連續3次 RIR 0-1 且沒有進步
  checkExerciseDeload(exercise) {
    const N = exercise.type === 'compound' ? 2 : 3;
    const sessions = Storage.getSessionsForExercise(exercise.id);
    if (sessions.length < N) return null;
    const lastN = sessions.slice(0, N);
    const allLow = lastN.every(sess => sess.sets.every(s => s.rir <= 1));
    if (!allLow) return null;

    const recentMax = maxWeight(lastN[0].sets);
    const oldMax = maxWeight(lastN[N - 1].sets);
    const stagnant = recentMax <= oldMax;
    if (!stagnant) return null;

    const target = Math.round(recentMax * 0.65 * 2) / 2; // 取到0.5kg
    return {
      key: `deload_ex_${exercise.id}`,
      type: 'deload_exercise',
      exerciseId: exercise.id,
      title: `${exercise.name}：建議這次降量`,
      reason: `連續 ${N} 次訓練都逼近力竭（RIR 0-1），而且重量沒有進步（這次 ${fmt(recentMax)}kg，${N}次前 ${fmt(oldMax)}kg），代表疲勞已經累積，硬撐下去容易停滯或受傷。`,
      adjust: `這次訓練該動作建議降到平常重量的 60-70%（約 ${target}kg），或減少組數，讓身體恢復。`,
    };
  },

  // 肌群層級：本週平均 RIR 明顯低於上週，且持續偏低 → 建議整個肌群減量
  checkMuscleGroupDeload(group) {
    const groupName = MUSCLE_GROUPS[group]?.name || group;
    const exercises = Storage.getAllExercises().filter(e => e.group === group);
    const ids = new Set(exercises.map(e => e.id));
    const allSets = Storage.getAllSets().filter(s => ids.has(s.exerciseId));
    if (!allSets.length) return null;

    const today = new Date();
    const daysAgo = n => {
      const d = new Date(today);
      d.setDate(d.getDate() - n);
      return d.toISOString().slice(0, 10);
    };
    const thisWeekStart = daysAgo(6);
    const lastWeekStart = daysAgo(13);

    const thisWeekSets = allSets.filter(s => s.date >= thisWeekStart);
    const lastWeekSets = allSets.filter(s => s.date >= lastWeekStart && s.date < thisWeekStart);

    const thisAvg = avgRir(thisWeekSets);
    const lastAvg = avgRir(lastWeekSets);
    if (thisAvg === null || lastAvg === null) return null;

    const droppedSignificantly = thisAvg <= lastAvg - 1;
    const stillLow = thisAvg <= 1.5;
    if (!droppedSignificantly || !stillLow) return null;

    return {
      key: `deload_group_${group}`,
      type: 'deload_group',
      group,
      title: `${groupName}整體：建議這週降量`,
      reason: `${groupName}相關動作本週平均 RIR（${fmt(thisAvg)}）比上週（${fmt(lastAvg)}）明顯下降，且持續偏低，代表這個部位整體疲勞持續累積，不是單一動作的問題。`,
      adjust: `建議這週${groupName}相關動作整體降到平常重量或組數的 60-70%，優先讓這個部位恢復，下週再恢復正常強度。`,
    };
  },

  // 收集所有目前成立、且尚未被使用者關閉的建議
  getActiveSuggestions() {
    const exercises = Storage.getAllExercises();
    const results = [];

    for (const ex of exercises) {
      const inc = this.checkWeightIncrease(ex);
      if (inc && !Storage.isDismissed(inc.key)) results.push(inc);

      const deload = this.checkExerciseDeload(ex);
      if (deload && !Storage.isDismissed(deload.key)) results.push(deload);
    }

    for (const group of Object.keys(MUSCLE_GROUPS)) {
      const groupDeload = this.checkMuscleGroupDeload(group);
      if (groupDeload && !Storage.isDismissed(groupDeload.key)) results.push(groupDeload);
    }

    return results;
  },
};
