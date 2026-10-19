/* 薄肌健康 - 剪贴板 + AI提示词拼装 + AI结果解析（v1.7：睡眠9段含基础代谢 / 周复盘可解析） */
(function (global) {
  function copyText(text, onDone) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        if (onDone) onDone(true);
      }).catch(function () { fallback(text, onDone); });
    } else {
      fallback(text, onDone);
    }
  }

  function fallback(text, onDone) {
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

  function genderText(p) { return p.gender === 'male' ? '男' : '女'; }

  /* 昨晚睡眠上下文（代码只拼字符串，不做任何健康判断） */
  function sleepCtx(withDesc) {
    var s = Store.lastSleep();
    if (!s) return '';
    var desc = withDesc && s.description ? '，' + String(s.description).slice(0, 20) : '';
    return '（上下文：昨晚睡眠' + s.duration + '小时' + desc + '）';
  }

  function profileBlock() {
    var p = Store.getProfile();
    if (!p) return '（尚未填写档案，请先在"档案"页提交）';
    var bmr = Store.bmrNow();
    return '【薄肌健康档案】体重' + p.weight + 'kg，身高' + p.height + 'cm，年龄' + p.age +
      '，性别' + genderText(p) + '，目标' + (p.goalType || '减脂') + '，活动水平' + p.activity +
      '。基础代谢约' + (bmr || '未知') + 'kcal（来源：' + Store.bmrSourceText() + '）' +
      '。已使用' + Store.daysUsed() + '天，当前第' + Store.currentWeek() + '周。';
  }

  /* 每餐评估+推荐吃法提示词（v1.8：加蔬菜/纤维提取） */
  function mealPrompt(mealName, desc) {
    var p = Store.getProfile();
    if (!p) return null;
    var t = Store.getRecord().eat.totals;
    var drinkNote = mealName === '饮料' ? '注意区分含糖/无糖，含糖饮料碳水含量通常20-50g/杯。' : '';
    return '请估算这份餐（见图片/描述：' + (desc || '见图片') + '）。我' + p.weight + 'kg，目标' + (p.goalType || '减脂') +
      '，今日已摄入蛋白' + t.protein + 'g/碳水' + t.carb + 'g/脂肪' + t.fat + 'g，目标蛋白' + Store.proteinGoalNow() +
      'g/碳水' + Store.carbGoalNow() + 'g/脂肪' + Store.fatGoalNow() +
      'g。' + drinkNote + '请：1.估算这份餐的热量(kcal)、碳水(g)、蛋白(g)、脂肪(g)；2.如有蔬菜请单独提取膳食纤维克数；' +
      '3.判断我今日三大营养素目前是否达标/超标；4.结合我的目标，建议我接下来还该怎么吃、吃多少（具体食物+克数），并给出我每日建议膳食纤维克数。' +
      '返回格式：热量|碳水|蛋白|脂肪|评价|建议|本餐纤维g|建议每日纤维g（前4与后2为数字，中间2为短句，用|分隔；没有蔬菜纤维填0）' +
      sleepCtx(false);
  }

  /* 解析餐AI返回："720|28|26|52|蛋白达标碳水不足|晚餐增加糙米100g|8|30"
     纤维兼容带标签写法（纤维8g / 建议纤维30g） */
  function parseMealAi(text) {
    if (!text) return null;
    var raw = String(text).trim();
    var parts = raw.split(/[|｜]/);
    if (parts.length < 1) return null;
    var kcal = parseInt(parts[0], 10);
    if (isNaN(kcal)) return null;
    var n = function (i) { var v = parseInt(parts[i], 10); return isNaN(v) ? 0 : v; };
    function numSeg(seg) {
      var m = /(-?\d+(?:\.\d+)?)/.exec(seg);
      return (m && /^[\s\d\.g克纤维膳食]*$/i.test(seg.replace(m[0], ''))) ? Math.round(parseFloat(m[1])) : null;
    }
    var tail = parts.slice(6);
    var nums = [];
    var adviceParts = [parts[5] || ''];
    tail.forEach(function (seg) {
      var v = numSeg(seg);
      if (v !== null) nums.push(v);
      else adviceParts.push(seg);
    });
    var out = {
      kcal: kcal,
      carb: n(1),
      protein: n(2),
      fat: n(3),
      review: (parts[4] || '').trim(),
      advice: adviceParts.join('|').trim(),
      fiber: nums.length >= 1 ? nums[0] : null,
      fiberGoal: nums.length >= 2 ? nums[1] : null
    };
    if (out.fiber === null) {
      var fm = /纤维[^\d\-]{0,8}(\d+(?:\.\d+)?)\s*(?:g|克)?/i.exec(raw);
      if (fm) out.fiber = Math.round(parseFloat(fm[1]));
    }
    if (out.fiberGoal === null) {
      var gm = /(?:建议|每日|每天)[^\d\-]{0,10}纤维[^\d\-]{0,8}(\d+(?:\.\d+)?)\s*(?:g|克)?/i.exec(raw);
      if (gm) out.fiberGoal = Math.round(parseFloat(gm[1]));
    }
    if (out.fiberGoal !== null && (out.fiberGoal < 5 || out.fiberGoal > 100)) out.fiberGoal = null;
    if (out.fiber !== null && (out.fiber < 0 || out.fiber > 200)) out.fiber = null;
    return out;
  }

  /* 运动估算提示词 */
  function movePrompt() {
    var p = Store.getProfile();
    var rec = Store.getRecord();
    var logs = rec.move.logs;
    if (!p || !logs.length) return null;
    var desc = logs.map(function (l) { return l.type + l.minutes + '分钟'; }).join('、');
    var intensity = logs[logs.length - 1].intensity || '中';
    return '我' + p.weight + 'kg，' + p.height + 'cm，' + p.age + '岁，' + genderText(p) +
      '，今日运动：' + desc + '，强度' + intensity +
      '。请按MET公式估算消耗热量，返回：消耗kcal|建议时长|备注' + sleepCtx(true);
  }

  /* 单条运动AI提示词（v1.4） */
  function moveLogPrompt(type, minutes, intensity) {
    var p = Store.getProfile();
    if (!p) return null;
    return '我' + p.weight + 'kg，刚做了' + type + minutes + '分钟，强度' + intensity +
      '。请估算消耗热量(kcal)，并评价这个运动安排是否合理。返回：消耗kcal|评价|建议（用|分隔）' + sleepCtx(true);
  }

  /* 解析单条运动AI返回："280|安排合理|注意补水" */
  function parseMoveAi(text) {
    if (!text) return null;
    var parts = String(text).trim().split(/[|｜]/);
    var kcal = parseInt(parts[0], 10);
    if (isNaN(kcal)) return null;
    return {
      kcal: kcal,
      review: (parts[1] || '').trim(),
      advice: parts.slice(2).join('|').trim()
    };
  }

  /* 饮水AI提示词（v1.5） */
  function waterPrompt() {
    var p = Store.getProfile();
    if (!p) return null;
    var rec = Store.getRecord();
    return '我' + p.weight + 'kg，目标' + (p.goalType || '减脂') + '，今日已饮水' + Store.waterTotal(rec) +
      'ml，目标' + (Store.waterGoalNow() || '未设置') + 'ml。请给出今日饮水安排（次数/每次量/时段）。返回：饮水ml|建议' +
      '（上下文：昨晚睡眠' + ((Store.lastSleep() || {}).duration || '--') + '小时，睡眠不足时注意少量多次补水）';
  }

  /* 睡眠AI提示词（v1.7：唯一AI入口，9段返回，自动带上周复盘结论） */
  function sleepPrompt(entry) {
    var p = Store.getProfile();
    var s = entry || Store.lastSleep() || Store.getSleep();
    if (!p || !s) return null;
    var last = Store.recentWeekReview();
    var bmr = Store.bmrNow();
    var recT = Store.recSleepNow();
    var lines = [];
    lines.push('我' + p.weight + 'kg，身高' + p.height + 'cm，年龄' + p.age + '，性别' + genderText(p) +
      '，目标' + (p.goalType || '减脂') + '，活动水平' + p.activity + '。');
    if (last) {
      lines.push('根据第' + last.week + '周复盘数据：基础代谢约' + (last.bmr || bmr || '未知') +
        'kcal，饮水' + (last.water || '未给') + 'ml，热量' + (last.kcal || '未给') + 'kcal，建议调整：' +
        (last.suggestions || last.improvements || '无') + '。请在此基础上结合昨晚睡眠微调，不要推翻周复盘结论。');
    } else {
      lines.push('我还没做过完整周复盘（今天是使用第' + Store.daysUsed() + '天）。请先根据我的体重、身高、年龄、性别与睡眠状况，估算我的基础代谢(kcal)' +
        (bmr ? '，目前系统内估算约' + bmr + 'kcal，可作参考' : '') + '。');
    }
    lines.push('目前系统推荐入睡' + recT.bed + '、起床' + recT.wake + '（来源：' + Store.recSleepSourceText(recT.src) +
      '），请结合我的作息习惯与睡眠描述判断是否需要调整，并给出新的推荐时间。');
    lines.push('昨晚就寝' + s.bedtime + '，起床' + s.waketime + '，睡眠' + s.duration + '小时。');
    lines.push('睡眠描述：' + (s.description || '无') + '。');
    lines.push('请综合我的睡眠状况与档案，给出明日目标：');
    lines.push('1.饮水目标(ml) 2.摄入热量目标(kcal) 3.蛋白目标(g) 4.碳水目标(g) 5.脂肪目标(g)');
    lines.push('6.总消耗目标(kcal)：必须包含基础代谢+日常活动+运动的总和，不能只给额外运动消耗。');
    lines.push('7.运动建议（强度/类型/时长，睡眠不足时请降低强度或建议休息） 8.饮食建议');
    lines.push('9.基础代谢(kcal)：你对我基础代谢的最新估算值 10.推荐入睡时间(HH:MM) 11.推荐起床时间(HH:MM)');
    lines.push('返回格式：饮水|热量|蛋白|碳水|脂肪|总消耗|运动建议|饮食建议|基础代谢|推荐入睡|推荐起床（前6与第9为数字，中间2为文字，最后2为HH:MM，用|分隔）');
    return lines.join('\n') + sleepCtx(false);
  }

  /* 容错解析睡眠AI返回（v1.7：不写死格式）
     策略：按 换行/|/； 切段 → 剥离序号与标签 → 区分"数字+可选单位"段与文字段
     数字段：单位ml→饮水；标签含基础代谢→BMR；其余按出现顺序填入 [饮水,热量,蛋白,碳水,脂肪,总消耗,基础代谢]
     文字段：按关键词(运动/饮食)归类，无关键词按顺序兜底，剩余归入健康提醒 */
  function parseSleepAi(text) {
    if (!text) return null;
    var parts = String(text).replace(/\r/g, '').split(/[\n|｜;；]+/);
    var nums = [];
    var texts = [];
    parts.forEach(function (raw) {
      var p = raw.trim();
      if (!p) return;
      p = p.replace(/^[①-⑧一二三四五六七八0-9]{1,2}(?=[\.、\)\s：:])[\.、\)\s：:]*/, '');
      // 整段 = 可选中文标签 + 数字 + 可选单位 → 数字段；否则文字段
      var m = /^([^0-9\-]{0,10}?)[::\s]*(-?\d+(?:\.\d+)?)\s*(ml|毫升|kcal|千卡|大卡|卡|g|克|kg|小时|h)?\s*$/i.exec(p);
      if (m) {
        nums.push({ v: parseFloat(m[2]), unit: (m[3] || '').toLowerCase(), label: m[1] || '' });
        return;
      }
      texts.push(p);
    });
    if (!nums.length) return null;

    var out = { water: null, kcal: null, protein: null, carb: null, fat: null, burnGoal: null, bmr: null };
    function slotFor(n) {
      var l = n.label;
      if (n.unit === 'ml' || n.unit === '毫升' || /饮水|喝水/.test(l)) return 'water';
      if (/bmr|基础代谢/i.test(l)) return 'bmr';
      if (/总消耗|消耗/.test(l)) return 'burnGoal';
      if (/蛋白/.test(l)) return 'protein';
      if (/碳水/.test(l)) return 'carb';
      if (/脂肪/.test(l)) return 'fat';
      if (/热量|摄入/.test(l)) return 'kcal';
      return null;
    }
    var slots = ['water', 'kcal', 'protein', 'carb', 'fat', 'burnGoal', 'bmr'];
    var si = 0;
    nums.forEach(function (n) {
      var s = slotFor(n);
      if (s && out[s] === null) { out[s] = n.v; return; }
      while (si < slots.length && out[slots[si]] !== null) si++;
      if (si < slots.length) { out[slots[si]] = n.v; si++; }
    });

    var moveKw = /运动|走|跑|力量|练|休息|散步|瑜伽|游泳|骑行|拉伸/;
    var dietKw = /饮食|吃|餐|油|糖|补|蔬|果|清淡/;
    var move = null, diet = null, notes = [];
    texts.forEach(function (t) {
      if (!move && moveKw.test(t)) { move = t; return; }
      if (!diet && dietKw.test(t)) { diet = t; return; }
      notes.push(t);
    });
    if (!move && notes.length) move = notes.shift();
    if (!diet && notes.length) diet = notes.shift();

    out.moveAdvice = move || '';
    out.dietAdvice = diet || '';
    out.healthNote = notes.join('；');
    if (out.bmr !== null && (out.bmr < 600 || out.bmr > 4000)) out.bmr = null;

    /* 推荐入睡/起床：优先带标签，其次纯 HH:MM 段（按出现顺序） */
    var rawText = String(text);
    var bm = /入睡[^\d]{0,6}(\d{1,2}:\d{2})/.exec(rawText);
    var wm = /起床[^\d]{0,6}(\d{1,2}:\d{2})/.exec(rawText);
    out.recBed = bm ? bm[1] : null;
    out.recWake = wm ? wm[1] : null;
    if (!out.recBed || !out.recWake) {
      var pure = String(text).replace(/\r/g, '').split(/[\n|｜;；]+/)
        .map(function (x) { return x.trim(); })
        .filter(function (x) { return /^\d{1,2}:\d{2}$/.test(x); });
      if (!out.recBed && pure[0]) out.recBed = pure[0];
      if (!out.recWake && pure[1]) out.recWake = pure[1];
    }
    return out;
  }

  /* 体重趋势文本：预估线（起始体重−累计预估减脂）与实际线（手动记录） */
  function weightTrendLines(dates) {
    var t = Store.weightTrend(dates);
    var fmt = function (arr) {
      return arr.map(function (v) { return v == null ? '无' : v + 'kg'; }).join(' → ');
    };
    return [
      '日期：' + dates.map(function (d) { return d.slice(5).replace('-', '/'); }).join(' → '),
      '预估线（按每日消耗−摄入折算）：' + fmt(t.estimate),
      '实际线（我手动记录的体重）：' + fmt(t.actual)
    ];
  }

  /* 周分析提示词（v1.7：整周数据 + 体重双线 + 上周结论，请AI判断是否调整BMR/饮水/热量） */
  function weeklyPrompt() {
    var w = Store.currentWeek();
    var today = Store.todayKey();
    var weekDates = Store.weekDates(w);
    var dates = weekDates.filter(function (k) { return k <= today; });
    var recs = Store.getWeekRecords(w).slice(0, dates.length);
    var last = Store.lastWeekReview();
    var lines = [profileBlock(), '',
      '【第' + w + '周记录】' + weekDates[0] + ' ~ ' + weekDates[6] + '（本周已过' + dates.length + '天，以下为实际记录）'];

    recs.forEach(function (r, i) {
      var s = Store.getSleep(dates[i]);
      if (!r) { lines.push(dates[i] + '：无记录'); return; }
      lines.push(dates[i] + '：摄入' + r.eat.total + 'kcal（蛋白' + r.eat.totals.protein + 'g／碳水' +
        r.eat.totals.carb + 'g／脂肪' + r.eat.totals.fat + 'g），运动消耗' + r.move.todayBurn +
        'kcal，饮水' + Store.waterTotal(r) + 'ml' +
        (s ? '，睡眠' + s.duration + 'h' : '') +
        (r.weight ? '，体重' + r.weight + 'kg' : ''));
    });

    lines.push('', '【体重趋势】');
    lines = lines.concat(weightTrendLines(dates));

    if (last) {
      lines.push('', '【上周复盘结论】第' + last.week + '周：基础代谢' + (last.bmr || '未给') +
        'kcal，饮水' + (last.water || '未给') + 'ml，热量' + (last.kcal || '未给') + 'kcal。' +
        (last.suggestions ? '建议：' + last.suggestions.replace(/\n/g, '；') : ''));
    }

    lines.push('', '请做一份第' + w + '周的复盘分析：',
      '1) 本周亮点：做得好、值得保持的地方（引用具体数据）',
      '2) 改进空间：最大的1个问题及其影响',
      '3) 下周建议：3条可执行的具体建议（食物/运动/作息各至少覆盖一类）',
      '4) 数值调整：对照本周实际数据与体重趋势，判断我的基础代谢、每日饮水目标、每日摄入热量是否需要调整，并给出新数值；如无需调整请重复当前值',
      '最后一行只输出三个数字：基础代谢|饮水|热量（单位 kcal|ml|kcal，用|分隔）',
      '不要医疗诊断，不承诺效果。');
    return lines.join('\n');
  }

  /* 容错解析周复盘AI返回（v1.7）
     文字按小标题归入 亮点/改进/建议；数字优先带标签（基础代谢/BMR、饮水、热量），
     否则取"只有数字与分隔符"的行，按 基础代谢|饮水|热量 顺序填 */
  function parseWeeklyAi(text) {
    if (!text || !String(text).trim()) return null;
    var raw = String(text).replace(/\r/g, '').trim();
    var lines = raw.split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean);
    var out = { highlights: '', improvements: '', suggestions: '', adjust: '', bmr: null, water: null, kcal: null, raw: raw };

    function pick(re, min, max) {
      var m = re.exec(raw);
      if (!m) return null;
      var v = Math.round(parseFloat(m[1]));
      return (v >= min && v <= max) ? v : null;
    }
    out.bmr = pick(/(?:BMR|基础代谢)[^\d\-]{0,8}(\d{3,4}(?:\.\d+)?)/i, 600, 4000);
    out.water = pick(/(?:饮水|喝水)[^\d\-]{0,8}(\d{3,5})/, 200, 8000);
    out.kcal = pick(/(?:热量|摄入)[^\d\-]{0,8}(\d{3,5})/, 500, 8000);

    var onlyNums = /^[\d\s\.,，|｜]+$/;
    if (out.bmr === null || out.water === null || out.kcal === null) {
      for (var i = lines.length - 1; i >= 0; i--) {
        if (!onlyNums.test(lines[i])) continue;
        var ns = lines[i].split(/[\s|｜,，]+/).filter(Boolean)
          .map(function (x) { return parseFloat(x); })
          .filter(function (n) { return !isNaN(n); });
        if (ns.length >= 3) {
          if (out.bmr === null) out.bmr = Math.round(ns[0]);
          if (out.water === null) out.water = Math.round(ns[1]);
          if (out.kcal === null) out.kcal = Math.round(ns[2]);
          break;
        }
      }
    }

    var buckets = { highlights: [], improvements: [], suggestions: [], adjust: [] };
    function headOf(l) {
      var head = l.slice(0, 16);
      if (/调整|数值/.test(head)) return 'adjust';
      if (/亮点|做得好|优势|保持/.test(head)) return 'highlights';
      if (/改进|问题|不足|风险/.test(head)) return 'improvements';
      if (/建议|下周|行动|计划/.test(head)) return 'suggestions';
      return null;
    }
    var cur = null;
    lines.forEach(function (l) {
      if (onlyNums.test(l)) return;
      var h = headOf(l);
      if (h) {
        cur = h;
        var ci = l.search(/[：:]/);
        if (ci >= 0 && l.slice(ci + 1).trim()) buckets[h].push(l.slice(ci + 1).trim());
        return;
      }
      if (cur) buckets[cur].push(l.replace(/^[\s#*\-•\d\.\)、]+/, ''));
    });
    out.highlights = buckets.highlights.join('\n');
    out.improvements = buckets.improvements.join('\n');
    out.suggestions = buckets.suggestions.join('\n');
    out.adjust = buckets.adjust.join('\n');
    return out;
  }

  global.Share = {
    copyText: copyText,
    profileBlock: profileBlock,
    mealPrompt: mealPrompt,
    parseMealAi: parseMealAi,
    movePrompt: movePrompt,
    moveLogPrompt: moveLogPrompt,
    parseMoveAi: parseMoveAi,
    waterPrompt: waterPrompt,
    sleepPrompt: sleepPrompt,
    parseSleepAi: parseSleepAi,
    weeklyPrompt: weeklyPrompt,
    parseWeeklyAi: parseWeeklyAi,
    weightTrendLines: weightTrendLines
  };
})(window);
