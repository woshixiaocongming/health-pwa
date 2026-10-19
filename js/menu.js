/* 薄肌健康 - 右上角全局菜单（档案入口 + 导出子菜单 + 主题色/背景 + 使用说明 + 清空今日） */
(function () {
  var GUIDE_HTML =
    '<h2>📖 使用说明</h2>' +

    '<div class="guide-hero">' +
    '<p class="gh-title">🔁 核心逻辑：数据飞轮</p>' +
    '<p class="gh-text">设置初始数据 → AI动态分析给建议 → 每7天（数字周）AI动态更新 → 数据越滚越准，AI越用越懂你。</p>' +
    '</div>' +

    '<div class="guide-sec">' +
    '<h3>🌙 为什么睡眠是第一步</h3>' +
    '<p>睡眠是健康的基石：它同时影响你的代谢水平、运动能力与饮食需求。所以本工具把睡眠页设为唯一的AI目标入口——先记昨晚睡眠，再生成提示词，AI会结合睡眠状况给出当天的饮水、热量、三大营养素、总消耗与运动/饮食建议。</p>' +
    '</div>' +

    '<div class="guide-sec">' +
    '<h3>💡 设计理念</h3>' +
    '<p>让AI帮人健康，人不算公式。工具只负责记录、整理数据与展示，所有健康判断都交给你手机里的AI（元宝／Kimi／智谱／ChatGPT 都可以）。代码不做任何"睡眠×系数=消耗"这类硬编码换算。</p>' +
    '</div>' +

    '<div class="guide-sec">' +
    '<h3>🚀 完整流程</h3>' +
    '<ol class="guide-list">' +
    '<li><b>① 填档案</b>：菜单进「档案」，填体重／身高／年龄／性别／目标／活动水平。首次保存会自动记下开始日期，用于计算数字周（不可手改）。</li>' +
    '<li><b>② 填睡眠</b>：睡眠页记录昨晚就寝与起床时间，越详细的睡眠描述，AI判断越准。</li>' +
    '<li><b>③ 拿AI目标</b>：点「生成AI提示词」→ 发给AI → 回复粘回睡眠页「解析并导入」。饮水／饮食／运动／首页目标自动联动；第一周AI还会顺手估出你的基础代谢。</li>' +
    '<li><b>④ 白天执行</b>：大水页记饮水，饮食页拍照或描述后解析，运动页逐条让AI估算消耗。</li>' +
    '<li><b>⑤ 日复盘</b>：复盘页「日复盘」看当天纯数据，可顺手填今日体重（同步到档案与周趋势）。</li>' +
    '<li><b>⑥ 周复盘</b>：满7天后在「周复盘」生成周分析提示词 → AI回复粘贴解析保存。基础代谢自动更新，饮水与热量结论会带进下周的睡眠提示词。</li>' +
    '<li><b>⑦ 循环</b>：下周AI拿到的是上周真实数据与体重趋势，建议更贴合你——飞轮开始转。</li>' +
    '</ol>' +
    '</div>' +

    '<div class="guide-sec">' +
    '<h3>📄 每周导出MD做什么用</h3>' +
    '<p>菜单 →「导出 ▸ 导出本周」会下载一份本周报告：每日数据、体重双线趋势、AI周分析都在里面。把它发给AI，可以让AI基于完整一周做更细的分析；也可以当作长期健康存档留底。</p>' +
    '</div>' +

    '<div class="guide-sec">' +
    '<h3>⏳ 第一周（不满7天）怎么用</h3>' +
    '<p>前7天数据不满一周，周复盘会显示「第1周进行中（还需X天解锁完整周复盘）」，此时代码走默认估算、AI按截至今天的数据给建议；满7天自动解锁完整周复盘，上一周的记录整体归档。</p>' +
    '</div>' +

    '<p class="muted small" style="margin-top:16px">本工具纯前端，数据只存在本机浏览器；所有数字与AI回复仅为一般性参考，不构成医疗建议。</p>';

  /* 主题色配置（v1.9）：default 保留模块色，其余为全局统一强调色 */
  var THEMES = [
    { id: 'default', name: '默认', color: '#30D158' },
    { id: 'blue', name: '海蓝', color: '#0A84FF' },
    { id: 'green', name: '草绿', color: '#30D158' },
    { id: 'purple', name: '紫罗兰', color: '#BF5AF2' },
    { id: 'pink', name: '樱粉', color: '#FF375F' },
    { id: 'orange', name: '暖橙', color: '#FF9F0A' }
  ];

  /* 背景色方案（v1.11）：3深 + 3暖浅，与主题色独立；chip 用对角双色展示"背景+卡片" */
  var BG_THEMES = [
    { id: 'default', name: '纯黑', bg: '#000000', card: '#2C2C2E' },
    { id: 'blue', name: '暗蓝', bg: '#0A0E1A', card: '#1B2130' },
    { id: 'purple', name: '深紫', bg: '#0F0A14', card: '#241B2E' },
    { id: 'white', name: '纯白', bg: '#FFFFFF', card: '#F2F2F7' },
    { id: 'pink', name: '樱粉', bg: '#FFF0F5', card: '#FFE4E8' },
    { id: 'amber', name: '暖橙', bg: '#FFF8F0', card: '#FFEAD8' }
  ];

  function currentBg() {
    return Store.getSettings().bgTheme || 'default';
  }

  /* 属性挂在 <html>：head 内联脚本可提前注入防闪烁，CSS 令牌覆盖写在 body 级 */
  function applyBg(id) {
    var known = BG_THEMES.some(function (t) { return t.id === id; });
    if (!known) id = 'default';
    if (id === 'default') document.documentElement.removeAttribute('data-bg');
    else document.documentElement.setAttribute('data-bg', id);
    var s = Store.getSettings();
    s.bgTheme = id;
    Store.saveSettings(s);
    syncMetaColor();
    window.dispatchEvent(new Event('bm-bg'));
  }

  /* 状态栏颜色跟随背景方案（PWA 安装后更一体） */
  function syncMetaColor() {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    var id = currentBg();
    var t = BG_THEMES.filter(function (x) { return x.id === id; })[0] || BG_THEMES[0];
    meta.setAttribute('content', t.bg);
  }

  function currentTheme() {
    return Store.getSettings().theme || 'default';
  }

  function applyTheme(id) {
    var known = THEMES.some(function (t) { return t.id === id; });
    if (!known) id = 'default';
    if (id === 'default') document.body.removeAttribute('data-theme');
    else document.body.setAttribute('data-theme', id);
    var s = Store.getSettings();
    s.theme = id;
    Store.saveSettings(s);
    window.dispatchEvent(new Event('bm-theme'));
  }

  function themeHtml() {
    var cur = currentTheme();
    var curBg = currentBg();
    return '<h2>🎨 外观</h2>' +
      '<p class="muted small">主题色与背景色独立搭配，切换后全局同步并自动记忆。</p>' +
      '<p class="theme-sec-title">主题色</p>' +
      '<div class="theme-grid">' +
      THEMES.map(function (t) {
        return '<button type="button" class="theme-swatch' + (t.id === cur ? ' active' : '') + '" data-theme-id="' + t.id + '">' +
          '<i style="background:' + t.color + '"></i><span>' + t.name + '</span></button>';
      }).join('') +
      '</div>' +
      '<p class="theme-sec-title">背景</p>' +
      '<div class="theme-grid">' +
      BG_THEMES.map(function (t) {
        return '<button type="button" class="theme-swatch' + (t.id === curBg ? ' active' : '') + '" data-bg-id="' + t.id + '">' +
          '<i style="background:linear-gradient(135deg,' + t.bg + ' 0 50%,' + t.card + ' 50% 100%);box-shadow:inset 0 0 0 1px rgba(128,128,128,0.45)"></i>' +
          '<span>' + t.name + '</span></button>';
      }).join('') +
      '</div>';
  }

  function inject() {
    if (document.getElementById('bmMenuBtn')) return;

    // 记忆的主题色与背景色在注入时立即生效，避免首屏闪默认色
    var savedTheme = currentTheme();
    if (savedTheme !== 'default') document.body.setAttribute('data-theme', savedTheme);
    var savedBg = currentBg();
    if (savedBg !== 'default') document.documentElement.setAttribute('data-bg', savedBg);
    syncMetaColor();

    var btn = document.createElement('button');
    btn.id = 'bmMenuBtn';
    btn.className = 'menu-btn';
    btn.setAttribute('aria-label', '全局菜单');
    btn.textContent = '≡';
    document.body.appendChild(btn);

    var panel = document.createElement('div');
    panel.id = 'bmMenuPanel';
    panel.className = 'menu-panel';
    panel.innerHTML =
      '<a class="menu-link" href="profile.html">📋 档案</a>' +
      '<button data-act="export-toggle">📋 复制 ▸</button>' +
      '<div class="menu-sub" id="bmExportSub">' +
      '<button data-act="export-today">📋 复制今日</button>' +
      '<button data-act="export-week">📋 复制本周</button>' +
      '<button data-act="export-month">📋 复制本月</button>' +
      '</div>' +
      '<button data-act="theme">🎨 主题色</button>' +
      '<button data-act="guide">📖 使用说明</button>' +
      '<button data-act="clear">🗑️ 清空今日记录</button>' +
      '<div class="menu-foot">💡 建议每月导出一次存档，用于身体健康数据监控</div>';
    document.body.appendChild(panel);

    var modal = document.createElement('div');
    modal.id = 'bmModal';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.innerHTML = '<div class="card modal-card"><button class="modal-close" aria-label="关闭">✕</button><div class="modal-body"></div></div>';
    document.body.appendChild(modal);

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      panel.classList.toggle('open');
    });

    document.addEventListener('click', function (e) {
      if (!panel.contains(e.target) && e.target !== btn) panel.classList.remove('open');
    });

    panel.addEventListener('click', function (e) {
      var act = e.target.getAttribute && e.target.getAttribute('data-act');
      if (!act) return;
      if (act === 'export-toggle') {
        document.getElementById('bmExportSub').classList.toggle('open');
        return;
      }
      panel.classList.remove('open');
      if (act === 'export-today' || act === 'export-week' || act === 'export-month') {
        var scope = act.slice('export-'.length);
        Exporter.copy(scope, function (ok) {
          if (ok) toast('已复制 📋（可粘贴保存）', 4000);
          else toast('复制失败，请手动复制');
        });
      } else if (act === 'guide') {
        openModal(GUIDE_HTML);
      } else if (act === 'theme') {
        openModal(themeHtml());
      } else if (act === 'clear') {
        if (!confirm('确定清空今日饮水/饮食/运动记录？不可恢复')) return;
        Store.clearToday();
        toast('今日记录已清空');
        setTimeout(function () { location.reload(); }, 600);
      }
    });

    modal.querySelector('.modal-close').addEventListener('click', function () {
      modal.style.display = 'none';
    });
    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.style.display = 'none';
      var closest = e.target.closest ? e.target.closest.bind(e.target) : function () { return null; };
      var sw = closest('[data-theme-id]');
      var bgSw = closest('[data-bg-id]');
      if (sw || bgSw) {
        if (sw) applyTheme(sw.getAttribute('data-theme-id'));
        if (bgSw) applyBg(bgSw.getAttribute('data-bg-id'));
        modal.querySelector('.modal-body').innerHTML = themeHtml();
      }
    });
  }

  function openModal(html) {
    var modal = document.getElementById('bmModal');
    modal.querySelector('.modal-body').innerHTML = html;
    modal.style.display = 'flex';
  }

  function toast(msg, duration) {
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, duration || 2000);
  }

  document.addEventListener('DOMContentLoaded', inject);
})();
