/**
 * v1.2.0 效率页智能体：筛选上下文追问 / 图表解读 / 快捷问句模板
 * 页面须提供 window.EffAgentPage = { pageKey, pageLabel, getFilterContext, getChartSnapshot, answerQuestion? }
 */
(function (global) {
  var STORAGE_KEY = 'tos_eff_agent_shortcuts_v12';

  var PAGE_PRESETS = {
    master: [
      { label: '当前筛选下司机效率 Top5', q: '按当前筛选给出司机效率 Top5' },
      { label: '白班 vs 夜班对比', q: '当前筛选下白班和夜班效率对比如何' },
      { label: '解读效率趋势图', q: '解读当前每日作业量趋势图' },
      { label: '异常产量偏高司机', q: '当前筛选下哪些司机异常产量偏高' }
    ],
    volume: [
      { label: '区间总作业量', q: '按当前筛选给出区间总作业量' },
      { label: '货种结构解读', q: '解读当前货种结构图' },
      { label: '趋势拐点说明', q: '解读作业量趋势有无拐点' },
      { label: '班次产量对比', q: '当前筛选下白班夜班产量对比' }
    ],
    ship: [
      { label: '单船效率 Top5', q: '按当前筛选给出单船效率 Top5' },
      { label: '在港用时偏长船', q: '哪些船在港时间偏长' },
      { label: '解读效率排名', q: '解读当前船舶效率排名图' },
      { label: '岸电作业占比', q: '当前筛选岸电作业占比多少' }
    ]
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function getPageCfg() {
    return global.EffAgentPage || {};
  }

  function pageKey() {
    var cfg = getPageCfg();
    return cfg.pageKey || 'master';
  }

  function loadMine() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveMine(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list || []));
  }

  function buildContextHtml() {
    var cfg = getPageCfg();
    var ctx = typeof cfg.getFilterContext === 'function' ? (cfg.getFilterContext() || {}) : {};
    var lines = [];
    lines.push('<div class="text-xs font-medium text-slate-700 mb-1">当前筛选上下文</div>');
    lines.push('<ul class="text-xs text-slate-600 space-y-0.5">');
    Object.keys(ctx).forEach(function (k) {
      lines.push('<li><span class="text-slate-400">' + esc(k) + '：</span>' + esc(ctx[k]) + '</li>');
    });
    if (!Object.keys(ctx).length) {
      lines.push('<li class="text-slate-400">暂无筛选信息</li>');
    }
    lines.push('</ul>');
    lines.push('<div class="mt-2 text-[11px] text-teal-800 bg-teal-50 rounded-lg px-2 py-1.5">追问将默认带入以上筛选，无需重复描述条件。</div>');
    return lines.join('');
  }

  function refreshContextBanner() {
    var el = document.getElementById('askContextBanner');
    if (el) el.innerHTML = buildContextHtml();
  }

  function renderPresetChips() {
    var box = document.getElementById('askChipsPreset');
    if (!box) return;
    var list = PAGE_PRESETS[pageKey()] || PAGE_PRESETS.master;
    box.innerHTML = list.map(function (item) {
      return '<button type="button" class="ask-chip" data-q="' + esc(item.q) + '">' + esc(item.label) + '</button>';
    }).join('');
    box.querySelectorAll('.ask-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var q = btn.getAttribute('data-q');
        runQuery(q);
      });
    });
  }

  function renderMyShortcuts() {
    var box = document.getElementById('askChipsMine');
    if (!box) return;
    var mine = loadMine();
    box.innerHTML = '';
    if (!mine.length) {
      box.innerHTML = '<span class="text-xs text-slate-400">暂无，可「创建快捷」或将上次问法存为快捷</span>';
      return;
    }
    mine.forEach(function (item) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ask-chip';
      btn.innerHTML = '<span class="chip-run">' + esc(item.name) + '</span><span class="chip-edit" title="修改"><i class="fa-solid fa-pen"></i></span>';
      btn.querySelector('.chip-run').addEventListener('click', function (ev) {
        ev.stopPropagation();
        runQuery(item.query);
      });
      btn.querySelector('.chip-edit').addEventListener('click', function (ev) {
        ev.stopPropagation();
        openShortcutEditor(item.id);
      });
      box.appendChild(btn);
    });
  }

  function appendUser(text) {
    var chat = document.getElementById('askChat');
    if (!chat) return;
    var div = document.createElement('div');
    div.className = 'flex justify-end';
    div.innerHTML = '<div class="bubble-user px-3 py-2 text-sm max-w-[90%]">' + esc(text) + '</div>';
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
  }

  function appendBot(html) {
    var chat = document.getElementById('askChat');
    if (!chat) return;
    var div = document.createElement('div');
    div.className = 'flex justify-start';
    div.innerHTML = '<div class="bubble-bot px-3 py-2 text-sm max-w-[95%] leading-relaxed">' + html + '</div>';
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
  }

  function defaultAnswer(q) {
    var cfg = getPageCfg();
    var ctx = typeof cfg.getFilterContext === 'function' ? (cfg.getFilterContext() || {}) : {};
    var snap = typeof cfg.getChartSnapshot === 'function' ? (cfg.getChartSnapshot() || {}) : {};
    var ctxLine = Object.keys(ctx).map(function (k) { return k + '=' + ctx[k]; }).join('；') || '无';

    if (q.indexOf('解读') >= 0 || q.indexOf('趋势图') >= 0 || q.indexOf('结构图') >= 0 || q.indexOf('排名图') >= 0) {
      var title = snap.title || (cfg.pageLabel || '当前图表');
      var points = snap.points || [];
      var html = '<div class="font-medium mb-1">图表解读 · ' + esc(title) + '</div>';
      html += '<div class="text-xs text-slate-500 mb-2">基于筛选：' + esc(ctxLine) + '</div>';
      if (points.length) {
        html += '<ul class="list-disc pl-4 space-y-1">';
        points.forEach(function (p) { html += '<li>' + esc(p) + '</li>'; });
        html += '</ul>';
      } else {
        html += '<p>当前视图数据已按筛选刷新。建议关注峰值日、班次落差与货种集中度。</p>';
      }
      if (snap.hint) html += '<p class="mt-2 text-xs text-teal-800">' + esc(snap.hint) + '</p>';
      return html;
    }

    if (typeof cfg.answerQuestion === 'function') {
      var custom = cfg.answerQuestion(q, ctx, snap);
      if (custom) return custom;
    }

    return '<div class="font-medium mb-1">已按当前筛选作答</div>' +
      '<div class="text-xs text-slate-500 mb-2">' + esc(ctxLine) + '</div>' +
      '<p>原型示意：已理解「' + esc(q) + '」。可点上方快捷模板，或继续追问（如「只看白班」「对比上一日」）。</p>';
  }

  function runQuery(q) {
    q = (q || '').trim();
    if (!q) return;
    global.__askLastQ = q;
    refreshContextBanner();
    appendUser(q);
    setTimeout(function () {
      appendBot(defaultAnswer(q));
    }, 260);
  }

  function openAsk(prefill) {
    document.getElementById('askMask').classList.add('open');
    document.getElementById('askDrawer').classList.add('open');
    refreshContextBanner();
    renderPresetChips();
    renderMyShortcuts();
    var chat = document.getElementById('askChat');
    if (chat && !chat.dataset.inited) {
      chat.dataset.inited = '1';
      var cfg = getPageCfg();
      appendBot('你好，我是「' + esc(cfg.pageLabel || '效率分析') + '」智能助手。支持：①按当前筛选追问 ②图表解读 ③快捷问句模板。');
    }
    if (prefill) runQuery(prefill);
  }

  function closeAsk() {
    document.getElementById('askMask').classList.remove('open');
    document.getElementById('askDrawer').classList.remove('open');
    document.getElementById('askDrawer').classList.remove('fullscreen');
    global.__askFullscreen = false;
    var btn = document.getElementById('askFullBtn');
    if (btn) btn.innerHTML = '<i class="fa-solid fa-expand mr-1"></i>全屏';
  }

  function toggleAskFullscreen() {
    var drawer = document.getElementById('askDrawer');
    global.__askFullscreen = !global.__askFullscreen;
    drawer.classList.toggle('fullscreen', global.__askFullscreen);
    var btn = document.getElementById('askFullBtn');
    if (btn) {
      btn.innerHTML = global.__askFullscreen
        ? '<i class="fa-solid fa-compress mr-1"></i>退出全屏'
        : '<i class="fa-solid fa-expand mr-1"></i>全屏';
    }
  }

  function sendAsk(e) {
    if (e && e.preventDefault) e.preventDefault();
    var input = document.getElementById('askInput');
    var q = (input && input.value || '').trim();
    if (!q) return false;
    if (input) input.value = '';
    runQuery(q);
    return false;
  }

  function openShortcutEditor(id) {
    global.__shortcutEditId = id || null;
    var modal = document.getElementById('shortcutModal');
    if (!modal) return;
    modal.style.display = 'flex';
    var title = document.getElementById('shortcutModalTitle');
    var nameEl = document.getElementById('shortcutName');
    var queryEl = document.getElementById('shortcutQuery');
    var mine = loadMine();
    if (id) {
      var item = mine.find(function (x) { return x.id === id; });
      title.textContent = '修改快捷名称';
      nameEl.value = item ? item.name : '';
      queryEl.value = item ? item.query : '';
      queryEl.readOnly = true;
      queryEl.classList.add('bg-slate-50');
    } else {
      title.textContent = '创建快捷查询';
      nameEl.value = '';
      queryEl.value = global.__askLastQ || '';
      queryEl.readOnly = false;
      queryEl.classList.remove('bg-slate-50');
    }
    nameEl.focus();
  }

  function closeShortcutEditor() {
    var modal = document.getElementById('shortcutModal');
    if (modal) modal.style.display = 'none';
    global.__shortcutEditId = null;
  }

  function commitShortcut() {
    var name = (document.getElementById('shortcutName').value || '').trim();
    var query = (document.getElementById('shortcutQuery').value || '').trim();
    if (!name) { if (typeof showToast === 'function') showToast('请填写快捷名称', 'err'); return; }
    if (!query) { if (typeof showToast === 'function') showToast('请填写查询问法', 'err'); return; }
    var mine = loadMine();
    if (global.__shortcutEditId) {
      mine = mine.map(function (x) {
        if (x.id === global.__shortcutEditId) return { id: x.id, name: name, query: x.query };
        return x;
      });
      if (typeof showToast === 'function') showToast('快捷名称已更新');
    } else {
      if (mine.some(function (x) { return x.name === name; })) {
        if (typeof showToast === 'function') showToast('名称已存在，请更换', 'err');
        return;
      }
      mine.push({ id: 's' + Date.now(), name: name, query: query });
      if (typeof showToast === 'function') showToast('快捷已创建');
    }
    saveMine(mine);
    renderMyShortcuts();
    closeShortcutEditor();
  }

  function saveCurrentAsShortcut() {
    if (!global.__askLastQ) {
      if (typeof showToast === 'function') showToast('请先发起一次问数', 'err');
      return;
    }
    openShortcutEditor();
    document.getElementById('shortcutQuery').value = global.__askLastQ;
  }

  function mountDrawerShell() {
    /* 若页面已内嵌抽屉则只绑定；否则可调用 ensureShell */
    renderPresetChips();
    renderMyShortcuts();
    refreshContextBanner();
  }

  global.EffAgent = {
    openAsk: openAsk,
    closeAsk: closeAsk,
    toggleAskFullscreen: toggleAskFullscreen,
    sendAsk: sendAsk,
    runQuery: runQuery,
    openShortcutEditor: openShortcutEditor,
    closeShortcutEditor: closeShortcutEditor,
    commitShortcut: commitShortcut,
    saveCurrentAsShortcut: saveCurrentAsShortcut,
    refreshContextBanner: refreshContextBanner,
    mountDrawerShell: mountDrawerShell,
    appendBot: appendBot,
    appendUser: appendUser
  };

  global.openAsk = openAsk;
  global.closeAsk = closeAsk;
  global.toggleAskFullscreen = toggleAskFullscreen;
  global.sendAsk = sendAsk;
  global.openShortcutEditor = openShortcutEditor;
  global.closeShortcutEditor = closeShortcutEditor;
  global.commitShortcut = commitShortcut;
  global.saveCurrentAsShortcut = saveCurrentAsShortcut;
})(window);
