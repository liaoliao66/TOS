/**
 * 工班作业 · 停工记录（独立 localStorage，关联调度 + 机台表）
 * 支持：台账登记 + 现场停工/开工计时（active）
 */
(function (global) {
  var STORE_KEY = 'tosWorkStatStoppages_v1';

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function nowStamp() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' +
      pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function toLocalInput(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + 'T' +
      pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function uid() {
    return 'stp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function normName(s) {
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  }

  function normalize(data) {
    if (!data || typeof data !== 'object') data = { items: [], active: [] };
    if (!Array.isArray(data.items)) data.items = [];
    if (!Array.isArray(data.active)) data.active = [];
    return data;
  }

  function loadAll() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (p && Array.isArray(p.items)) return normalize(p);
      }
    } catch (e) {}
    return seedDemo();
  }

  function saveAll(data) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(normalize(data))); } catch (e) {}
  }

  function todayStr() {
    if (global.WorkStatSheetStore && WorkStatSheetStore.todayStr) {
      return WorkStatSheetStore.todayStr();
    }
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function listWorkingShips() {
    if (!global.ShipOpsDemo || !ShipOpsDemo.listDispatches) return [];
    return ShipOpsDemo.listDispatches('working');
  }

  /** 当日白班+夜班机台表中 vesselName 匹配的 unit */
  function unitsForShipToday(shipName) {
    var S = global.WorkStatSheetStore;
    if (!S || !S.getSheet) return [];
    var target = normName(shipName);
    if (!target) return [];
    var t = todayStr();
    var out = [];
    ['白班', '夜班'].forEach(function (shift) {
      var sheet = S.getSheet(t, shift);
      if (!sheet) return;
      (sheet.units || []).forEach(function (u) {
        if (normName(u.vesselName) !== target) return;
        out.push({
          unitId: u.id,
          sheetId: sheet.id,
          date: sheet.date,
          shift: sheet.shift,
          berth: u.berth || '',
          machine: u.machine || '',
          driver: u.driver || '',
          cargo: u.cargoL2 || u.cargo || '',
          vesselId: u.vesselId || '',
          vesselName: u.vesselName || ''
        });
      });
    });
    return out;
  }

  /** 调度侧泊位/机台回显（无机台表时兜底） */
  function dispatchMachineEcho(d) {
    if (!d) return null;
    var start = d.start || {};
    var berth = d.berth || {};
    return {
      berth: start.berthNo || berth.berthNo || '',
      machine: start.craneUp || start.craneDown || '',
      cargo: start.cargoL2 || start.cargo || '',
      loadUnload: start.loadUnload || '',
      process: start.process || ''
    };
  }

  function seedDemo() {
    var data = { items: [], active: [] };
    saveAll(data);
    return data;
  }

  /**
   * 演示场景（覆盖写入，便于评审切换）
   * allClear：两艘均作业中、无停工中、无今日已完结
   * mixed：一艘停工中 + 一艘作业中 + 一条今日已停工
   */
  function applyDemoScene(scene) {
    scene = scene === 'mixed' ? 'mixed' : 'allClear';
    var working = listWorkingShips();
    var w1 = working[0] || null;
    var w2 = working[1] || null;
    var t = todayStr();
    var data = { items: [], active: [] };

    if (scene === 'mixed' && w1) {
      var units1 = unitsForShipToday(w1.shipName);
      var u1 = units1[0] || null;
      var echo1 = dispatchMachineEcho(w1);
      var startMs = Date.now() - 18 * 60000;
      data.active.push({
        id: 'stp_active_demo',
        dispatchId: w1.id,
        shipName: w1.shipName,
        voyage: w1.voyage || '',
        instructionNo: w1.instructionNo || '',
        reason: '等货/等驳',
        startedAtMs: startMs,
        startedAt: toLocalInput(new Date(startMs)),
        pushHourCount: 0,
        units: units1,
        unitId: u1 ? u1.unitId : '',
        sheetId: u1 ? u1.sheetId : '',
        shift: u1 ? u1.shift : '',
        berth: u1 ? u1.berth : (echo1 ? echo1.berth : ''),
        machine: u1 ? u1.machine : (echo1 ? echo1.machine : ''),
        vesselName: u1 ? u1.vesselName : normName(w1.shipName),
        cargo: u1 ? u1.cargo : (echo1 ? echo1.cargo : ''),
        driver: u1 ? u1.driver : ''
      });

      var shipDone = w2 || w1;
      var unitsDone = unitsForShipToday(shipDone.shipName);
      var uDone = unitsDone[0] || null;
      var echoDone = dispatchMachineEcho(shipDone);
      data.items.push({
        id: 'stp_done_demo',
        date: t,
        dispatchId: shipDone.id,
        shipName: shipDone.shipName,
        voyage: shipDone.voyage || '',
        cargoInOut: shipDone.cargoInOut || '',
        unitId: uDone ? uDone.unitId : '',
        sheetId: uDone ? uDone.sheetId : '',
        shift: uDone ? uDone.shift : '白班',
        berth: uDone ? uDone.berth : (echoDone ? echoDone.berth : ''),
        machine: uDone ? uDone.machine : (echoDone ? echoDone.machine : ''),
        vesselId: '',
        vesselName: uDone ? uDone.vesselName : normName(shipDone.shipName),
        cargo: uDone ? uDone.cargo : (echoDone ? echoDone.cargo : ''),
        driver: uDone ? (uDone.driver || '') : '',
        from: t + 'T08:10',
        to: t + 'T08:45',
        reason: '设备异常',
        remark: '演示：今日已结束的停工 · 共 35 分',
        createdAt: nowStamp(),
        updater: '张录入',
        durationMin: 35
      });
    }

    saveAll(data);
    return { ok: true, scene: scene, workingCount: working.length };
  }

  function list(date) {
    var rows = loadAll().items.slice();
    if (date) rows = rows.filter(function (r) { return r.date === date; });
    rows.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      if (a.from !== b.from) return a.from < b.from ? 1 : -1;
      return 0;
    });
    return rows;
  }

  function listActive() {
    return loadAll().active.slice();
  }

  /** 本调度单累计停工分钟：已结束台账 + 当前进行中 */
  function cumulativeMinutesForDispatch(dispatchId) {
    var id = String(dispatchId || '');
    if (!id) return 0;
    var total = 0;
    var items = loadAll().items || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].dispatchId !== id) continue;
      if (items[i].durationMin != null && !isNaN(Number(items[i].durationMin))) {
        total += Number(items[i].durationMin);
      } else if (items[i].from && items[i].to) {
        var ms = new Date(items[i].to).getTime() - new Date(items[i].from).getTime();
        if (ms > 0) total += Math.floor(ms / 60000);
      }
    }
    var active = getActiveByDispatch(id);
    if (active) total += elapsedMinutes(active);
    return total;
  }

  function getActiveByDispatch(dispatchId) {
    var id = String(dispatchId || '');
    var list = loadAll().active;
    for (var i = 0; i < list.length; i++) {
      if (list[i].dispatchId === id) return list[i];
    }
    return null;
  }

  function findUnitMeta(units, unitId) {
    for (var i = 0; i < units.length; i++) {
      if (units[i].unitId === unitId) return units[i];
    }
    return null;
  }

  function elapsedMs(active) {
    if (!active || !active.startedAtMs) return 0;
    return Math.max(0, Date.now() - Number(active.startedAtMs));
  }

  function elapsedMinutes(active) {
    return Math.floor(elapsedMs(active) / 60000);
  }

  /** 已满整小时数（用于推送） */
  function completedHours(active) {
    return Math.floor(elapsedMs(active) / 3600000);
  }

  function startLive(payload) {
    payload = payload || {};
    if (!global.ShipOpsDemo || !ShipOpsDemo.getDispatch) {
      return { ok: false, msg: '调度数据未加载' };
    }
    var dispatchId = String(payload.dispatchId || '').trim();
    if (!dispatchId) return { ok: false, msg: '请选择船舶' };
    var d = ShipOpsDemo.getDispatch(dispatchId);
    if (!d) return { ok: false, msg: '调度单不存在' };
    if (d.status !== 'working') return { ok: false, msg: '仅「开工」船舶可登记停工' };

    var reason = String(payload.reason || '').trim();
    if (!reason) return { ok: false, msg: '请选择停工原因' };

    if (getActiveByDispatch(dispatchId)) {
      return { ok: false, msg: '该船已在停工计时中' };
    }

    var units = unitsForShipToday(d.shipName);
    var unitId = String(payload.unitId || '').trim();
    var unitMeta = unitId ? findUnitMeta(units, unitId) : (units.length === 1 ? units[0] : null);
    var echo = dispatchMachineEcho(d);
    var now = Date.now();
    var driverNames = [];
    var seenDrv = {};
    units.forEach(function (u) {
      if (u.driver && !seenDrv[u.driver]) {
        seenDrv[u.driver] = true;
        driverNames.push(u.driver);
      }
    });

    var active = {
      id: uid(),
      dispatchId: d.id,
      shipName: d.shipName,
      voyage: d.voyage || '',
      instructionNo: d.instructionNo || '',
      cargoInOut: d.cargoInOut || '',
      reason: reason,
      startedAtMs: now,
      startedAt: toLocalInput(new Date(now)),
      pushHourCount: 0,
      units: units,
      unitId: unitMeta ? unitMeta.unitId : '',
      sheetId: unitMeta ? unitMeta.sheetId : '',
      shift: unitMeta ? unitMeta.shift : '',
      berth: unitMeta ? unitMeta.berth : (echo ? echo.berth : ''),
      machine: unitMeta ? unitMeta.machine : (echo ? echo.machine : ''),
      vesselName: unitMeta ? unitMeta.vesselName : normName(d.shipName),
      cargo: unitMeta ? unitMeta.cargo : (echo ? echo.cargo : ''),
      driver: driverNames.join('、')
    };

    var data = loadAll();
    data.active.unshift(active);
    saveAll(data);
    return { ok: true, active: active, warnNoUnits: !units.length };
  }

  function endLive(dispatchId) {
    var data = loadAll();
    var id = String(dispatchId || '');
    var idx = -1;
    for (var i = 0; i < data.active.length; i++) {
      if (data.active[i].dispatchId === id) { idx = i; break; }
    }
    if (idx < 0) return { ok: false, msg: '该船当前未在停工' };

    var active = data.active[idx];
    var endMs = Date.now();
    var from = active.startedAt || toLocalInput(new Date(active.startedAtMs));
    var to = toLocalInput(new Date(endMs));
    if (to <= from) {
      // 同一分钟内结束，结束时间 +1 分，满足校验
      var t2 = new Date(endMs + 60000);
      to = toLocalInput(t2);
    }

    var item = {
      id: active.id,
      date: todayStr(),
      dispatchId: active.dispatchId,
      shipName: active.shipName,
      voyage: active.voyage || '',
      cargoInOut: active.cargoInOut || '',
      unitId: active.unitId || '',
      sheetId: active.sheetId || '',
      shift: active.shift || '',
      berth: active.berth || '',
      machine: active.machine || '',
      vesselId: '',
      vesselName: active.vesselName || active.shipName,
      cargo: active.cargo || '',
      driver: active.driver || '',
      from: from,
      to: to,
      reason: active.reason,
      remark: '现场停工计时 · 共 ' + elapsedMinutes(active) + ' 分',
      createdAt: nowStamp(),
      updater: '张录入',
      durationMin: elapsedMinutes(active)
    };

    data.active.splice(idx, 1);
    data.items.unshift(item);
    saveAll(data);
    return { ok: true, item: item };
  }

  function markPushHours(activeId, count) {
    var data = loadAll();
    for (var i = 0; i < data.active.length; i++) {
      if (data.active[i].id === activeId) {
        data.active[i].pushHourCount = count;
        saveAll(data);
        return data.active[i];
      }
    }
    return null;
  }

  function create(payload) {
    payload = payload || {};
    if (!global.ShipOpsDemo || !ShipOpsDemo.getDispatch) {
      return { ok: false, msg: '调度数据未加载' };
    }
    var dispatchId = String(payload.dispatchId || '').trim();
    if (!dispatchId) return { ok: false, msg: '请选择船舶' };
    var d = ShipOpsDemo.getDispatch(dispatchId);
    if (!d) return { ok: false, msg: '调度单不存在' };
    if (d.status !== 'working') return { ok: false, msg: '仅「开工且未完工」的船舶可登记停工' };

    var from = String(payload.from || '').trim();
    var to = String(payload.to || '').trim();
    var reason = String(payload.reason || '').trim();
    var remark = String(payload.remark || '').trim();
    if (!from || !to) return { ok: false, msg: '请填写开始与结束时间' };
    if (!reason) return { ok: false, msg: '请选择停工类型' };
    if (new Date(to) <= new Date(from)) return { ok: false, msg: '结束时间须晚于开始时间' };

    var units = unitsForShipToday(d.shipName);
    var unitId = String(payload.unitId || '').trim();
    var unitMeta = unitId ? findUnitMeta(units, unitId) : null;
    if (units.length && !unitMeta) {
      return { ok: false, msg: '请选择当日机台表' };
    }

    var regDate = String(payload.date || todayStr()).trim();
    var item = {
      id: uid(),
      date: regDate,
      dispatchId: d.id,
      shipName: d.shipName,
      voyage: d.voyage || '',
      unitId: unitMeta ? unitMeta.unitId : '',
      sheetId: unitMeta ? unitMeta.sheetId : '',
      shift: unitMeta ? unitMeta.shift : '',
      berth: unitMeta ? unitMeta.berth : '',
      machine: unitMeta ? unitMeta.machine : '',
      vesselId: unitMeta ? unitMeta.vesselId : '',
      vesselName: unitMeta ? unitMeta.vesselName : normName(d.shipName),
      from: from,
      to: to,
      reason: reason,
      remark: remark,
      createdAt: nowStamp(),
      updater: payload.updater || '张录入'
    };

    var data = loadAll();
    data.items.unshift(item);
    saveAll(data);
    return {
      ok: true,
      item: item,
      warnNoUnits: !units.length ? '当日无机台表，已仅关联船舶/调度' : ''
    };
  }

  function remove(id) {
    var data = loadAll();
    var before = data.items.length;
    data.items = data.items.filter(function (x) { return x.id !== id; });
    if (data.items.length === before) return { ok: false, msg: '记录不存在' };
    saveAll(data);
    return { ok: true };
  }

  global.WorkStatStoppageStore = {
    todayStr: todayStr,
    list: list,
    create: create,
    remove: remove,
    listWorkingShips: listWorkingShips,
    unitsForShipToday: unitsForShipToday,
    dispatchMachineEcho: dispatchMachineEcho,
    listActive: listActive,
    getActiveByDispatch: getActiveByDispatch,
    startLive: startLive,
    endLive: endLive,
    elapsedMs: elapsedMs,
    elapsedMinutes: elapsedMinutes,
    completedHours: completedHours,
    markPushHours: markPushHours,
    cumulativeMinutesForDispatch: cumulativeMinutesForDispatch,
    applyDemoScene: applyDemoScene
  };
})(window);
