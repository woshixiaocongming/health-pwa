/* 薄肌健康 - Markdown 导出（today/all/week/month + 睡眠段落）
   安卓 APK 的 WebView 不处理 Blob 下载（Capacitor 未注册 DownloadListener），
   因此统一改为「复制 MD 文本到剪贴板」，网页版与 App 行为一致。 */
(function (global) {
  var WEEK_CN = ['日', '一', '二', '三', '四', '五', '六'];

  function dayKey(d) { return Store.todayKey(d); }

  function rangeKeys(scope) {
    var now = new Date();
    var keys = [];
    if (scope === 'today') return [dayKey(now)];
    if (scope === 'week') {
      // v1.7：本周 = 按开始日期起算的数字周（只到今天）
      var today = dayKey(now);
      return Store.weekDates(Store.currentWeek()).filter(function (k) { return k <= today; });
    }
    if (scope === 'month') {
      for (var i = 1; i <= now.getDate(); i++) {
        keys.push(dayKey(new Date(now.getFullYear(), now.getMonth(), i)));
      }
      return keys;
    }
    // all
    return Object.keys(Store.getRecords()).sort();
  }

  function cnWeek(dateStr) { return WEEK_CN[new Date(dateStr + 'T00:00:00').getDay()]; }

  function recOf(key) {
    var all = Store.getRecords();
    return all[key] ? Store.normalizeRecord(JSON.parse(JSON.stringify(all[key]))) : null;
  }

  function burnOf(r, key) {
    if (!r) return 0;
    var bmr = Store.bmrNow();
    return bmr ? Calc.todayBurnKcal(bmr, r.move.todayBurn, key) : r.move.todayBurn;
  }

  function sleepOf(key) { return Store.getSleep(key); }

  function aiAdviceOf(key) {
    var s = sleepOf(key);
    if (s && s.aiResult) {
      var parts = [];
      if (s.aiResult.moveAdvice) parts.push('运动：' + s.aiResult.moveAdvice);
      if (s.aiResult.dietAdvice) parts.push('饮食：' + s.aiResult.dietAdvice);
      if (s.aiResult.waterAdvice) parts.push('饮水：' + s.aiResult.waterAdvice);
      if (s.aiResult.healthNote) parts.push('提醒：' + s.aiResult.healthNote);
      if (parts.length) return parts.join('；');
    }
    if (key === Store.todayKey()) {
      var p = Store.getProfile();
      if (p && p.aiAdvice) return p.aiAdvice;
    }
    return '';
  }

  /* ---------- 汇总统计 ---------- */
  function summarize(keys) {
    var water = [], intake = [], burn = [], sleep = [], moveDays = 0;
    keys.forEach(function (k) {
      var r = recOf(k);
      if (r) {
        water.push(Store.waterTotal(r));
        intake.push(r.eat.total);
        burn.push(burnOf(r, k));
        if ((r.move.logs || []).length) moveDays++;
      }
      var s = sleepOf(k);
      if (s) sleep.push(s.duration);
    });
    var avg = function (arr) { return arr.length ? Math.round(arr.reduce(function (a, b) { return a + b; }, 0) / arr.length) : 0; };
    var avg1 = function (arr) { return arr.length ? Math.round(arr.reduce(function (a, b) { return a + b; }, 0) / arr.length * 10) / 10 : 0; };
    return {
      days: keys.length,
      waterAvg: avg(water),
      intakeAvg: avg(intake),
      burnAvg: avg(burn),
      sleepAvg: avg1(sleep),
      moveDays: moveDays
    };
  }

  function summaryLines(sum) {
    var waterGoal = Store.waterGoalNow();
    var calGoal = Store.aiGoals().kcal;
    return [
      '- 日均饮水：' + sum.waterAvg + ' ml（目标 ' + (waterGoal || '未设置') + '）',
      '- 日均摄入：' + sum.intakeAvg + ' kcal（目标 ' + (calGoal || '未设置') + '）',
      '- 日均消耗：' + sum.burnAvg + ' kcal',
      '- 睡眠均值：' + sum.sleepAvg + ' 小时',
      '- 运动天数：' + sum.moveDays + '/' + sum.days + ' 天'
    ];
  }

  /* ---------- 单日完整段落（today/all 用） ---------- */
  function dayFullSections(lines, key) {
    var r = recOf(key);
    var s = sleepOf(key);

    lines.push('#### 饮水记录', '');
    if (r) {
      var w = r.water || {};
      lines.push('- 目标: ' + (w.goal != null ? w.goal + ' ml' : '未设置'));
      lines.push('- 总摄入: ' + Store.waterTotal(r) + ' ml');
      (w.logs || []).forEach(function (l) { lines.push('- ' + l.time + '  +' + l.ml + ' ml'); });
      if (!(w.logs || []).length) lines.push('- （当日无饮水记录）');
    } else lines.push('- （当日无记录）');
    lines.push('');

    lines.push('#### 饮食记录', '');
    if (r) {
      Store.MEALS.forEach(function (m) {
        var meal = r.eat[m] || {};
        lines.push('- ' + m + ': ' + (meal.kcal || 0) + ' kcal ｜ 碳水 ' + (meal.carb || 0) +
          'g 蛋白 ' + (meal.protein || 0) + 'g 脂肪 ' + (meal.fat || 0) + 'g ｜ ' + (meal.desc || '未记录'));
        if (meal.review) lines.push('  - AI评价: ' + meal.review);
        if (meal.advice) lines.push('  - AI建议: ' + meal.advice);
      });
      var t = r.eat.totals || { kcal: 0, carb: 0, protein: 0, fat: 0 };
      lines.push('- 总摄入: ' + r.eat.total + ' kcal（碳水 ' + t.carb + 'g / 蛋白 ' + t.protein + 'g / 脂肪 ' + t.fat + 'g）');
    } else lines.push('- （当日无记录）');
    lines.push('');

    lines.push('#### 运动记录', '');
    if (r && r.move.logs.length) {
      r.move.logs.forEach(function (l) {
        lines.push('- ' + (l.time || '--') + ' ' + l.type + ' ' + l.minutes + '分钟(强度' + l.intensity + ', MET' + l.met + ') → ' + l.kcal + ' kcal');
        if (l.review) lines.push('  - AI评价: ' + l.review);
        if (l.advice) lines.push('  - AI建议: ' + l.advice);
      });
      lines.push('- 运动总消耗: ' + r.move.todayBurn + ' kcal');
    } else lines.push('- （当日无运动）');
    lines.push('');

    lines.push('#### 睡眠记录', '');
    if (s) {
      lines.push('- 就寝 ' + s.bedtime + ' → 起床 ' + s.waketime + '，共 ' + s.duration + ' 小时');
      if (s.description) lines.push('- 描述: ' + s.description);
      if (s.aiResult) {
        if (s.aiResult.status) lines.push('- 状态: ' + s.aiResult.status);
        if (s.aiResult.moveAdvice) lines.push('- AI运动建议: ' + s.aiResult.moveAdvice);
        if (s.aiResult.dietAdvice) lines.push('- AI饮食建议: ' + s.aiResult.dietAdvice);
        if (s.aiResult.waterAdvice) lines.push('- AI饮水建议: ' + s.aiResult.waterAdvice);
        if (s.aiResult.burnGoal) lines.push('- AI消耗目标: ' + s.aiResult.burnGoal + ' kcal');
        if (s.aiResult.healthNote) lines.push('- AI健康提醒: ' + s.aiResult.healthNote);
      }
    } else lines.push('- （当日无睡眠记录）');
    lines.push('');

    if (r) {
      var burn = burnOf(r, key);
      var grams = Calc.fatChangeGrams(burn, r.eat.total);
      lines.push('#### 缺口', '');
      lines.push('- 摄入: ' + r.eat.total + ' kcal');
      lines.push('- 消耗: ' + burn + ' kcal');
      lines.push('- 缺口: ' + (burn - r.eat.total) + ' kcal');
      lines.push('- 减脂预估: ' + (grams >= 0 ? '-' + grams + ' g（减脂）' : '+' + Math.abs(grams) + ' g（增重）'));
      lines.push('');
    }

    var advice = aiAdviceOf(key);
    if (advice) {
      lines.push('#### AI建议', '');
      lines.push('- ' + advice);
      lines.push('');
    }

    if (r) {
      lines.push('<details><summary>原始JSON</summary>', '');
      lines.push('```json');
      var copy = JSON.parse(JSON.stringify(r));
      Store.MEALS.forEach(function (m) { if (copy.eat && copy.eat[m]) copy.eat[m].img = copy.eat[m].img ? '[照片已省略]' : ''; });
      lines.push(JSON.stringify(copy, null, 2));
      lines.push('```', '');
      lines.push('</details>', '');
    }
  }

  /* ---------- 主构建 ---------- */
  function buildMarkdown(scope) {
    var data = Store.exportAll();
    var lines = [];

    if (scope === 'week' || scope === 'month') {
      var keys = rangeKeys(scope);
      var now = new Date();
      if (scope === 'week') {
        lines.push('# 薄肌健康 第' + Store.currentWeek() + '周报告（' + keys[0] + ' ~ ' + keys[keys.length - 1] + '）', '');
      } else {
        lines.push('# 薄肌健康 ' + now.getFullYear() + '年' + (now.getMonth() + 1) + '月报告', '');
      }
      lines.push('## ' + (scope === 'week' ? '周' : '月度') + '汇总', '');
      summaryLines(summarize(keys)).forEach(function (l) { lines.push(l); });
      lines.push('');

      if (scope === 'week') {
        lines.push('## 每日详情', '');
        keys.forEach(function (k) {
          var r = recOf(k);
          var s = sleepOf(k);
          lines.push('### ' + k + ' 周' + cnWeek(k), '');
          lines.push('- 饮水：' + (r ? Store.waterTotal(r) : 0) + ' ml');
          lines.push('- 饮食：' + (r ? Store.MEALS.map(function (m) { return m + (r.eat[m].kcal || 0); }).join(' ') : '无记录'));
          lines.push('- 运动：' + (r ? r.move.todayBurn : 0) + ' kcal');
          lines.push('- 睡眠：' + (s ? s.duration + ' 小时' : '未记录'));
          lines.push('- AI建议：' + (aiAdviceOf(k) || '无'));
          lines.push('');
        });

        var wDates = Store.weekDates(Store.currentWeek()).filter(function (k) { return k <= Store.todayKey(); });
        var trend = Store.weightTrend(wDates);
        var fmtKg = function (arr) {
          return arr.map(function (v) { return v == null ? '无' : v + 'kg'; }).join(' → ');
        };
        lines.push('## 体重趋势', '');
        lines.push('- 日期：' + wDates.map(function (d) { return d.slice(5); }).join(' → '));
        lines.push('- 起始体重：' + (trend.base == null ? '未记录' : trend.base + ' kg'));
        lines.push('- 预估线（按每日消耗−摄入折算）：' + fmtKg(trend.estimate));
        lines.push('- 实际线（手动记录的体重）：' + fmtKg(trend.actual));
        lines.push('');

        var rev = Store.getWeekReview(Store.currentWeek()) || Store.lastWeekReview();
        lines.push('## AI周分析', '');
        if (rev) {
          lines.push('- 所属周次：第' + rev.week + '周（' + (rev.atDay || String(rev.at || '').slice(0, 10)) + ' 导入）');
          lines.push('- 基础代谢调整：' + (rev.bmr ? rev.bmr + ' kcal' : '未给'));
          lines.push('- 饮水目标调整：' + (rev.water ? rev.water + ' ml' : '未给'));
          lines.push('- 热量目标调整：' + (rev.kcal ? rev.kcal + ' kcal' : '未给'));
          if (rev.highlights) lines.push('', '### 本周亮点', '', rev.highlights);
          if (rev.improvements) lines.push('', '### 改进空间', '', rev.improvements);
          if (rev.suggestions) lines.push('', '### 下周建议', '', rev.suggestions);
          if (rev.adjust) lines.push('', '### 数值调整说明', '', rev.adjust);
        } else {
          lines.push('（本周尚未导入AI周复盘：复盘页生成提示词 → 发给AI → 粘贴解析并保存）');
        }
        lines.push('');
      } else {
        lines.push('## 每周详情', '');
        for (var i = 0; i < keys.length; i += 7) {
          var chunk = keys.slice(i, i + 7);
          lines.push('### 第' + (i / 7 + 1) + '周（' + chunk[0] + '~' + chunk[chunk.length - 1] + '）', '');
          var sum = summarize(chunk);
          lines.push('- 周汇总：日均饮水 ' + sum.waterAvg + 'ml ｜ 日均摄入 ' + sum.intakeAvg + 'kcal ｜ 日均消耗 ' +
            sum.burnAvg + 'kcal ｜ 睡眠均值 ' + sum.sleepAvg + 'h ｜ 运动 ' + sum.moveDays + '/' + sum.days + ' 天');
          chunk.forEach(function (k) {
            var r = recOf(k);
            var s = sleepOf(k);
            lines.push('- ' + k + '：饮水 ' + (r ? Store.waterTotal(r) : 0) + 'ml ｜ 摄入 ' + (r ? r.eat.total : 0) +
              'kcal ｜ 运动 ' + (r ? r.move.todayBurn : 0) + 'kcal ｜ 睡眠 ' + (s ? s.duration + 'h' : '--'));
          });
          lines.push('');
        }
      }
      return lines.join('\n');
    }

    /* today / all：保留可导入结构 */
    lines.push('# 薄肌健康 ' + (scope === 'today' ? Store.todayKey() : '数据导出'), '');
    lines.push('导出时间: ' + data.exportedAt, '');
    lines.push('## 档案', '');
    var p = data.profile;
    if (p) {
      lines.push('```json');
      lines.push(JSON.stringify(p, null, 2));
      lines.push('```');
    } else lines.push('（未填写）');
    lines.push('', '## 设置', '', '```json', JSON.stringify(data.settings, null, 2), '```', '');
    lines.push('## 每日记录', '');

    var keys2 = scope === 'today' ? [Store.todayKey()] : Object.keys(data.records).sort();
    keys2.forEach(function (key) {
      var r = recOf(key);
      lines.push('### ' + key + (r && r.archived ? '（已归档）' : ''), '');
      dayFullSections(lines, key);
    });
    if (scope === 'today' && !recOf(keys2[0]) && !sleepOf(keys2[0])) {
      lines.push('（今日暂无记录）', '');
    }
    return lines.join('\n');
  }

  function copyText(text, onDone) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        if (onDone) onDone(true);
      }).catch(function () { fallbackCopy(text, onDone); });
    } else {
      fallbackCopy(text, onDone);
    }
  }

  function fallbackCopy(text, onDone) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    ta.remove();
    if (onDone) onDone(ok);
  }

  function copy(scope, onDone) {
    copyText(buildMarkdown(scope), function (ok) { if (onDone) onDone(ok); });
  }

  global.Exporter = {
    buildMarkdown: buildMarkdown,
    copy: copy
  };
})(window);
