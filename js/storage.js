/* 薄肌健康 - localStorage 封装（v1.7：基础代谢三源 + 数字周 + 周复盘结论 + 体重同步） */
(function (global) {
  var PROFILE_KEY = 'bm_profile';
  var RECORDS_KEY = 'bm_records';
  var SETTINGS_KEY = 'bm_settings';
  var SLEEP_KEY = 'bm_sleepLogs';
  var MEALS = ['早餐', '午餐', '晚餐', '加餐', '饮料'];

  function todayKey(d) {
    var date = d || new Date();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return date.getFullYear() + '-' + m + '-' + day;
  }

  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch (e) {
      alert('存储空间不足，请清理旧照片或数据');
      return false;
    }
  }

  /* ---------- 空结构 ---------- */
  function emptyEat() {
    var e = { total: 0, totals: { kcal: 0, carb: 0, protein: 0, fat: 0 } };
    MEALS.forEach(function (m) { e[m] = { kcal: 0, carb: 0, protein: 0, fat: 0, desc: '', img: '', time: '', review: '', advice: '' }; });
    return e;
  }
  function emptyMove() { return { logs: [], todayBurn: 0 }; }
  function emptyWater() { return { goal: null, total: 0, logs: [] }; }

  /* ---------- 档案 ---------- */
  function getProfile() { return readJSON(PROFILE_KEY, null); }
  /* startDate 首次保存自动落库，界面上不可改 */
  function saveProfile(profile) {
    if (profile && !profile.startDate) profile.startDate = todayKey();
    return writeJSON(PROFILE_KEY, profile);
  }

  function getSettings() { return readJSON(SETTINGS_KEY, { aiProvider: '元宝', unit: 'kg' }); }
  function saveSettings(s) { return writeJSON(SETTINGS_KEY, s); }

  /* ---------- 目标体系（v1.3：AI导入 > 档案手动 > 科学公式） ---------- */
  function aiGoals() {
    var p = getProfile();
    return (p && p.ai) || {};
  }

  function waterGoalNow() {
    var p = getProfile();
    if (!p) return null;
    var ai = aiGoals();
    if (ai.water) return ai.water;
    if (p.waterGoalManual) return p.waterGoalManual;
    if (p.weight) return Math.round(p.weight * 35 / 50) * 50;
    return null;
  }
  function calorieGoalNow() {
    var p = getProfile();
    if (!p) return null;
    var ai = aiGoals();
    if (ai.kcal) return ai.kcal;
    if (!p.weight || !p.height || !p.age) return null;
    var b = bmrNow();
    var t = Calc.tdee(b, p.activity);
    return Math.round(t * Calc.goalFactor(p.goalType));
  }
  function proteinGoalNow() {
    var p = getProfile();
    var ai = aiGoals();
    if (ai.protein) return ai.protein;
    if (!p || !p.weight) return null;
    return Calc.proteinGoal(p.weight, p.goalType);
  }
  function carbGoalNow() {
    var p = getProfile();
    var ai = aiGoals();
    if (ai.carb) return ai.carb;
    if (!p || !p.weight) return null;
    var kcal = calorieGoalNow() || 0;
    return Calc.carbGoal(kcal, Calc.proteinGoal(p.weight, p.goalType), Calc.fatGoal(p.weight));
  }
  function fatGoalNow() {
    var p = getProfile();
    var ai = aiGoals();
    if (ai.fat) return ai.fat;
    if (!p || !p.weight) return null;
    return Calc.fatGoal(p.weight);
  }
  function sleepGoalNow() {
    var p = getProfile();
    var ai = aiGoals();
    if (ai.sleep) return ai.sleep;
    return (p && p.sleepGoal) || 8;
  }
  /* AI导入的消耗目标（v1.5）；无导入返回 null，由界面回退 TDEE 默认估算 */
  function burnGoalNow() {
    return aiGoals().burnGoal || null;
  }

  function saveAiGoals(obj) {
    var p = getProfile() || {};
    p.ai = Object.assign({}, p.ai, obj);
    var notes = [];
    if (p.ai.moveAdvice) notes.push('运动建议：' + p.ai.moveAdvice);
    if (p.ai.dietAdvice) notes.push('饮食建议：' + p.ai.dietAdvice);
    if (notes.length) p.aiAdvice = notes.join('；');
    p.aiAdviceAt = new Date().toISOString();
    return saveProfile(p);
  }

  /* ---------- 基础代谢三源（v1.7）
     优先级：周复盘解析 > 手动填写 > 首次AI计算 > 公式兜底 ---------- */
  function bmrNow() {
    var p = getProfile();
    if (!p) return null;
    if (p.bmrAuto) return p.bmrAuto;
    if (p.bmrManual) return p.bmrManual;
    if (p.bmrFirstAi) return p.bmrFirstAi;
    if (p.weight && p.height && p.age) return Calc.bmr(p.gender, p.weight, p.height, p.age);
    return null;
  }
  function bmrSourceText() {
    var p = getProfile();
    if (!p) return '';
    if (p.bmrAuto) return '周复盘自动更新';
    if (p.bmrManual) return '手动填写';
    if (p.bmrFirstAi) return '首次AI计算';
    if (bmrNow()) return '公式估算';
    return '未设置';
  }
  /* 睡眠提示词首次让AI算出的BMR，只写一次，之后由周复盘接管 */
  function saveBmrFirstAi(val) {
    var v = parseInt(val, 10);
    if (!v || v < 600 || v > 4000) return false;
    var p = getProfile() || {};
    if (p.bmrFirstAi) return false;
    p.bmrFirstAi = v;
    return saveProfile(p);
  }

  /* ---------- 数字周（v1.7：按 startDate 起算，每7天一周期） ---------- */
  function parseKey(key) {
    var parts = String(key).split('-');
    return new Date(+parts[0], +parts[1] - 1, +parts[2]);
  }
  function startKey() {
    var p = getProfile();
    return (p && p.startDate) || null;
  }
  function daysDiff(a, b) {
    return Math.round((parseKey(b) - parseKey(a)) / 86400000);
  }
  /* 已使用天数：首次保存当天算第1天 */
  function daysUsed() {
    var s = startKey();
    if (!s) return 0;
    return daysDiff(s, todayKey()) + 1;
  }
  function weekIndexOf(dateKey) {
    var s = startKey();
    if (!s) return 1;
    return Math.floor(daysDiff(s, dateKey || todayKey()) / 7) + 1;
  }
  function currentWeek() { return weekIndexOf(todayKey()); }
  /* 第 idx 周的第一天日期 */
  function weekStartKey(idx) {
    var s = startKey();
    if (!s) return todayKey();
    var d = parseKey(s);
    d.setDate(d.getDate() + (idx - 1) * 7);
    return todayKey(d);
  }
  function weekDates(idx) {
    var out = [];
    for (var i = 0; i < 7; i++) {
      var d = parseKey(weekStartKey(idx));
      d.setDate(d.getDate() + i);
      out.push(todayKey(d));
    }
    return out;
  }
  /* 周进度：本周第几天、还剩几天满一周 */
  function weekProgress() {
    var w = currentWeek();
    var day = daysDiff(weekStartKey(w), todayKey()) + 1;
    return { week: w, day: Math.min(Math.max(day, 1), 7), daysLeft: Math.max(7 - day, 0), full: daysUsed() >= 7 };
  }
  function getWeekRecords(idx) {
    var all = getRecords();
    return weekDates(idx).map(function (k) { return all[k] ? normalizeRecord(all[k]) : null; });
  }
  /* 满7天自动翻周：把已结束周的所有记录标记归档 */
  function closeWeeks() {
    var p = getProfile();
    if (!p) return 0;
    var closed = p.closedWeeks || 0;
    var shouldClose = currentWeek() - 1;
    if (shouldClose <= closed) return 0;
    var all = getRecords();
    var touched = false;
    for (var w = closed + 1; w <= shouldClose; w++) {
      weekDates(w).forEach(function (k) {
        if (all[k] && !all[k].archived) { all[k].archived = true; touched = true; }
      });
    }
    if (touched) writeJSON(RECORDS_KEY, all);
    p.closedWeeks = shouldClose;
    saveProfile(p);
    return shouldClose - closed;
  }

  /* ---------- 周复盘AI结论（v1.7：存起来给睡眠提示词/导出用，不直接改目标） ---------- */
  function getWeekReview(idx) {
    var p = getProfile();
    if (!p || !p.weekReviews) return null;
    var key = String(idx || currentWeek());
    return p.weekReviews[key] || null;
  }
  /* 严格意义的"上一周"结论（周次小于当前周），没有则返回 null */
  function lastWeekReview() {
    var p = getProfile();
    if (!p || !p.weekReviews) return null;
    var keys = Object.keys(p.weekReviews).sort(function (a, b) { return +a - +b; });
    var prev = keys.filter(function (k) { return +k < currentWeek(); });
    return prev.length ? p.weekReviews[prev[prev.length - 1]] : null;
  }
  /* 最近一次周复盘结论（可能就是本周刚保存的） */
  function recentWeekReview() {
    var p = getProfile();
    if (!p || !p.weekReviews) return null;
    var keys = Object.keys(p.weekReviews).sort(function (a, b) { return +a - +b; });
    return keys.length ? p.weekReviews[keys[keys.length - 1]] : null;
  }
  function saveWeekReview(review) {
    var p = getProfile() || {};
    p.weekReviews = p.weekReviews || {};
    var idx = review.week || currentWeek();
    review.week = idx;
    review.at = new Date().toISOString();
    review.atDay = todayKey();
    p.weekReviews[String(idx)] = review;
    /* BMR 由周复盘解析自动更新（最高优先级） */
    if (review.bmr) p.bmrAuto = review.bmr;
    return saveProfile(p);
  }

  /* ---------- 体重同步（v1.7：日复盘/周复盘/档案三处一致） ---------- */
  function setWeight(kg, dateKey) {
    var v = parseFloat(kg);
    if (!v || v < 20 || v > 400) return false;
    var key = dateKey || todayKey();
    var p = getProfile();
    if (p) {
      p.weight = v;
      var wh = p.weightHistory || [];
      var exist = wh.filter(function (h) { return h.date === key; })[0];
      if (exist) exist.kg = v;
      else wh.push({ date: key, kg: v });
      wh.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      p.weightHistory = wh;
      if (!saveProfile(p)) return false;
    }
    var all = getRecords();
    if (all[key]) { all[key].weight = v; writeJSON(RECORDS_KEY, all); }
    return true;
  }
  /* 起始体重：首次记录，用于减脂预估线 */
  function startWeight() {
    var p = getProfile();
    if (!p) return null;
    var wh = (p.weightHistory || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    if (wh.length) return wh[0].kg;
    return p.weight || null;
  }

  /* 体重双线（v1.7）：预估线=起始体重−累计预估减脂；实际线=手动记录的体重 */
  function weightTrend(dateKeys) {
    var p = getProfile();
    var bmr = bmrNow();
    var base = startWeight();
    var all = getRecords();
    var hist = {};
    ((p && p.weightHistory) || []).forEach(function (h) { hist[h.date] = h.kg; });
    var dayFat = function (k) {
      var r = all[k] ? normalizeRecord(all[k]) : null;
      if (!r || !bmr) return 0;
      return Calc.fatChangeGrams(Calc.todayBurnKcal(bmr, r.move.todayBurn, k), r.eat.total);
    };
    /* 先累计本周之前所有记录的缺口，预估线才能跨周连续 */
    var first = dateKeys[0];
    var cum = 0;
    Object.keys(all).sort().forEach(function (k) {
      if (k < first) cum += dayFat(k);
    });
    var est = [], act = [];
    dateKeys.forEach(function (k) {
      cum += dayFat(k);
      est.push(base == null ? null : Math.round((base - cum / 1000) * 100) / 100);
      var r = all[k] ? normalizeRecord(all[k]) : null;
      var v = hist[k] != null ? hist[k] : (r && r.weight ? r.weight : null);
      act.push(v == null ? null : v);
    });
    return { dates: dateKeys, estimate: est, actual: act, base: base };
  }

  /* ---------- 蔬菜/膳食纤维（v1.8：数值全部来自AI解析，代码不做推荐计算） ---------- */
  function fiberTotal(rec) {
    if (!rec || !rec.eat) return 0;
    return MEALS.reduce(function (s, m) { return s + num(rec.eat[m] && rec.eat[m].fiber); }, 0);
  }
  function saveFiberGoal(v) {
    var g = parseInt(v, 10);
    if (!g || g < 5 || g > 100) return false;
    var p = getProfile() || {};
    p.fiberGoalAi = g;
    return saveProfile(p);
  }
  function fiberGoalNow() {
    var p = getProfile();
    return (p && p.fiberGoalAi) || null;
  }

  /* ---------- 推荐入睡/起床时间（v1.8）
     优先级：AI解析 > 手动微调 > 首次AI估算 > 默认 23:00/07:00 ---------- */
  function recSleepNow() {
    var p = getProfile();
    var r = p && p.recSleep;
    if (r && r.bed && r.wake) return { bed: r.bed, wake: r.wake, src: r.src || 'ai' };
    return { bed: '23:00', wake: '07:00', src: 'default' };
  }
  function recSleepSourceText(src) {
    return ({ ai: 'AI解析更新', manual: '手动微调', first: '首次AI估算', default: '默认作息' })[src] || '默认作息';
  }
  function saveRecSleep(bed, wake, src) {
    if (!/^\d{1,2}:\d{2}$/.test(bed || '') || !/^\d{1,2}:\d{2}$/.test(wake || '')) return false;
    var p = getProfile() || {};
    var cur = p.recSleep;
    if (src === 'first' && cur) return false; // 首次AI估算只写一次，不覆盖已有结论
    p.recSleep = { bed: bed, wake: wake, src: src, at: new Date().toISOString() };
    return saveProfile(p);
  }

  /* ---------- 睡眠记录（v1.5 独立存储：每天一条，覆盖更新） ---------- */
  function getSleepLogs() {
    var logs = readJSON(SLEEP_KEY, []);
    return Array.isArray(logs) ? logs : [];
  }
  function getSleep(dateKey) {
    var key = dateKey || todayKey();
    return getSleepLogs().filter(function (l) { return l.date === key; })[0] || null;
  }
  function saveSleep(entry) {
    var key = entry.date || todayKey();
    var logs = getSleepLogs().filter(function (l) { return l.date !== key; });
    entry.date = key;
    logs.push(entry);
    logs.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    return writeJSON(SLEEP_KEY, logs);
  }
  function deleteSleep(dateKey) {
    var key = dateKey || todayKey();
    return writeJSON(SLEEP_KEY, getSleepLogs().filter(function (l) { return l.date !== key; }));
  }
  /* 昨晚睡眠：优先今天登记的（今早醒），否则昨天登记的 */
  function lastSleep() {
    return getSleep(todayKey()) || getSleep(todayKey(new Date(Date.now() - 86400000)));
  }

  /* ---------- 每日记录 ---------- */
  function getRecords() { return readJSON(RECORDS_KEY, {}); }

  function eatTotal(eat) {
    if (!eat) return 0;
    return MEALS.reduce(function (s, m) { return s + (num(eat[m] && eat[m].kcal) || 0); }, 0);
  }

  function num(v) {
    var n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }

  /* 修复旧Bug：kcal 存成 "720|28|26|52" 整串 → 拆分为四营养素 */
  function fixMeal(meal) {
    var m = meal || {};
    if (typeof m.kcal === 'string' && m.kcal.indexOf('|') >= 0) {
      var parts = m.kcal.split(/[|｜]/);
      m.kcal = num(parts[0]);
      m.carb = num(parts[1]);
      m.protein = num(parts[2]);
      m.fat = num(parts[3]);
    }
    m.kcal = num(m.kcal);
    m.carb = num(m.carb);
    m.protein = num(m.protein);
    m.fat = num(m.fat);
    m.fiber = num(m.fiber);
    m.desc = m.desc || '';
    m.img = m.img || '';
    m.time = m.time || '';
    m.review = m.review || '';
    m.advice = m.advice || '';
    return m;
  }

  function moveBurn(rec) {
    return rec && rec.move ? (rec.move.todayBurn || 0) : 0;
  }

  /* 兼容旧结构：meals(字符串四餐+photo) → eat；exercise → move */
  function normalizeRecord(rec) {
    if (!rec) return rec;

    if (rec.meals && typeof rec.meals.breakfast === 'string') {
      var old = rec.meals;
      rec.eat = emptyEat();
      MEALS.forEach(function (m) { rec.eat[m].desc = old[m] || ''; });
      if (old.photo) rec.eat['午餐'].img = old.photo;
      delete rec.meals;
    }
    if (!rec.eat) rec.eat = emptyEat();
    MEALS.forEach(function (m) {
      rec.eat[m] = fixMeal(rec.eat[m]);
    });
    rec.eat.totals = {
      kcal: 0, carb: 0, protein: 0, fat: 0
    };
    MEALS.forEach(function (m) {
      rec.eat.totals.kcal += rec.eat[m].kcal;
      rec.eat.totals.carb += rec.eat[m].carb;
      rec.eat.totals.protein += rec.eat[m].protein;
      rec.eat.totals.fat += rec.eat[m].fat;
    });
    rec.eat.total = rec.eat.totals.kcal;

    if (rec.exercise && !rec.move) {
      rec.move = emptyMove();
      if (rec.exercise.type) {
        var met = (global.Calc && Calc.MET[rec.exercise.type]) || 5.0;
        var p = getProfile();
        var kcal = p && p.weight ? Calc.moveKcal(p.weight, met, rec.exercise.minutes || 0) : 0;
        rec.move.logs.push({
          type: rec.exercise.type, minutes: rec.exercise.minutes || 0,
          intensity: '中', met: met, kcal: kcal, time: ''
        });
      }
      delete rec.exercise;
    }
    if (!rec.move) rec.move = emptyMove();
    rec.move.todayBurn = rec.move.logs.reduce(function (s, l) { return s + (l.kcal || 0); }, 0);

    var w = rec.water || {};
    w.logs = w.logs || [];
    w.total = w.logs.reduce(function (s, l) { return s + l.ml; }, 0);
    if (w.goal == null) w.goal = waterGoalNow();
    rec.water = w;

    return rec;
  }

  function getRecord(dateKey) {
    var all = getRecords();
    var key = dateKey || todayKey();
    if (!all[key]) {
      all[key] = { date: key, water: emptyWater(), eat: emptyEat(), move: emptyMove(), weight: null, sleep: null };
    }
    return normalizeRecord(all[key]);
  }

  function saveRecord(dateKey, patch) {
    var all = getRecords();
    var key = dateKey || todayKey();
    var rec = all[key] || { date: key };
    Object.keys(patch).forEach(function (k) { rec[k] = patch[k]; });
    rec = normalizeRecord(rec);
    all[key] = rec;
    return writeJSON(RECORDS_KEY, all);
  }

  function waterTotal(rec) {
    if (!rec || !rec.water || !rec.water.logs) return 0;
    return rec.water.logs.reduce(function (s, l) { return s + l.ml; }, 0);
  }

  /* ---------- 旧数据一次性迁移 ---------- */
  function migrate() {
    var all = getRecords();
    var profile = getProfile();
    var changed = false;

    if (profile && profile.waterGoal && !profile.waterGoalManual) {
      profile.waterGoalManual = profile.waterGoal;
      delete profile.waterGoal;
      changed = true;
    }
    // v1.2 的 waterGoalTomorrow/calorieGoalTomorrow → v1.3 的 ai 对象
    if (profile && (profile.waterGoalTomorrow || profile.calorieGoalTomorrow)) {
      profile.ai = Object.assign({}, profile.ai, {
        water: profile.waterGoalTomorrow || null,
        kcal: profile.calorieGoalTomorrow || null
      });
      if (!profile.ai.dietAdvice && profile.aiAdvice) profile.ai.dietAdvice = profile.aiAdvice;
      delete profile.waterGoalTomorrow;
      delete profile.calorieGoalTomorrow;
      changed = true;
    }
    if (profile && !profile.weightHistory) profile.weightHistory = [];
    /* v1.7：老用户补 startDate（取最早记录日，没有就用今天） */
    if (profile && !profile.startDate) {
      var firstKeys = Object.keys(all).sort();
      profile.startDate = firstKeys.length ? firstKeys[0] : todayKey();
      changed = true;
    }

    Object.keys(all).forEach(function (k) {
      var before = JSON.stringify(all[k]);
      var r = normalizeRecord(all[k]);
      // 旧 rec.sleep → 独立 sleepLogs
      if (r.sleep && r.sleep.actualBed && r.sleep.wake && global.Calc) {
        var exists = getSleepLogs().some(function (l) { return l.date === k; });
        if (!exists) {
          var logs = getSleepLogs();
          logs.push({
            date: k,
            bedtime: r.sleep.actualBed,
            waketime: r.sleep.wake,
            duration: Calc.sleepHours(r.sleep.actualBed, r.sleep.wake),
            description: '',
            aiResult: null
          });
          writeJSON(SLEEP_KEY, logs);
        }
        delete r.sleep;
      }
      // 体重历史收归档案
      if (r.weight && profile) {
        var exists = profile.weightHistory.some(function (h) { return h.date === k; });
        if (!exists) {
          profile.weightHistory.push({ date: k, kg: r.weight });
          changed = true;
        }
      }
      if (JSON.stringify(r) !== before) { all[k] = r; changed = true; }
    });

    if (profile) {
      profile.weightHistory.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    }
    if (changed) {
      writeJSON(RECORDS_KEY, all);
      if (profile) writeJSON(PROFILE_KEY, profile);
    }
  }

  /* ---------- 统计 ---------- */
  function getStreak() {
    var goal = waterGoalNow();
    if (!goal) return 0;
    var all = getRecords();
    var streak = 0;
    var d = new Date();
    var todayRec = all[todayKey(d)];
    if (todayRec && waterTotal(todayRec) >= goal) streak = 1;
    for (var i = 1; i < 400; i++) {
      var prev = new Date(d.getTime() - i * 86400000);
      var rec = all[todayKey(prev)];
      if (rec && waterTotal(rec) >= goal) streak++;
      else break;
    }
    return streak;
  }

  function clearAll() {
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(RECORDS_KEY);
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(SLEEP_KEY);
  }

  /* 清空今日的饮水/饮食/运动记录，保留档案、AI目标、睡眠与体重 */
  function clearToday() {
    var rec = getRecord();
    rec.water.logs = [];
    rec.water.total = 0;
    rec.eat = emptyEat();
    rec.move.logs = [];
    rec.move.todayBurn = 0;
    return saveRecord(null, { water: rec.water, eat: rec.eat, move: rec.move });
  }

  /* 自动归档：最后记录日期不是今天 → 标记该日 archived，返回被归档日期 */
  function autoArchive() {
    var all = getRecords();
    var keys = Object.keys(all).sort();
    if (!keys.length) return null;
    var last = keys[keys.length - 1];
    if (last === todayKey()) return null;
    if (all[last] && !all[last].archived) {
      all[last].archived = true;
      writeJSON(RECORDS_KEY, all);
      return last;
    }
    return null;
  }

  function exportAll() {
    return {
      profile: getProfile(),
      settings: getSettings(),
      records: getRecords(),
      exportedAt: new Date().toISOString()
    };
  }

  function importAll(data) {
    if (data.profile) writeJSON(PROFILE_KEY, data.profile);
    if (data.settings) writeJSON(SETTINGS_KEY, data.settings);
    if (data.records) writeJSON(RECORDS_KEY, data.records);
  }

  global.Store = {
    MEALS: MEALS,
    todayKey: todayKey,
    emptyEat: emptyEat,
    emptyMove: emptyMove,
    getProfile: getProfile,
    saveProfile: saveProfile,
    getSettings: getSettings,
    saveSettings: saveSettings,
    waterGoalNow: waterGoalNow,
    calorieGoalNow: calorieGoalNow,
    proteinGoalNow: proteinGoalNow,
    carbGoalNow: carbGoalNow,
    fatGoalNow: fatGoalNow,
    sleepGoalNow: sleepGoalNow,
    burnGoalNow: burnGoalNow,
    getSleepLogs: getSleepLogs,
    getSleep: getSleep,
    saveSleep: saveSleep,
    deleteSleep: deleteSleep,
    lastSleep: lastSleep,
    aiGoals: aiGoals,
    saveAiGoals: saveAiGoals,
    bmrNow: bmrNow,
    bmrSourceText: bmrSourceText,
    saveBmrFirstAi: saveBmrFirstAi,
    startDate: startKey,
    daysUsed: daysUsed,
    weekIndexOf: weekIndexOf,
    currentWeek: currentWeek,
    weekStartKey: weekStartKey,
    weekDates: weekDates,
    weekProgress: weekProgress,
    getWeekRecords: getWeekRecords,
    closeWeeks: closeWeeks,
    getWeekReview: getWeekReview,
    lastWeekReview: lastWeekReview,
    recentWeekReview: recentWeekReview,
    saveWeekReview: saveWeekReview,
    setWeight: setWeight,
    startWeight: startWeight,
    weightTrend: weightTrend,
    fiberTotal: fiberTotal,
    saveFiberGoal: saveFiberGoal,
    fiberGoalNow: fiberGoalNow,
    recSleepNow: recSleepNow,
    recSleepSourceText: recSleepSourceText,
    saveRecSleep: saveRecSleep,
    getRecords: getRecords,
    getRecord: getRecord,
    saveRecord: saveRecord,
    normalizeRecord: normalizeRecord,
    eatTotal: eatTotal,
    moveBurn: moveBurn,
    waterTotal: waterTotal,
    migrate: migrate,
    getStreak: getStreak,
    clearAll: clearAll,
    clearToday: clearToday,
    autoArchive: autoArchive,
    exportAll: exportAll,
    importAll: importAll
  };
})(window);
