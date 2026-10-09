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

  /** 指定开班日白班+夜班机台表中绑定该船的 unit */
  function unitsForShipOnDate(shipName, date) {
    var S = global.WorkStatSheetStore;
    if (!S || !S.getSheet) return [];
    var target = normName(shipName);
    if (!target) return [];
    var t = date || todayStr();
    var out = [];
    ['白班', '夜班'].forEach(function (shift) {
      var sheet = S.getSheet(t, shift);
      if (!sheet) return;
      (sheet.units || []).forEach(function (u) {
        var hit = normName(u.vesselName) === target;
        if (!hit && S.resolveVessel) {
          (u.rows || []).forEach(function (r) {
            if (normName((S.resolveVessel(u, r) || {}).name) === target) hit = true;
          });
        }
        if (!hit) return;
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

  /** 当日白班+夜班机台表中 vesselName 匹配的 unit */
  function unitsForShipToday(shipName) {
    return unitsForShipOnDate(shipName, todayStr());
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
      try { syncHourlyFromDispatch((res && res.date) || todayStr()); } catch (e) {}
      return {
        ok: !!(res && res.ok !== false),
        scene: scene,
        seeded: !!(res && res.seeded),
        workingCount: listWorkingShips().length
      };
    }
    return { ok: false, msg: '调度未加载', scene: scene };
  }

  function voyageForShip(shipName) {
    if (!global.ShipOpsDemo || !ShipOpsDemo.listDispatches) return '';
    var name = normName(shipName);
    var all = ShipOpsDemo.listDispatches('') || [];
    var i;
    for (i = 0; i < all.length; i++) {
      if (normName(all[i].shipName) === name && all[i].status === 'working') {
        return all[i].voyage || '';
      }
    }
    for (i = 0; i < all.length; i++) {
      if (normName(all[i].shipName) === name) return all[i].voyage || '';
    }
    return '';
  }

  function hourKey(date, shift, unitId, slot) {
    return [date || '', shift || '', unitId || '', String(slot || '').replace(/\s+/g, '')].join('|');
  }

  function isStoppageHour(row) {
    if (!row || row.normal !== false) return false;
    var mins = Number(row.abMins);
    return mins > 0 && !isNaN(mins);
  }

  /** 小时推送成功后写入/更新一条停工记录；改回正常再推则删除。同一 hourKey 只保留一条。 */
  function upsertFromPushedRow(date, shift, unit, row) {
    if (!unit || !row) return { ok: false, msg: '时段不存在' };
    var key = hourKey(date, shift, unit.id, row.slot);
    var data = loadAll();
    data.items = (data.items || []).filter(function (x) {
      return !(x && x.source === 'hourly_push' && x.hourKey === key);
    });
    if (!isStoppageHour(row)) {
      saveAll(data);
      return { ok: true, removed: true, hourKey: key };
    }
    var S = global.WorkStatSheetStore;
    var vessel = S && S.resolveVessel ? S.resolveVessel(unit, row) : { name: (unit && unit.vesselName) || '' };
    var vname = (vessel && vessel.name) || unit.vesselName || '';
    var item = {
      id: 'hr_' + key.replace(/\|/g, '_'),
      hourKey: key,
      source: 'hourly_push',
      date: date,
      shift: shift,
      unitId: unit.id,
      slot: row.slot,
      shipName: vname,
      vesselName: vname,
      voyage: voyageForShip(vname),
      berth: unit.berth || '',
      machine: unit.machine || '',
      driver: row.driver || unit.driver || '',
      cargo: row.cargoL2 || unit.cargoL2 || '',
      durationMin: Number(row.abMins) || 0,
      remark: row.remark || '',
      wecomSentAt: row.wecomSentAt || nowStamp(),
      readonly: true
    };
    data.items.unshift(item);
    saveAll(data);
    return { ok: true, item: item };
  }

  function inDateRange(d, from, to) {
    if (!d) return false;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  }

  function migratePushedHours(from, to) {
    var S = global.WorkStatSheetStore;
    if (!S || !S.listSheets) return;
    (S.listSheets() || []).forEach(function (sheet) {
      if (!inDateRange(sheet.date, from, to)) return;
      (sheet.units || []).forEach(function (u) {
        (u.rows || []).forEach(function (r) {
          if (!r.wecomSent) return;
          upsertFromPushedRow(sheet.date, sheet.shift, u, r);
        });
      });
    });
  }

  /**
   * 停工记录 = 已推送小时行生成的台账（一小时一条；再推送则更新）。
   * 入参可为日期字符串，或 { date, dateFrom, dateTo, vesselName }。
   */
  function list(dateOrOpts) {
    var dateFrom = '';
    var dateTo = '';
    var vesselFilter = '';
    if (typeof dateOrOpts === 'string') {
      dateFrom = dateOrOpts;
      dateTo = dateOrOpts;
    } else if (dateOrOpts && typeof dateOrOpts === 'object') {
      if (dateOrOpts.dateFrom || dateOrOpts.dateTo) {
        dateFrom = dateOrOpts.dateFrom || '';
        dateTo = dateOrOpts.dateTo || '';
      } else if (dateOrOpts.date) {
        dateFrom = dateOrOpts.date;
        dateTo = dateOrOpts.date;
      }
      vesselFilter = normName(dateOrOpts.vesselName || '');
    }
    if (dateFrom && dateTo && dateFrom > dateTo) {
      var tmp = dateFrom;
      dateFrom = dateTo;
      dateTo = tmp;
    }
    try { migratePushedHours(dateFrom, dateTo); } catch (e) {}
    var out = (loadAll().items || []).filter(function (r) {
      if (!r || r.source !== 'hourly_push') return false;
      if ((dateFrom || dateTo) && !inDateRange(r.date, dateFrom, dateTo)) return false;
      if (vesselFilter && normName(r.shipName || r.vesselName) !== vesselFilter) return false;
      return Number(r.durationMin) > 0;
    });
    out.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      if (a.shift !== b.shift) return a.shift === '白班' ? -1 : 1;
      if (a.slot !== b.slot) return String(a.slot) < String(b.slot) ? -1 : 1;
      if (a.shipName !== b.shipName) return a.shipName < b.shipName ? -1 : 1;
      return 0;
    });
    return out;
  }

  /** 演示：把当日非正常小时推一遍，生成停工记录 */
  function ensureDemoHourlyPushes(date) {
    var S = global.WorkStatSheetStore;
    if (!S || !S.getSheet) return { ok: false, written: 0 };
    var t = date || todayStr();
    var written = 0;
    ['白班', '夜班'].forEach(function (shift) {
      var sheet = S.getSheet(t, shift);
      if (!sheet) return;
      var locked = sheet.status === '审批中' || sheet.status === '已通过';
      (sheet.units || []).forEach(function (u) {
        (u.rows || []).forEach(function (r) {
          if (!isStoppageHour(r)) {
            if (r.wecomSent) upsertFromPushedRow(t, shift, u, r);
            return;
          }
          if (r.wecomSent || locked) {
            upsertFromPushedRow(t, shift, u, r);
            written += 1;
            return;
          }
          if (S.sendRowWecom) {
            var res = S.sendRowWecom(t, shift, u.id, r.slot);
            if (res && res.ok) written += 1;
          }
        });
      });
    });
    return { ok: true, date: t, written: written };
  }

  function listBoundVessels(dateOrOpts) {
    var seen = {};
    var names = [];
    var opts = dateOrOpts;
    if (typeof dateOrOpts === 'string') opts = { date: dateOrOpts };
    (list(opts || {}) || []).forEach(function (r) {
      var n = r.shipName || r.vesselName || '';
      if (n && !seen[n]) {
        seen[n] = true;
        names.push(n);
      }
    });
    names.sort();
    return names;
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
    try { syncHourlyFromDispatch(todayStr()); } catch (e) {}
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
    try { syncHourlyFromDispatch(todayStr()); } catch (e) {}
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
    upsertFromPushedRow: upsertFromPushedRow,
    ensureDemoHourlyPushes: ensureDemoHourlyPushes,
    create: create,
    remove: remove,
    listWorkingShips: listWorkingShips,
    unitsForShipToday: unitsForShipToday,
    unitsForShipOnDate: unitsForShipOnDate,
    listBoundVessels: listBoundVessels,
    syncHourlyFromDispatch: syncHourlyFromDispatch,
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

  function overlapMinutes(slotStart, slotEnd, fromMs, toMs) {
    var from = Math.max(slotStart.getTime(), fromMs);
    var to = Math.min(slotEnd.getTime(), toMs);
    if (to <= from) return 0;
    return Math.min(60, Math.floor((to - from) / 60000));
  }

  function overlapForSlot(vesselName, workDate, shift, slot) {
    var empty = { mins: 0, reason: '', status: 'ended', remark: '' };
    if (!global.ShipOpsDemo || !ShipOpsDemo.listStoppages) return empty;
    var name = normName(vesselName);
    if (!name) return empty;
    var bounds = parseSlotBounds(workDate, shift, slot);
    if (!bounds) return empty;
    var rows = ShipOpsDemo.listStoppages({ vesselName: name }) || [];
    if (!rows.length) {
      rows = (ShipOpsDemo.listStoppages({}) || []).filter(function (s) {
        return normName(s.shipName) === name;
      });
    }
    var now = Date.now();
    var mins = 0;
    var reason = '';
    var status = 'ended';
    var remark = '';
    var best = 0;
    rows.forEach(function (s) {
      if (normName(s.shipName) !== name) return;
      var fromMs = new Date(s.from).getTime();
      var toMs = s.to ? new Date(s.to).getTime() : now;
      if (isNaN(fromMs) || isNaN(toMs)) return;
      var m = overlapMinutes(bounds.start, bounds.end, fromMs, toMs);
      if (m <= 0) return;
      mins += m;
      if (m >= best) {
        best = m;
        reason = s.reason || '';
        remark = s.remark || '';
        status = (s.status === 'active' || !s.to) ? 'active' : 'ended';
      }
    });
    if (mins > 60) mins = 60;
    return { mins: mins, reason: reason, status: status, remark: remark };
  }

  /** 将调度停工按时段重叠分钟反写到绑定该船的工班小时行 */
  function syncHourlyFromDispatch(date) {
    var S = global.WorkStatSheetStore;
    if (!S || !S.getSheet || !S.applyHourlyStoppage) {
      return { ok: false, msg: '工班表未加载' };
    }
    var t = date || todayStr();
    var written = 0;
    ['白班', '夜班'].forEach(function (shift) {
      var sheet = S.getSheet(t, shift);
      if (!sheet) return;
      var slots = S.slotsForShift ? S.slotsForShift(shift) : [];
      (sheet.units || []).forEach(function (u) {
        slots.forEach(function (slot) {
          var row = null;
          for (var i = 0; i < (u.rows || []).length; i++) {
            if (u.rows[i].slot === slot) { row = u.rows[i]; break; }
          }
          var vessel = S.resolveVessel ? S.resolveVessel(u, row) : { name: (u && u.vesselName) || '' };
          var vname = normName(vessel && vessel.name);
          if (!vname) return;
          var overlap = overlapForSlot(vname, t, shift, slot);
          if (overlap.mins > 0) {
            var res = S.applyHourlyStoppage(t, shift, u.id, slot, {
              reason: overlap.reason || '船舶停工',
              abMins: overlap.mins,
              remark: overlap.remark ? ('船舶停工 · ' + overlap.remark) : ('船舶停工 · ' + (overlap.reason || ''))
            });
            if (res && res.ok) written += 1;
          } else if (row && row.stoppageFromVessel) {
            S.applyHourlyStoppage(t, shift, u.id, slot, { clear: true });
          }
        });
      });
    });
    return { ok: true, date: t, written: written };
  }

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
