/* 薄肌健康 - 首页表盘仪表盘（v1.3）+ SW注册 + 导航高亮 */
(function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').then(function (reg) {
        function nextWorker() { return reg.waiting || reg.installing || reg.active; }
        function showUpdateBtn() {
          if (document.getElementById('swUpdateBtn')) return;
          var btn = document.createElement('button');
          btn.id = 'swUpdateBtn';
          btn.type = 'button';
          btn.className = 'sw-update-btn';
          btn.textContent = '🆕 发现新版本，点击刷新';
          btn.addEventListener('click', function () {
            var w = nextWorker();
            if (w) w.postMessage({ type: 'TAKE_OVER' });
            setTimeout(function () { location.reload(); }, 300);
          });
          document.body.appendChild(btn);
        }
        reg.addEventListener('updatefound', function () {
          var nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', function () {
            if ((nw.state === 'installed' || nw.state === 'activated') && navigator.serviceWorker.controller) showUpdateBtn();
          });
        });
        if (reg.waiting && navigator.serviceWorker.controller) showUpdateBtn();
      }).catch(function () {});
    });
  }

  /* 凌晨跨天：日期变化时重载页面，今日记录自然重置（目标与档案按key保留） */
  var bootDay = null;

  document.addEventListener('DOMContentLoaded', function () {
    Store.migrate();
    bootDay = Store.todayKey();
    setInterval(function () {
      if (Store.todayKey() !== bootDay) location.reload();
    }, 60 * 1000);
    // 每日自动归档：最后记录日期非今天 → 标记归档（设置页可关）
    if (Store.getSettings().autoArchive !== false) Store.autoArchive();
    // 满7天自动翻周：已结束周的记录整体归档
    Store.closeWeeks();
    var path = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.tabbar a').forEach(function (a) {
      if (a.getAttribute('href') === path) a.classList.add('active');
    });
    if (document.body.dataset.page === 'index') {
      renderDashboard();
      maybeSleepTip();
      maybeMonthTip();
      maybeNightTip();
    }

    /* 档案页返回（含 bfcache 返回）或主题切换时按最新状态重渲染，目标模式实时生效 */
    function refreshIndex() {
      if (document.body.dataset.page === 'index') renderDashboard();
    }
    window.addEventListener('pageshow', refreshIndex);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) refreshIndex();
    });
    window.addEventListener('bm-theme', refreshIndex);
  });

  /* 昨晚睡眠<6h 的紫色UI提示条（唯一代码判断，非健康计算） */
  function maybeSleepTip() {
    var s = Store.lastSleep();
    if (!s || !(s.duration < 6)) return;
    var key = 'bm_sleeptip_' + Store.todayKey();
    if (localStorage.getItem(key)) return;
    var bar = document.createElement('div');
    bar.className = 'sleep-tip';
    bar.innerHTML = '<span>⚠️ 昨晚睡眠不足' + s.duration + 'h，建议降低运动强度</span>' +
      '<button class="tip-close" aria-label="关闭">✕</button>';
    insertTopBar(bar);
    bar.querySelector('.tip-close').addEventListener('click', function () {
      localStorage.setItem(key, '1');
      bar.remove();
    });
  }

  /* 月末最后一天：月度存档提示 */
  function maybeMonthTip() {
    var d = new Date();
    var lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    if (d.getDate() !== lastDay) return;
    var key = 'bm_monthtip_' + Store.todayKey();
    if (localStorage.getItem(key)) return;
    var bar = document.createElement('div');
    bar.className = 'month-tip';
    bar.innerHTML = '<span>本月即将结束，建议导出月度报告存档 📊</span>' +
      '<button class="tip-close" aria-label="关闭">✕</button>';
    insertTopBar(bar);
    bar.querySelector('.tip-close').addEventListener('click', function () {
      localStorage.setItem(key, '1');
      bar.remove();
    });
  }

  function insertTopBar(bar) {
    var container = document.querySelector('.container');
    var h1 = container.querySelector('h1');
    container.insertBefore(bar, h1.nextSibling);
  }

  /* 20:00 后首页橙色提示条，当日关闭后不再显示 */
  function maybeNightTip() {
    if (new Date().getHours() < 20) return;
    var key = 'bm_night_' + Store.todayKey();
    if (localStorage.getItem(key)) return;
    var bar = document.createElement('div');
    bar.className = 'night-tip';
    bar.innerHTML = '<span>今天的数据记得复盘哦，睡前可一键清空 🌙</span>' +
      '<button class="btn btn-sm btn-ghost" id="nightClearBtn" style="flex:0 0 auto">一键清空</button>' +
      '<button class="night-close" aria-label="关闭">✕</button>';
    var container = document.querySelector('.container');
    var h1 = container.querySelector('h1');
    container.insertBefore(bar, h1.nextSibling);
    bar.querySelector('.night-close').addEventListener('click', function () {
      localStorage.setItem(key, '1');
      bar.remove();
    });
    bar.querySelector('#nightClearBtn').addEventListener('click', function () {
      if (!confirm('确定清空今日饮水/饮食/运动记录？不可恢复')) return;
      Store.clearToday();
      localStorage.setItem(key, '1');
      location.reload();
    });
  }

  var ringSeq = 0;

  /* 环形表盘：pct 0~1（可超1，截断显示），centerHtml 圆心内容；v1.5 线宽3px */
  function renderRing(el, pct, centerHtml, color1, color2) {
    if (!el) return;
    var r = 52, sw = 3;
    var c = 2 * Math.PI * r;
    var clamped = Math.max(0, Math.min(1, pct || 0));
    var id = 'ringGrad' + (++ringSeq);
    var grad = color2
      ? '<defs><linearGradient id="' + id + '" x1="0%" y1="0%" x2="100%" y2="100%">' +
        '<stop offset="0%" style="stop-color:' + color1 + '"/><stop offset="100%" style="stop-color:' + color2 + '"/>' +
        '</linearGradient></defs>'
      : '';
    var stroke = color2 ? 'url(#' + id + ')' : color1;
    el.innerHTML =
      '<svg viewBox="0 0 120 120" class="gauge-svg">' + grad +
      '<circle cx="60" cy="60" r="' + r + '" fill="none" style="stroke:var(--track)" stroke-width="' + sw + '"/>' +
      '<circle cx="60" cy="60" r="' + r + '" fill="none" style="stroke:' + stroke + '" stroke-width="' + sw + '" ' +
      'stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c * (1 - clamped)).toFixed(1) + '" ' +
      'transform="rotate(-90 60 60)" class="gauge-arc"/>' +
      '</svg>' +
      '<div class="gauge-center">' + centerHtml + '</div>';
  }

  /* 三大营养素标识色（v1.11：读 CSS 令牌，浅色背景自动换深色可读版） */
  var MACRO_RING = { protein: 'var(--c-protein)', carb: 'var(--c-carb)', fat: 'var(--c-fat)', kcal: 'var(--gauge-intake)' };

  /* 公共多层环组件（v1.8）：外圈=热量进度，内圈=三大营养素占比分段环
     无宏量数据时只渲染轨道圆，不画空环；centerHtml 可选（首页用，饮食页不用） */
  var RingUI = {
    COLORS: MACRO_RING,
    multi: function (o) {
      var r = 52, sw = 3, c = 2 * Math.PI * r;
      var pct = Math.max(0, Math.min(1, o.pct || 0));
      var t = o.totals || { protein: 0, carb: 0, fat: 0 };
      var mk = t.protein * 4, ck = t.carb * 4, fk = t.fat * 9;
      var sum = mk + ck + fk;
      var svg = '<svg viewBox="0 0 120 120" class="ring-svg" aria-hidden="true">' +
        '<circle cx="60" cy="60" r="' + r + '" fill="none" style="stroke:var(--track)" stroke-width="' + sw + '"/>';
      if (pct > 0) {
        svg += '<circle cx="60" cy="60" r="' + r + '" fill="none" style="stroke:' + (o.ringColor || MACRO_RING.kcal) + '" stroke-width="' + sw +
          '" stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c * (1 - pct)).toFixed(1) +
          '" transform="rotate(-90 60 60)"/>';
      }
      if (sum > 0) {
        var ri = 41, ci = 2 * Math.PI * ri, off = 0;
        [['protein', mk], ['carb', ck], ['fat', fk]].forEach(function (pair) {
          var len = ci * (pair[1] / sum);
          if (len > 0.6) {
            svg += '<circle cx="60" cy="60" r="' + ri + '" fill="none" style="stroke:' + MACRO_RING[pair[0]] +
              '" stroke-width="8" stroke-dasharray="' + len.toFixed(1) + ' ' + (ci - len).toFixed(1) +
              '" stroke-dashoffset="' + (-off).toFixed(1) + '" transform="rotate(-90 60 60)"/>';
          }
          off += len;
        });
      }
      svg += '</svg>';
      return svg + (o.centerHtml ? '<div class="gauge-center">' + o.centerHtml + '</div>' : '');
    }
  };
  window.RingUI = RingUI;

  /* 宏量营养素状态：80-100%绿✅ / <80%黄⚠️还差Xg / >100%红🔺已超Xg */
  function macroState(actual, goal, noneText) {
    if (!goal) return { cls: 'st-none', pct: 0, text: noneText || '未设目标' };
    var pct = actual / goal;
    if (pct > 1) return { cls: 'st-over', pct: pct, color: 'var(--danger)', text: '🔺 已超 ' + Math.round(actual - goal) + ' g，注意控制' };
    if (pct >= 0.8) return { cls: 'st-good', pct: pct, color: 'var(--good)', text: '✅ ' + actual + '/' + goal + ' g' };
    return { cls: 'st-low', pct: pct, color: 'var(--warn)', text: '⚠️ 还差 ' + Math.round(goal - actual) + ' g' };
  }

  function renderMacro(elId, statusId, actual, goal, noneText, ringColor) {
    var st = macroState(actual, goal, noneText);
    renderRing(document.getElementById(elId), st.pct,
      '<span class="macro-num">' + actual + '</span><span class="macro-unit">/' + (goal || '--') + 'g</span>',
      ringColor || st.color || 'rgba(255,255,255,0.25)', null);
    var el = document.getElementById(statusId);
    if (el) {
      el.textContent = st.text;
      el.className = 'macro-status small ' + st.cls;
    }
  }

  function renderDashboard() {
    var profile = Store.getProfile();
    var rec = Store.getRecord();
    var intake = rec.eat.total;
    var t = rec.eat.totals;
    /* 基础代谢：周复盘解析 > 手动 > 首次AI > 公式兜底 */
    var bmrVal = Store.bmrNow() || 0;
    var burn = Calc.todayBurnKcal(bmrVal, rec.move.todayBurn);
    var ai = Store.aiGoals();
    var hasAi = !!ai.kcal;
    var noAiText = '请导入AI建议以设置目标';
    var tdee = (profile && bmrVal) ? Calc.tdee(bmrVal, profile.activity) : null;
    var grams = Calc.fatChangeGrams(burn, intake);

    /* 数字周进度：让用户看见"数据飞轮"转到第几周 */
    var prog = Store.weekProgress();
    setText('weekLine', profile
      ? '第' + prog.week + '周 · 本周第' + prog.day + '天 · 已使用' + Store.daysUsed() + '天' +
        (prog.full ? ' · 周复盘已解锁' : ' · 满7天解锁完整周复盘')
      : '先去档案页填写基础信息，开始你的数据飞轮');

    /* ① 摄入环：简洁单圈热量进度 + 中心总热量（颜色读令牌，主题/背景切换即时跟随） */
    renderRing(document.getElementById('gaugeIntake'), hasAi ? intake / ai.kcal : 0,
      '<span class="gauge-num">' + intake + '</span><span class="gauge-unit">kcal</span>',
      'var(--gauge-intake)', null);
    setText('intakeSub', hasAi ? '目标 ' + ai.kcal + ' kcal' : noAiText);
    setText('intakeMacro', '蛋白 ' + t.protein + 'g ｜ 碳水 ' + t.carb + 'g ｜ 脂肪 ' + t.fat + 'g');

    /* ② 消耗环：AI导入总消耗目标优先，无导入回退TDEE默认估算 */
    var burnGoal = Store.burnGoalNow();
    var burnTarget = burnGoal || tdee;
    var bmrPortion = bmrVal ? Math.round(bmrVal * Calc.awakeHours() / 24) : 0;
    renderRing(document.getElementById('gaugeBurn'), burnTarget ? burn / burnTarget : 0,
      '<span class="gauge-num">' + burn + '</span><span class="gauge-unit">kcal</span>',
      'var(--gauge-burn)', null);
    setText('burnSub', burnGoal
      ? '总消耗目标 ' + burnGoal + ' kcal'
      : (tdee ? '总消耗目标 ' + tdee + ' kcal · 默认估算，去睡眠页导入AI建议' : '去睡眠页导入AI建议以设置目标'));
    setText('burnNote', bmrVal
      ? '基础代谢 ' + bmrVal + ' ｜ 已消耗估算 ' + bmrPortion + (rec.move.todayBurn ? '+' + rec.move.todayBurn : '')
      : '运动 ' + rec.move.todayBurn + ' kcal');

    /* ③ 目标方向动态文案：减脂看缺口、增肌看盈余、维持看平衡 */
    var mode = (profile && profile.goalType) || '减脂';
    var fatEl = document.getElementById('fatText');
    var titleEl = document.getElementById('fatTitle');
    var noteEl = document.getElementById('fatNote');
    var nearZero = Math.abs(grams) <= 20;
    var GREEN = 'var(--good)', RED = 'var(--danger)', GRAY = 'var(--chart-est)';
    if (mode === '增肌') {
      var gain = -grams; // 正=盈余（长肉方向）
      if (titleEl) titleEl.textContent = '今日预计增肌 ⚡';
      if (fatEl) {
        fatEl.textContent = (gain > 0 ? '+' : (gain < 0 ? '-' : '')) + Math.abs(gain) + ' g';
        fatEl.style.color = gain > 0 ? GREEN : (gain < 0 ? RED : GRAY);
      }
      if (noteEl) noteEl.textContent = gain < 0 ? '今日缺口，注意加餐'
        : (nearZero ? '今日基本持平，按目标吃够' : '今日盈余达标，继续吃够 💪');
    } else if (mode === '维持') {
      if (titleEl) titleEl.textContent = '今日预计维持 ⚡';
      if (fatEl) {
        fatEl.textContent = (nearZero ? '±0' : '±' + Math.abs(grams)) + ' g';
        fatEl.style.color = GRAY;
      }
      if (noteEl) noteEl.textContent = nearZero ? '今日热量基本持平，保持就好' : '今日略有偏差，属正常波动';
    } else {
      if (titleEl) titleEl.textContent = '今日预计减脂 ⚡';
      if (fatEl) {
        fatEl.textContent = (grams > 0 ? '+' : (grams < 0 ? '-' : '±')) + Math.abs(grams) + ' g';
        fatEl.style.color = grams < 0 ? RED : (grams > 0 ? GREEN : GRAY);
      }
      if (noteEl) noteEl.textContent = grams < 0 ? '今日超标，明天找回来就好'
        : (nearZero ? '今日基本持平' : '今日有缺口，方向对了 💪');
    }

    /* ④ 连胜 */
    setText('streakText', Store.getStreak() + ' 天');

    /* 宏量小环：环色=营养素标识色，状态文字保留语义色；AI导入值优先 */
    renderMacro('gaugeProtein', 'proteinStatus', t.protein,
      ai.protein || (hasAi ? Store.proteinGoalNow() : null), noAiText, MACRO_RING.protein);
    renderMacro('gaugeCarb', 'carbStatus', t.carb,
      ai.carb || (hasAi ? Store.carbGoalNow() : null), noAiText, MACRO_RING.carb);
    renderMacro('gaugeFat', 'fatStatus', t.fat,
      ai.fat || (hasAi ? Store.fatGoalNow() : null), noAiText, MACRO_RING.fat);
  }

  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }
})();
