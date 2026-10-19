/* 薄肌健康 - 计算公式（v1.2：MET消耗 + 目标系数） */
(function (global) {
  var ACTIVITY_FACTORS = {
    '久坐': 1.2,
    '轻度活动': 1.375,
    '中度活动': 1.55,
    '高度活动': 1.725
  };

  var MET = {
    '快走': 4.0,
    '慢跑': 7.0,
    '力量': 6.0,
    '骑行': 6.5,
    '游泳': 8.0,
    '其他': 5.0
  };

  /* v1.4：自由文本运动类型按强度取MET兜底 */
  var INTENSITY_MET = { '低': 3.5, '中': 5.0, '高': 8.0 };

  var GOAL_FACTORS = { '减脂': 0.85, '增肌': 1.15, '维持': 1.0 };

  /* Mifflin-St Jeor */
  function bmr(gender, weightKg, heightCm, age) {
    var base = 10 * weightKg + 6.25 * heightCm - 5 * age;
    return Math.round(gender === 'male' ? base + 5 : base - 161);
  }

  function tdee(bmrVal, activityLabel) {
    var factor = ACTIVITY_FACTORS[activityLabel] || 1.2;
    return Math.round(bmrVal * factor);
  }

  function goalFactor(goalType) {
    return GOAL_FACTORS[goalType] || 0.85;
  }

  /* 运动消耗 = 体重 × MET × 时长(小时) */
  function moveKcal(weightKg, met, minutes) {
    return Math.round(weightKg * met * (minutes / 60));
  }

  /* 已醒小时（简化：当日0点到现在） */
  function awakeHours(date) {
    var d = date || new Date();
    return d.getHours() + d.getMinutes() / 60;
  }

  /* 今日总消耗 ≈ BMR/24×已醒小时 + 运动消耗；历史日按24小时算 */
  function todayBurnKcal(bmrVal, moveBurn, dateKey) {
    var hours = (dateKey && dateKey !== Store.todayKey()) ? 24 : awakeHours();
    return Math.round(bmrVal * hours / 24) + (moveBurn || 0);
  }

  /* 减脂预估(g) = (消耗 - 摄入) × 0.13，正=减脂，负=增重 */
  function fatChangeGrams(burnKcal, intakeKcal) {
    return Math.round((burnKcal - intakeKcal) * 0.13);
  }

  /* 蛋白目标 1.2~1.6 g/kg */
  function proteinTarget(weightKg) {
    return [Math.round(weightKg * 1.2), Math.round(weightKg * 1.6)];
  }

  /* v1.3 科学营养目标（兜底） */
  function proteinGoal(weightKg, goalType) {
    return Math.round(weightKg * (goalType === '增肌' ? 2.0 : 1.6));
  }
  function fatGoal(weightKg) {
    return Math.round(weightKg * 0.8);
  }
  function carbGoal(kcalGoal, proteinG, fatG) {
    return Math.max(50, Math.round((kcalGoal - proteinG * 4 - fatG * 9) / 4));
  }
  function nutritionGoals(weightKg, goalType, kcalGoal) {
    var p = proteinGoal(weightKg, goalType);
    var f = fatGoal(weightKg);
    return { protein: p, fat: f, carb: carbGoal(kcalGoal, p, f) };
  }

  /* 饮水目标 体重×35ml，取整到50 */
  function waterGoal(weightKg) {
    return Math.round(weightKg * 35 / 50) * 50;
  }

  /* kg <-> lb */
  function kgToLb(kg) { return Math.round(kg * 2.2046 * 10) / 10; }
  function lbToKg(lb) { return Math.round(lb / 2.2046 * 10) / 10; }

  /* 睡眠时长（跨午夜） */
  function sleepHours(bedTimeStr, wakeTimeStr) {
    if (!bedTimeStr || !wakeTimeStr) return 0;
    var bed = parseHM(bedTimeStr);
    var wake = parseHM(wakeTimeStr);
    if (bed === null || wake === null) return 0;
    var mins = wake - bed;
    if (mins <= 0) mins += 24 * 60;
    return Math.round(mins / 60 * 10) / 10;
  }

  function parseHM(str) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(str.trim());
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  }

  function computeAll(profile) {
    var b = bmr(profile.gender, profile.weight, profile.height, profile.age);
    var t = tdee(b, profile.activity);
    var calorieGoal = Math.round(t * goalFactor(profile.goalType));
    return {
      bmr: b,
      tdee: t,
      calorieGoal: calorieGoal,
      proteinRange: proteinTarget(profile.weight),
      waterGoalDefault: waterGoal(profile.weight)
    };
  }

  global.Calc = {
    ACTIVITY_FACTORS: ACTIVITY_FACTORS,
    MET: MET,
    INTENSITY_MET: INTENSITY_MET,
    GOAL_FACTORS: GOAL_FACTORS,
    bmr: bmr,
    tdee: tdee,
    goalFactor: goalFactor,
    proteinGoal: proteinGoal,
    fatGoal: fatGoal,
    carbGoal: carbGoal,
    nutritionGoals: nutritionGoals,
    moveKcal: moveKcal,
    awakeHours: awakeHours,
    todayBurnKcal: todayBurnKcal,
    fatChangeGrams: fatChangeGrams,
    proteinTarget: proteinTarget,
    waterGoal: waterGoal,
    sleepHours: sleepHours,
    kgToLb: kgToLb,
    lbToKg: lbToKg,
    computeAll: computeAll
  };
})(window);
