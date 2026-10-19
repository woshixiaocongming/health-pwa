/* 薄肌健康 - 周复盘 Chart.js 趋势图（v1.7：数字周 + 体重双线） */
(function (global) {
  var charts = {};

  /* 读 CSS 令牌的具体色值（v1.11：浅色背景下图表自动换深色可读版） */
  function cv(name, fb) {
    var v = getComputedStyle(document.body).getPropertyValue(name).trim();
    return v || fb;
  }

  /* 当前数字周（按档案开始日期起算），只取到今天为止的日期 */
  function buildDatasets() {
    var w = Store.currentWeek();
    var today = Store.todayKey();
    var dates = Store.weekDates(w).filter(function (k) { return k <= today; });
    var recs = Store.getWeekRecords(w).slice(0, dates.length);
    var trend = Store.weightTrend(dates);
    return {
      week: w,
      dates: dates,
      labels: dates.map(function (k) { return k.slice(5).replace('-', '/'); }),
      weightEstimate: trend.estimate,
      weightActual: trend.actual,
      water: recs.map(function (r) { return r ? Store.waterTotal(r) : null; }),
      burn: recs.map(function (r) { return r && r.move ? (r.move.todayBurn || 0) : null; }),
      intake: recs.map(function (r) { return r ? r.eat.total : null; }),
      sleep: dates.map(function (k) {
        var s = Store.getSleep(k);
        return s ? s.duration : null;
      }),
      intakeBudget: Store.calorieGoalNow()
    };
  }

  function baseOptions(unit) {
    return {
      responsive: true,
      plugins: { legend: { labels: { color: cv('--text-secondary', '#e0e0e0'), boxWidth: 14 } } },
      scales: {
        x: { ticks: { color: cv('--text-secondary', '#889') }, grid: { color: cv('--tint', 'rgba(255,255,255,0.05)') } },
        y: {
          ticks: { color: cv('--text-secondary', '#889') },
          grid: { color: cv('--track', 'rgba(255,255,255,0.08)') },
          title: { display: !!unit, text: unit || '', color: cv('--text-secondary', '#889') }
        }
      },
      spanGaps: true
    };
  }

  function dataset(spec) {
    return {
      label: spec.label,
      data: spec.data,
      borderColor: spec.color,
      backgroundColor: spec.fill ? spec.color + '33' : 'transparent',
      fill: !!spec.fill,
      tension: 0.3,
      borderDash: spec.dash || [],
      pointRadius: spec.points === false ? 0 : 4,
      pointStyle: 'circle',
      pointBackgroundColor: spec.color,
      spanGaps: true
    };
  }

  /* 多线图：series = [{label,data,color,dash,points,fill}] */
  function multi(canvasId, labels, series, unit) {
    var el = document.getElementById(canvasId);
    if (!el) return;
    if (charts[canvasId]) charts[canvasId].destroy();
    charts[canvasId] = new Chart(el, {
      type: 'line',
      data: { labels: labels, datasets: series.map(dataset) },
      options: baseOptions(unit)
    });
  }

  function line(canvasId, label, labels, data, color, unit) {
    multi(canvasId, labels, [{ label: label, data: data, color: color, fill: true }], unit);
  }

  function renderAll() {
    if (typeof Chart === 'undefined') {
      document.querySelectorAll('.chart-card').forEach(function (c) {
        c.innerHTML = '<p class="muted">图表库加载失败（离线状态），请联网后刷新。</p>';
      });
      return;
    }
    var d = buildDatasets();
    Chart.defaults.color = cv('--text-secondary', '#e0e0e0');

    multi('chartWeight', d.labels, [
      { label: '预估体重（按缺口折算）', data: d.weightEstimate, color: cv('--chart-est', '#8E8E93'), dash: [6, 4], points: false },
      { label: '实际体重（手动记录）', data: d.weightActual, color: cv('--good', '#30D158'), fill: false }
    ], 'kg');

    line('chartWater', '饮水 (ml)', d.labels, d.water, cv('--accent-water', '#30B0C7'), 'ml');
    line('chartExercise', '运动消耗 (kcal)', d.labels, d.burn, cv('--gauge-burn', '#FF6B35'), 'kcal');

    var intakeSeries = [{ label: '摄入 (kcal)', data: d.intake, color: cv('--gauge-intake', '#FFD60A'), fill: true }];
    if (d.intakeBudget) {
      intakeSeries.push({
        label: '热量目标 ' + d.intakeBudget + ' kcal',
        data: d.labels.map(function () { return d.intakeBudget; }),
        color: cv('--danger', '#FF453A'), dash: [6, 4], points: false
      });
    }
    multi('chartIntake', d.labels, intakeSeries, 'kcal');

    line('chartSleep', '睡眠 (小时)', d.labels, d.sleep, cv('--accent-sleep', '#9B72F0'), 'h');
  }

  global.TrendChart = { renderAll: renderAll, buildDatasets: buildDatasets };
})(window);
