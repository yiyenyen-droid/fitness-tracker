// 動作資料庫：自由重量健身常見動作
// type: 'compound' 複合動作（多關節、系統性疲勞較大）｜ 'isolation' 孤立動作（單關節、局部疲勞為主）
// increment: 建議加重的預設幅度（kg）
// restSec: 建議組間休息秒數（可在畫面上依動作或個人習慣調整）

const MUSCLE_GROUPS = {
  chest:     { name: '胸部', order: 1 },
  back:      { name: '背部', order: 2 },
  shoulders: { name: '肩部', order: 3 },
  legs:      { name: '腿部', order: 4 },
  arms:      { name: '手臂', order: 5 },
  core:      { name: '核心', order: 6 },
};

const EXERCISES = [
  // 胸部
  { id: 'bench_press',            name: '槓鈴臥推',       group: 'chest', type: 'compound',  increment: 2.5, restSec: 150 },
  { id: 'incline_bench_press',    name: '上斜槓鈴臥推',   group: 'chest', type: 'compound',  increment: 2.5, restSec: 150 },
  { id: 'decline_bench_press',    name: '下斜槓鈴臥推',   group: 'chest', type: 'compound',  increment: 2.5, restSec: 150 },
  { id: 'db_bench_press',         name: '啞鈴臥推',       group: 'chest', type: 'compound',  increment: 2.5, restSec: 120 },
  { id: 'incline_db_bench_press', name: '上斜啞鈴臥推',   group: 'chest', type: 'compound',  increment: 2.5, restSec: 120 },
  { id: 'decline_db_bench_press', name: '下斜啞鈴臥推',   group: 'chest', type: 'compound',  increment: 2.5, restSec: 120 },
  { id: 'db_fly',                 name: '啞鈴飛鳥',       group: 'chest', type: 'isolation', increment: 1.25, restSec: 75 },
  { id: 'incline_db_fly',         name: '上斜啞鈴飛鳥',   group: 'chest', type: 'isolation', increment: 1.25, restSec: 75 },
  { id: 'dips_chest',             name: '雙槓撐體（胸）', group: 'chest', type: 'compound',  increment: 2.5, restSec: 120 },

  // 背部
  { id: 'deadlift',               name: '硬舉',           group: 'back', type: 'compound',  increment: 5,   restSec: 180 },
  { id: 'romanian_deadlift',      name: '羅馬尼亞硬舉',   group: 'back', type: 'compound',  increment: 5,   restSec: 150 },
  { id: 'barbell_row',            name: '槓鈴俯身划船',   group: 'back', type: 'compound',  increment: 2.5, restSec: 120 },
  { id: 'db_row',                 name: '啞鈴單臂划船',   group: 'back', type: 'compound',  increment: 2.5, restSec: 90 },
  { id: 't_bar_row',              name: 'T槓划船',        group: 'back', type: 'compound',  increment: 2.5, restSec: 120 },
  { id: 'pull_up',                name: '引體向上',       group: 'back', type: 'compound',  increment: 2.5, restSec: 120 },
  { id: 'chin_up',                name: '反手引體向上',   group: 'back', type: 'compound',  increment: 2.5, restSec: 120 },
  { id: 'barbell_shrug',          name: '槓鈴聳肩',       group: 'back', type: 'isolation', increment: 5,   restSec: 75 },

  // 肩部
  { id: 'overhead_press',         name: '槓鈴肩推',       group: 'shoulders', type: 'compound',  increment: 2.5, restSec: 150 },
  { id: 'db_shoulder_press',      name: '啞鈴肩推',       group: 'shoulders', type: 'compound',  increment: 2.5, restSec: 120 },
  { id: 'arnold_press',           name: '阿諾德推舉',     group: 'shoulders', type: 'compound',  increment: 2.5, restSec: 120 },
  { id: 'lateral_raise',          name: '啞鈴側平舉',     group: 'shoulders', type: 'isolation', increment: 1.25, restSec: 60 },
  { id: 'front_raise',            name: '啞鈴前平舉',     group: 'shoulders', type: 'isolation', increment: 1.25, restSec: 60 },
  { id: 'rear_delt_raise',        name: '俯身反向飛鳥',   group: 'shoulders', type: 'isolation', increment: 1.25, restSec: 60 },
  { id: 'upright_row',            name: '直立划船',       group: 'shoulders', type: 'isolation', increment: 2.5, restSec: 75 },

  // 腿部
  { id: 'back_squat',             name: '槓鈴深蹲',       group: 'legs', type: 'compound',  increment: 5, restSec: 180 },
  { id: 'front_squat',            name: '前蹲',           group: 'legs', type: 'compound',  increment: 5, restSec: 180 },
  { id: 'goblet_squat',           name: '高腳杯深蹲',     group: 'legs', type: 'compound',  increment: 2.5, restSec: 120 },
  { id: 'bulgarian_split_squat',  name: '保加利亞分腿蹲', group: 'legs', type: 'compound',  increment: 2.5, restSec: 120 },
  { id: 'lunge',                  name: '弓步蹲',         group: 'legs', type: 'compound',  increment: 2.5, restSec: 120 },
  { id: 'stiff_leg_deadlift',     name: '直腿硬舉',       group: 'legs', type: 'compound',  increment: 5, restSec: 150 },
  { id: 'hip_thrust',             name: '槓鈴臀推',       group: 'legs', type: 'compound',  increment: 5, restSec: 150 },
  { id: 'step_up',                name: '負重登階',       group: 'legs', type: 'compound',  increment: 2.5, restSec: 120 },
  { id: 'calf_raise',             name: '站姿提踵',       group: 'legs', type: 'isolation', increment: 5, restSec: 60 },

  // 手臂
  { id: 'barbell_curl',           name: '槓鈴彎舉',       group: 'arms', type: 'isolation', increment: 2.5, restSec: 75 },
  { id: 'db_curl',                name: '啞鈴彎舉',       group: 'arms', type: 'isolation', increment: 1.25, restSec: 75 },
  { id: 'hammer_curl',            name: '錘式彎舉',       group: 'arms', type: 'isolation', increment: 1.25, restSec: 75 },
  { id: 'concentration_curl',     name: '集中彎舉',       group: 'arms', type: 'isolation', increment: 1.25, restSec: 60 },
  { id: 'preacher_curl',          name: '牧師椅彎舉',     group: 'arms', type: 'isolation', increment: 2.5, restSec: 75 },
  { id: 'close_grip_bench',       name: '窄握臥推',       group: 'arms', type: 'compound',  increment: 2.5, restSec: 120 },
  { id: 'skull_crusher',          name: '法式彎舉',       group: 'arms', type: 'isolation', increment: 1.25, restSec: 75 },
  { id: 'overhead_triceps_ext',   name: '頸後臂屈伸',     group: 'arms', type: 'isolation', increment: 1.25, restSec: 75 },
  { id: 'bench_dips',             name: '椅上撐體（三頭）', group: 'arms', type: 'isolation', increment: 2.5, restSec: 75 },

  // 核心
  { id: 'weighted_situp',         name: '負重捲腹',       group: 'core', type: 'isolation', increment: 1.25, restSec: 60 },
  { id: 'weighted_russian_twist', name: '負重俄羅斯轉體', group: 'core', type: 'isolation', increment: 1.25, restSec: 60 },
  { id: 'ab_wheel_rollout',       name: '滾輪捲腹',       group: 'core', type: 'compound',  increment: 0, restSec: 90 },
  { id: 'weighted_side_bend',     name: '負重側彎',       group: 'core', type: 'isolation', increment: 1.25, restSec: 60 },
  { id: 'farmers_walk',           name: '農夫走路',       group: 'core', type: 'compound',  increment: 2.5, restSec: 90 },
  { id: 'kettlebell_swing',       name: '壺鈴擺盪',       group: 'core', type: 'compound',  increment: 2, restSec: 90 },
];

// 上肢 vs 下肢分類，用於文字說明（不影響邏輯，只用於顯示）
const LOWER_BODY_GROUPS = new Set(['legs']);
