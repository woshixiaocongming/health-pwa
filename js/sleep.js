/* 薄肌健康 - 睡眠页逻辑（v1.5：代码只传递与展示，健康判断交给AI） */
(function (global) {
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function currentEntry(useFallback) {
    var bed = document.getElementById('bedtime').value;
    var wake = document.getElementById('waketime').value;
    var desc = document.getElementById('sleepDesc').value.trim();
    var saved = Store.getSleep();
    if (useFallback) {
      if (!bed && saved) bed = saved.bedtime;
      if (!wake && saved) wake = saved.waketime;
      if (!desc && saved) desc = saved.description;
    }
    return {
      date: Store.todayKey(),
      bedtime: bed || '',
      waketime: wake || '',
      duration: (bed && wake) ? Calc.sleepHours(bed, wake) : (saved ? saved.duration : 0),
      description: desc,
      aiResult: saved ? saved.aiResult : null
    };
  }

  function renderOverview() {
    var s = Store.lastSleep();
    var big = document.getElementById('sleepBig');
    var line = document.getElementById('sleepWindowLine');
    var tag = document.getElementById('sleepTag');
    if (!s) {
      big.textContent = '-- h';
      line.textContent = '尚未记录昨晚睡眠';
      tag.style.display = 'none';
      return;
    }
    big.textContent = s.duration + 'h';
    line.textContent = '就寝 ' + s.bedtime + ' → 起床 ' + s.waketime;
    var status = s.aiResult ? (s.aiResult.status || 'AI已评估') : '待AI评估';
    tag.style.display = 'inline-block';
    tag.textContent = status;
  }

  function renderBlocks(s) {
    var box = document.getElementById('aiBlocks');
    var r = s && s.aiResult;
    if (!r) { box.innerHTML = ''; return; }
    var items = [
      ['💧 饮水目标', r.water != null ? r.water + ' ml' : ''],
      ['🔥 摄入热量目标', r.kcal != null ? r.kcal + ' kcal' : ''],
      ['🥩 蛋白目标', r.protein != null ? r.protein + ' g' : ''],
      ['🍚 碳水目标', r.carb != null ? r.carb + ' g' : ''],
      ['🥑 脂肪目标', r.fat != null ? r.fat + ' g' : ''],
      ['⚡ 总消耗目标（含基础代谢）', r.burnGoal != null ? r.burnGoal + ' kcal' : ''],
      ['⚙️ 基础代谢（AI估算）', r.bmr != null ? r.bmr + ' kcal' : ''],
      ['🏃 运动建议', r.moveAdvice],
      ['🍽 饮食建议', r.dietAdvice],
      ['⚠️ 健康提醒', r.healthNote]
    ];
    box.innerHTML = items.filter(function (i) { return i[1]; }).map(function (i) {
      return '<details class="meal-note" open><summary>' + i[0] + '</summary><p class="small">' + esc(i[1]) + '</p></details>';
    }).join('');
  }

  function renderHistory() {
    var logs = Store.getSleepLogs().slice(-7).reverse();
    var ul = document.getElementById('sleepHistory');
    if (!logs.length) {
      ul.innerHTML = '<li class="muted">暂无睡眠记录</li>';
      return;
    }
    ul.innerHTML = logs.map(function (l) {
      var status = (l.aiResult && l.aiResult.status) || '';
      return '<li><span class="sh-date">' + l.date.slice(5) + '</span>' +
        '<span class="sh-dur">' + l.duration + 'h</span>' +
        '<span class="sh-desc">' + esc((l.description || '').slice(0, 20)) + '</span>' +
        (status ? '<span class="sleep-tag" style="margin:0">' + esc(status) + '</span>' : '') +
        '</li>';
    }).join('');
  }

  /* 基础代谢来源展示：周复盘解析 > 手动 > 首次AI > 公式兜底 */
  function renderBmr() {
    var el = document.getElementById('bmrLine');
    if (!el) return;
    var b = Store.bmrNow();
    el.textContent = b
      ? '当前基础代谢 ' + b + ' kcal（来源：' + Store.bmrSourceText() + '）'
      : '尚未设置基础代谢：先保存档案，导入AI建议后自动写入';
  }

  /* 推荐作息：只读展示当前推荐值，可手动微调后保存 */
  function renderRec() {
    var bedEl = document.getElementById('recBed');
    var wakeEl = document.getElementById('recWake');
    if (!bedEl || !wakeEl) return;
    var r = Store.recSleepNow();
    if (document.activeElement !== bedEl) bedEl.value = r.bed;
    if (document.activeElement !== wakeEl) wakeEl.value = r.wake;
    var src = document.getElementById('recSrc');
    if (src) src.textContent = '来源：' + Store.recSleepSourceText(r.src) +
      (r.src === 'default' ? '（导入AI建议后会自动更新）' : '');
  }

  function refresh() {
    renderOverview();
    renderBmr();
    renderRec();
    renderBlocks(Store.getSleep());
    renderHistory();
  }

  function init() {
    var saved = Store.getSleep();
    if (saved) {
      document.getElementById('bedtime').value = saved.bedtime || '';
      document.getElementById('waketime').value = saved.waketime || '';
      document.getElementById('sleepDesc').value = saved.description || '';
    }

    function previewDur() {
      var bed = document.getElementById('bedtime').value;
      var wake = document.getElementById('waketime').value;
      var el = document.getElementById('durPreview');
      el.textContent = (bed && wake) ? '时长 ' + Calc.sleepHours(bed, wake) + ' 小时' : '';
    }
    document.getElementById('bedtime').addEventListener('change', previewDur);
    document.getElementById('waketime').addEventListener('change', previewDur);
    previewDur();

    document.getElementById('sleepSaveBtn').addEventListener('click', function () {
      var e = currentEntry(false);
      // 清空就寝/起床 → 删除当日睡眠记录，概览归零
      if (!e.bedtime && !e.waketime) {
        Store.deleteSleep();
        refresh();
        toast('已清空今日睡眠记录');
        return;
      }
      if (!e.bedtime || !e.waketime) { alert('请填写就寝与起床时间（或两者都留空以清空）'); return; }
      e.aiResult = (Store.getSleep() || {}).aiResult || null;
      Store.saveSleep(e);
      refresh();
      toast('睡眠已保存 ✓');
    });

    document.getElementById('sleepPromptBtn').addEventListener('click', function () {
      var e = currentEntry(true);
      if (!e.bedtime || !e.waketime) { alert('请先填写就寝与起床时间'); return; }
      var text = Share.sleepPrompt(e);
      if (!text) { alert('请先在档案页保存基础信息'); return; }
      Share.copyText(text, function (ok) { toast(ok ? '睡眠提示词已复制 📋' : '复制失败，请手动复制'); });
    });

    document.getElementById('sleepImportBtn').addEventListener('click', function () {
      var parsed = Share.parseSleepAi(document.getElementById('sleepImportBox').value);
      var status = document.getElementById('sleepImportStatus');
      if (!parsed) {
        status.textContent = '未识别到有效内容：请粘贴AI返回的目标行（数字用|或换行分隔）';
        return;
      }
      var e = currentEntry(false);
      if (!e.bedtime || !e.waketime) { alert('请先填写就寝与起床时间并保存'); return; }
      e.aiResult = parsed;
      Store.saveSleep(e);
      // 分发到各页面：饮水/饮食/运动/首页消耗卡
      var goals = {};
      ['water', 'kcal', 'protein', 'carb', 'fat', 'burnGoal'].forEach(function (k) {
        if (parsed[k] != null) goals[k] = parsed[k];
      });
      if (parsed.moveAdvice) goals.moveAdvice = parsed.moveAdvice;
      if (parsed.dietAdvice) goals.dietAdvice = parsed.dietAdvice;
      Store.saveAiGoals(goals);
      // 基础代谢：首次AI估算只写一次，之后由周复盘解析接管
      var bmrSet = parsed.bmr != null && Store.saveBmrFirstAi(parsed.bmr);
      // 推荐作息：已有结论记为AI解析更新，首次记为首次AI估算
      var recSet = false;
      if (parsed.recBed && parsed.recWake) {
        var had = Store.getProfile() && Store.getProfile().recSleep;
        recSet = Store.saveRecSleep(parsed.recBed, parsed.recWake, had ? 'ai' : 'first');
      }
      document.getElementById('sleepImportBox').value = '';
      status.textContent = '已导入并分发：' +
        (parsed.water ? '饮水' + parsed.water + 'ml ' : '') +
        (parsed.kcal ? '热量' + parsed.kcal + 'kcal ' : '') +
        (parsed.burnGoal ? '总消耗' + parsed.burnGoal + 'kcal ' : '') +
        (bmrSet ? '基础代谢' + parsed.bmr + 'kcal ' : '') +
        (recSet ? '推荐作息' + parsed.recBed + '→' + parsed.recWake + ' ' : '') +
        '→ 各页已联动';
      refresh();
      toast('AI目标已导入并分发 ✓');
    });

    document.getElementById('recSaveBtn').addEventListener('click', function () {
      var bed = document.getElementById('recBed').value;
      var wake = document.getElementById('recWake').value;
      if (!bed || !wake) { toast('请填写推荐入睡与起床时间'); return; }
      if (!Store.saveRecSleep(bed, wake, 'manual')) { toast('时间格式不正确'); return; }
      renderRec();
      toast('推荐作息已保存 ✓');
    });

    refresh();
  }

  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 1800);
  }

  global.SleepPage = { init: init };
})(window);
