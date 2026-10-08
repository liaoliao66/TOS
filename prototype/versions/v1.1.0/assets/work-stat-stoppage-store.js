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
   * 演示场景：写入调度侧今日案例停工（PC/H5 同源）
   * mixed：进行中 + 已结束；allClear：不强制写入（若今日为空则仍补案例）
   */
  function applyDemoScene(scene) {
    scene = scene === 'mixed' ? 'mixed' : 'allClear';
    if (global.ShipOpsDemo && ShipOpsDemo.ensurePcStoppageDemo) {
      var res = ShipOpsDemo.ensurePcStoppageDemo();
      return {
        ok: !!(res && res.ok !== false),
        scene: scene,
        seeded: !!(res && res.seeded),
        workingCount: listWorkingShips().length
      };
    }
    return { ok: false, msg: '调度未加载', scene: scene };
  }

  /** 台账以船舶调度停工为准（只读回显） */
  function list(date) {
    if (!global.ShipOpsDemo || !ShipOpsDemo.listStoppages) {
      return [];
    }
    var rows = ShipOpsDemo.listStoppages(date ? { date: date } : {}).map(function (s) {
      var durationMin = null;
      if (s.from && s.to) {
        var ms = new Date(s.to).getTime() - new Date(s.from).getTime();
        if (ms > 0) durationMin = Math.floor(ms / 60000);
      } else if (s.status === 'active' && s.from) {
        var activeMs = Date.now() - new Date(s.from).getTime();
        if (activeMs > 0) durationMin = Math.floor(activeMs / 60000);
      }
      var echo = null;
      try {
        var d = ShipOpsDemo.getDispatch(s.dispatchId);
        if (d) echo = dispatchMachineEcho(d);
      } catch (e) {}
      var units = unitsForShipToday(s.shipName) || [];
      var u0 = units[0] || null;
      return {
        id: s.id,
        date: s.date,
        dispatchId: s.dispatchId,
        shipName: s.shipName,
        voyage: s.voyage || '',
        shift: u0 ? (u0.shift || '') : '',
        berth: u0 ? (u0.berth || '') : (echo ? echo.berth : ''),
        machine: u0 ? (u0.machine || '') : (echo ? echo.machine : ''),
        vesselName: s.shipName,
        from: s.from,
        to: s.to,
        status: s.status,
        reason: s.reason,
        remark: s.remark || (s.status === 'active' ? '现场计时中' : ''),
        durationMin: durationMin,
        source: s.source || 'dispatch',
        readonly: true
      };
    });
    rows.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      if (a.from !== b.from) return a.from < b.from ? 1 : -1;
      return 0;
    });
    return rows;
  }

  function listActive() {
    if (!global.ShipOpsDemo || !ShipOpsDemo.listDispatches) {
      return loadAll().active.slice();
    }
    var out = [];
    (ShipOpsDemo.listDispatches('working') || []).forEach(function (d) {
      var a = getActiveByDispatch(d.id);
      if (a) out.push(a);
    });
    return out;
  }

  /** 本调度单累计停工分钟：已结束 + 进行中（以调度为准） */
  function cumulativeMinutesForDispatch(dispatchId) {
    var id = String(dispatchId || '');
    if (!id || !global.ShipOpsDemo || !ShipOpsDemo.listStoppages) return 0;
    var total = 0;
    ShipOpsDemo.listStoppages({ dispatchId: id }).forEach(function (s) {
      if (s.status === 'active' || !s.to) {
        var active = getActiveByDispatch(id);
        if (active) total += elapsedMinutes(active);
        return;
      }
      var ms = new Date(s.to).getTime() - new Date(s.from).getTime();
      if (ms > 0) total += Math.floor(ms / 60000);
    });
    return total;
  }

  function getActiveByDispatch(dispatchId) {
    var id = String(dispatchId || '');
    if (global.ShipOpsDemo && ShipOpsDemo.getActiveStoppageByDispatch) {
      var remote = ShipOpsDemo.getActiveStoppageByDispatch(id);
      if (remote) {
        var d = ShipOpsDemo.getDispatch(id);
        var startedAtMs = remote.startedAtMs || (remote.from ? new Date(remote.from).getTime() : Date.now());
        var local = null;
        var locals = loadAll().active || [];
        for (var i = 0; i < locals.length; i++) {
          if (locals[i].dispatchId === id) { local = locals[i]; break; }
        }
        return {
          id: remote.id,
          dispatchId: id,
          shipName: remote.shipName || (d && d.shipName) || '',
          voyage: (d && d.voyage) || '',
          instructionNo: (d && d.instructionNo) || '',
          reason: remote.reason,
          startedAtMs: startedAtMs,
          startedAt: remote.from,
          pushHourCount: local ? (local.pushHourCount || 0) : 0,
          units: unitsForShipToday(remote.shipName || (d && d.shipName) || ''),
          vesselName: remote.shipName || (d && d.shipName) || '',
          status: 'active'
        };
      }
    }
    var list = loadAll().active;
    for (var j = 0; j < list.length; j++) {
      if (list[j].dispatchId === id) return list[j];
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
    var remark = String(payload.remark || '').trim();
    if (reason === '其他' && !remark) {
      return { ok: false, msg: '选「其他」须填写具体原因' };
    }

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

    if (!ShipOpsDemo.startStoppageLive) {
      return { ok: false, msg: '调度停工接口未就绪' };
    }
    var startedAt = toLocalInput(new Date(now));
    var source = payload.source || 'h5_live';
    var dispRes = ShipOpsDemo.startStoppageLive(d.id, {
      reason: reason,
      from: startedAt,
      startedAtMs: now,
      source: source,
      remark: remark
    });
    if (!dispRes.ok) return dispRes;

    var active = {
      id: (dispRes.stop && dispRes.stop.id) || uid(),
      dispatchId: d.id,
      shipName: d.shipName,
      voyage: d.voyage || '',
      instructionNo: d.instructionNo || '',
      cargoInOut: d.cargoInOut || '',
      reason: reason,
      startedAtMs: now,
      startedAt: startedAt,
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
    data.active = (data.active || []).filter(function (a) { return a.dispatchId !== d.id; });
    data.active.unshift(active);
    saveAll(data);
    return { ok: true, active: active, warnNoUnits: !units.length };
  }

  function endLive(dispatchId, payload) {
    payload = payload || {};
    var id = String(dispatchId || '');
    var active = getActiveByDispatch(id);
    if (!active) return { ok: false, msg: '该船当前未在停工' };

    var endMs = Date.now();
    var from = active.startedAt || toLocalInput(new Date(active.startedAtMs));
    var to = String(payload.to || '').trim() || toLocalInput(new Date(endMs));
    if (to <= from) {
      var t2 = new Date(endMs + 60000);
      to = toLocalInput(t2);
    }
    var mins = elapsedMinutes(active);
    var reason = String(payload.reason || active.reason || '').trim();
    var remark = payload.remark != null
      ? String(payload.remark).trim()
      : String(active.remark || '').trim();
    if (!remark && reason !== '其他') {
      remark = '现场停工计时 · 共 ' + mins + ' 分';
    }
    var source = payload.source || 'h5_live';

    if (!global.ShipOpsDemo || !ShipOpsDemo.endStoppageLive) {
      return { ok: false, msg: '调度停工接口未就绪' };
    }
    if (payload.reason && !reason) return { ok: false, msg: '请选择停工类型' };
    if (reason === '其他' && !remark) {
      return { ok: false, msg: '选「其他」须填写具体原因' };
    }
    var dispRes = ShipOpsDemo.endStoppageLive(id, {
      stoppageId: payload.stoppageId || active.id,
      to: to,
      reason: reason,
      remark: remark,
      source: source
    });
    if (!dispRes.ok) return dispRes;

    var data = loadAll();
    data.active = (data.active || []).filter(function (a) { return a.dispatchId !== id; });
    saveAll(data);

    var stop = dispRes.stop || {};
    return {
      ok: true,
      item: {
        id: stop.id || active.id,
        date: String(stop.from || from).slice(0, 10),
        dispatchId: id,
        shipName: active.shipName,
        from: stop.from || from,
        to: stop.to || to,
        reason: stop.reason || reason || active.reason,
        remark: stop.remark != null ? stop.remark : remark,
        durationMin: mins,
        status: 'ended',
        source: source,
        readonly: false
      }
    };
  }

  /** PC：编辑已结束停工（时间 / 类型 / 备注） */
  function updateEnded(payload) {
    payload = payload || {};
    if (!global.ShipOpsDemo || !ShipOpsDemo.updateStoppage) {
      return { ok: false, msg: '调度修订接口未就绪' };
    }
    var dispatchId = String(payload.dispatchId || '').trim();
    var id = String(payload.id || '').trim();
    if (!dispatchId || !id) return { ok: false, msg: '缺少停工标识' };
    var reason = String(payload.reason || '').trim();
    var remark = String(payload.remark || '').trim();
    if (reason === '其他' && !remark) {
      return { ok: false, msg: '选「其他」须填写具体原因' };
    }
    return ShipOpsDemo.updateStoppage(dispatchId, id, {
      from: payload.from,
      to: payload.to,
      reason: reason,
      remark: remark
    });
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
    if (reason === '其他' && !remark) return { ok: false, msg: '选「其他」须填写具体原因' };
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
    updateEnded: updateEnded,
    elapsedMs: elapsedMs,
    elapsedMinutes: elapsedMinutes,
    completedHours: completedHours,
    markPushHours: markPushHours,
    cumulativeMinutesForDispatch: cumulativeMinutesForDispatch,
    applyDemoScene: applyDemoScene,
    /** 工班大表：按船名+开班日+班次+时段回显船舶停工（只读） */
    stoppageForSlot: stoppageForSlot
  };

  function parseSlotBounds(workDate, shift, slot) {
    var m = String(slot || '').match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
    if (!m || !workDate) return null;
    var h1 = Number(m[1]);
    var min1 = Number(m[2]);
    var h2 = Number(m[3]);
    var min2 = Number(m[4]);
    var p = String(workDate).split('-');
    function at(dayOff, h, mi) {
      var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), h, mi, 0, 0);
      d.setDate(d.getDate() + dayOff);
      return d;
    }
    var startOff = 0;
    var endOff = 0;
    if (shift === '夜班') {
      if (h1 < 8) startOff = 1;
      if (h2 < 8 || (h1 === 23 && h2 === 0)) endOff = 1;
      else if (h2 === 0 && h1 >= 20) endOff = 1;
    }
    return { start: at(startOff, h1, min1), end: at(endOff, h2, min2) };
  }

  function stoppageForSlot(vesselName, workDate, shift, slot) {
    if (!global.ShipOpsDemo || !ShipOpsDemo.listStoppages) return null;
    var name = normName(vesselName);
    if (!name) return null;
    var bounds = parseSlotBounds(workDate, shift, slot);
    if (!bounds) return null;
    var rows = ShipOpsDemo.listStoppages({ vesselName: name });
    // shipName match loose
    if (!rows.length) {
      rows = ShipOpsDemo.listStoppages({}).filter(function (s) {
        return normName(s.shipName) === name;
      });
    }
    var now = Date.now();
    for (var i = 0; i < rows.length; i++) {
      var s = rows[i];
      if (normName(s.shipName) !== name) continue;
      var fromMs = new Date(s.from).getTime();
      var toMs = s.to ? new Date(s.to).getTime() : now;
      if (isNaN(fromMs) || isNaN(toMs)) continue;
      if (fromMs < bounds.end.getTime() && toMs > bounds.start.getTime()) {
        return {
          id: s.id,
          reason: s.reason,
          status: s.status,
          from: s.from,
          to: s.to,
          label: s.status === 'active' ? ('停工中 · ' + s.reason) : ('船舶停工 · ' + s.reason),
          readonly: true
        };
      }
    }
    return null;
  }
})(window);
