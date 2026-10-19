/* 薄肌健康 - 大水：侧面人影喝水动画 + Web Audio咕噜音 + 提醒兜底（v1.4） */
(function (global) {

  /* 侧面人影SVG：男=短发方块头 / 女=长发圆头 / 默认中性圆头 */
  function personSvg(gender) {
    var head;
    if (gender === 'male') {
      head = '<rect x="88" y="34" width="40" height="40" rx="10" fill="#f6cfa4"/>' +
        '<rect x="86" y="28" width="44" height="14" rx="7" fill="#3a2b20"/>';
    } else if (gender === 'female') {
      head = '<circle cx="108" cy="54" r="22" fill="#f6cfa4"/>' +
        '<path d="M86 54 a22 22 0 0 1 44 0 v34 q0 8 -8 8 h-4 q6 -20 4 -34 z" fill="#4a3222"/>' +
        '<path d="M86 54 a22 22 0 0 1 22 -22 q-16 4 -18 22 v30 q0 8 -4 8 z" fill="#4a3222"/>';
    } else {
      head = '<circle cx="108" cy="54" r="21" fill="#f6cfa4"/>';
    }
    return '<svg viewBox="0 0 200 260" class="person-svg" aria-label="点击人影喝水">' +
      '<g class="person-body">' +
      '<rect x="86" y="168" width="16" height="72" rx="7" fill="#22304f"/>' +
      '<rect x="110" y="168" width="16" height="72" rx="7" fill="#22304f"/>' +
      '<rect x="82" y="90" width="48" height="86" rx="18" fill="#2f6fed"/>' +
      '<path d="M122 102 Q 142 96 150 78" stroke="#2f6fed" stroke-width="11" fill="none" stroke-linecap="round"/>' +
      head +
      '</g>' +
      '<g id="cupG">' +
      '<path d="M144 50 h24 l-4 26 h-16 z" fill="#e8f7ff" stroke="#9fd8ef" stroke-width="2"/>' +
      '<path d="M147 60 h18 l-2 14 h-14 z" fill="#00E5FF" opacity="0.85"/>' +
      '</g>' +
      '</svg>';
  }

  function mount(container, gender) {
    container.innerHTML = personSvg(gender);
    return container;
  }

  /* 喝水动画：幅度随水量增大 */
  function drink(container, ml) {
    var svg = container.querySelector('.person-svg');
    var cup = container.querySelector('#cupG');
    if (!svg || !cup) return;
    var angle = 15 + Math.min(30, (ml || 10) / 40);
    var ms = 300 + Math.min(600, (ml || 10) / 2);
    cup.style.transform = 'rotate(-' + angle.toFixed(0) + 'deg)';
    svg.classList.add('drinking');
    setTimeout(function () {
      cup.style.transform = '';
      svg.classList.remove('drinking');
    }, ms);
  }

  /* Web Audio 合成"咕噜"：两段短促下滑音 */
  var actx = null;
  function glug() {
    try {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return;
      actx = actx || new AC();
      if (actx.state === 'suspended') actx.resume();
      var t0 = actx.currentTime;
      [0, 0.12].forEach(function (offset, i) {
        var o = actx.createOscillator();
        var g = actx.createGain();
        var t = t0 + offset;
        o.type = 'sine';
        o.frequency.setValueAtTime(i ? 320 : 420, t);
        o.frequency.exponentialRampToValueAtTime(i ? 90 : 130, t + 0.1);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
        o.connect(g); g.connect(actx.destination);
        o.start(t); o.stop(t + 0.13);
      });
    } catch (e) {}
  }

  function addWater(ml, customTime) {
    ml = parseInt(ml, 10);
    if (!ml || ml <= 0) return null;
    var rec = Store.getRecord();
    var logs = (rec.water && rec.water.logs) || [];
    var now = customTime || new Date();
    logs.push({
      ml: ml,
      time: String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')
    });
    Store.saveRecord(null, { water: { logs: logs, goal: rec.water && rec.water.goal } });
    return logs;
  }

  function todayTotal() {
    return Store.waterTotal(Store.getRecord());
  }

  /* 目标统一读档案：AI导入 > 手动 > 体重×35ml；无档案返回 null */
  function goal() {
    return Store.waterGoalNow();
  }

  /* 满桶特效：简单的彩带动画 */
  function celebrate() {
    if (document.querySelector('.confetti-box')) return;
    var box = document.createElement('div');
    box.className = 'confetti-box';
    var colors = ['#00E5FF', '#007BFF', '#7bdff2', '#F5C542', '#e0e0e0'];
    for (var i = 0; i < 40; i++) {
      var c = document.createElement('i');
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = colors[i % colors.length];
      c.style.animationDelay = (Math.random() * 0.8) + 's';
      c.style.animationDuration = (1.6 + Math.random() * 1.4) + 's';
      box.appendChild(c);
    }
    document.body.appendChild(box);
    setTimeout(function () { box.remove(); }, 3500);
  }

  function foregroundToast(msg) {
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 4500);
  }

  var reminderTimer = null;

  function tick() {
    var g = goal();
    if (!g) return;
    var total = todayTotal();
    if (total >= g) return; // 达标就不烦人
    var msg = '已喝 ' + total + 'ml / 目标 ' + g + 'ml，来一杯吧 💧';
    // HTTPS + 已授权：系统通知
    if (window.isSecureContext && ('Notification' in window) && Notification.permission === 'granted') {
      try { new Notification('薄肌健康 · 大水时间', { body: msg }); } catch (e) {}
    }
    // 前台兜底：页面开着就一定提醒
    foregroundToast(msg);
  }

  function startLoop() {
    if (reminderTimer) clearInterval(reminderTimer);
    reminderTimer = setInterval(tick, 60 * 60 * 1000);
  }

  /* 提醒入口：
     - HTTP 环境：Notification 不可用 → 仅前台提醒，并如实告知
     - HTTPS PWA：申请系统通知权限，同时保留前台提醒 */
  function enableHourlyReminder(onStatus) {
    if (!window.isSecureContext) {
      startLoop();
      if (onStatus) onStatus('当前为 HTTP 环境：系统通知不可用，已开启"仅前台提醒"（页面打开时每小时弹提示）。部署到 HTTPS 后可升级为系统通知。');
      return;
    }
    if (!('Notification' in window)) {
      startLoop();
      if (onStatus) onStatus('此浏览器不支持系统通知，已开启仅前台提醒');
      return;
    }
    if (Notification.permission === 'granted') {
      startLoop();
      if (onStatus) onStatus('已开启：每小时系统通知 + 前台提醒');
      return;
    }
    Notification.requestPermission().then(function (perm) {
      startLoop();
      if (onStatus) {
        onStatus(perm === 'granted'
          ? '已开启：每小时系统通知 + 前台提醒'
          : '未授权系统通知，已开启仅前台提醒（页面打开时每小时弹提示）');
      }
    });
  }

  function reminderEnvText() {
    if (!window.isSecureContext) return '当前 HTTP 环境：仅前台提醒可用';
    if (!('Notification' in window)) return '此浏览器不支持系统通知：仅前台提醒可用';
    if (Notification.permission === 'granted') return '系统通知已授权';
    return 'HTTPS 环境：可申请系统通知权限';
  }

  global.Water = {
    mount: mount,
    drink: drink,
    glug: glug,
    addWater: addWater,
    todayTotal: todayTotal,
    goal: goal,
    celebrate: celebrate,
    enableHourlyReminder: enableHourlyReminder,
    reminderEnvText: reminderEnvText,
    foregroundToast: foregroundToast
  };
})(window);
