/**
 * 船期管理 + 船舶调度（原型数据）
 * - 预报：仅船舶必填；编辑可改除船次/船名外字段；可确报/作废
 * - 确报进入调度「未入港」
 * - 调度：未入港→靠泊→开工→完工→离泊；停工可多条（起止时间+原因字典）
 * - 调度替代原「船舶作业」入口
 */
(function (global) {
  var KEY = 'tos_ship_ops_v4';

  var STOP_REASONS = (global.StopReasonDemo && StopReasonDemo.namesEnabled)
    ? StopReasonDemo.namesEnabled()
    : ['天气原因', '设备异常', '等货/等驳', '移泊', '其他'];
  var CARGO_OPTS = ['集装箱', '散货', '件杂货'];
  var LOAD_OPTS = ['装船', '卸船', '装卸'];
  var PROCESS_OPTS = ['船-船', '船-场', '船-船, 船-场'];
  var BERTH_OPTS = ['1#', '2#', '3#', '4#', '5#', '6#'];

  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function uid(p) { return p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

  function nowLocal() {
    var d = new Date();
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' +
      pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function mkSch(o) {
    return {
      id: o.id,
      shipId: o.shipId || '',
      shipName: o.shipName,
      voyage: o.voyage,
      eta: o.eta || '',
      etd: o.etd || '',
      cargoInOut: o.cargoInOut || '进场',
      loadType: o.loadType || '装卸',
      remark: o.remark || '',
      captain: o.captain || '',
      captainPhone: o.captainPhone || '',
      instructionNo: o.instructionNo || o.voyage,
      workMode: o.workMode || '船-场',
      status: o.status,
      createdAt: o.createdAt || '2026-08-01T08:00'
    };
  }

  function emptyDisp(o) {
    return {
      id: o.id,
      scheduleId: o.scheduleId || '',
      shipName: o.shipName,
      voyage: o.voyage,
      instructionNo: o.instructionNo || o.voyage,
      captain: o.captain || '张飞',
      captainPhone: o.captainPhone || '13455555555',
      cargoInOut: o.cargoInOut || '进场',
      loadType: o.loadType || '装卸',
      workMode: o.workMode || '船-船, 船-场',
      status: o.status,
      berth: o.berth || { plan: '', actual: '', berthNo: '', remark: '' },
      start: o.start || { plan: '', actual: '', berthNo: '', cargo: '', cargoL1: '', cargoL2: '', loadUnload: '', process: '', craneUp: '', craneDown: '', shorePower: false, remark: '' },
      finish: o.finish || { plan: '', actual: '', berthNo: '', workers: null, qty: null, remark: '' },
      unberth: o.unberth || { plan: '', actual: '', remark: '' },
      depart: o.depart || { plan: '', actual: '' },
      stoppages: o.stoppages || [],
      workLogs: o.workLogs || []
    };
  }

  /** 每种状态各 2 条演示数据 */
  function seedState() {
    var schedules = [
      mkSch({ id: 'sch-f1', shipName: '远航 168', voyage: 'V260801', status: 'forecast', eta: '2026-08-12T06:00', captain: '张伟', captainPhone: '13800001111', instructionNo: 'Y260801' }),
      mkSch({ id: 'sch-f2', shipName: '海丰致远', voyage: 'V260802', status: 'forecast', eta: '2026-08-13T14:00', cargoInOut: '出场', loadType: '装船', captain: '李强', captainPhone: '13900002222', instructionNo: 'Y260802' }),
      mkSch({ id: 'sch-c1', shipName: '远航 168', voyage: 'V260701', status: 'confirmed', eta: '2026-08-10T08:00', captain: '张伟', captainPhone: '13800001111', instructionNo: '4545' }),
      mkSch({ id: 'sch-c2', shipName: '海丰致远', voyage: 'V260702', status: 'confirmed', eta: '2026-08-11T09:30', captain: '李强', captainPhone: '13900002222', instructionNo: '4546' }),
      mkSch({ id: 'sch-v1', shipName: '远航 168', voyage: 'V260601', status: 'void', eta: '2026-07-20T10:00', remark: '船期取消', instructionNo: 'Y260601' }),
      mkSch({ id: 'sch-v2', shipName: '海丰致远', voyage: 'V260602', status: 'void', eta: '2026-07-22T16:00', remark: '改挂其他码头', instructionNo: 'Y260602' })
    ];

    var dispatches = [
      emptyDisp({
        id: 'dsp-p1', scheduleId: 'sch-c1', shipName: '远航 168', voyage: 'V260701',
        instructionNo: '4545', status: 'pending', captain: '张伟', captainPhone: '13800001111'
      }),
      emptyDisp({
        id: 'dsp-p2', scheduleId: 'sch-c2', shipName: '海丰致远', voyage: 'V260702',
        instructionNo: '4546', status: 'pending', captain: '李强', captainPhone: '13900002222',
        cargoInOut: '出场', loadType: '装船'
      }),
      emptyDisp({
        id: 'dsp-b1', shipName: '远航 168', voyage: 'V260711', instructionNo: '4701', status: 'berthed',
        berth: { plan: '2026-08-09T00:00', actual: '2026-08-09T00:20', berthNo: '1#泊位', remark: '' },
        workLogs: [{ type: '靠泊', time: '2026-08-09T00:20', note: '1#泊位' }]
      }),
      emptyDisp({
        id: 'dsp-b2', shipName: '海丰致远', voyage: 'V260712', instructionNo: '4702', status: 'berthed',
        berth: { plan: '2026-08-09T08:00', actual: '2026-08-09T08:15', berthNo: '3#泊位', remark: '夜班接船' },
        workLogs: [{ type: '靠泊', time: '2026-08-09T08:15', note: '3#泊位' }]
      }),
      emptyDisp({
        id: 'dsp-w1', shipName: '远航 168', voyage: 'V260721', instructionNo: '4801', status: 'working',
        berth: { plan: '2026-08-08T06:00', actual: '2026-08-08T06:10', berthNo: '2#泊位', remark: '' },
        start: { plan: '2026-08-08T08:00', actual: '2026-08-08T08:05', berthNo: '2#泊位', cargo: '散货 / 氧化钙', cargoL1: '散货', cargoL2: '氧化钙', loadUnload: '卸船', process: '船-场', craneUp: '2#卸船机', craneDown: '2#卸船机', shorePower: true, remark: '' },
        stoppages: [{ id: 'stp-1', from: '2026-08-08T12:00', to: '2026-08-08T13:30', reason: '等货/等驳', remark: '' }],
        workLogs: [
          { type: '靠泊', time: '2026-08-08T06:10', note: '2#泊位' },
          { type: '开工', time: '2026-08-08T08:05', note: '' },
          { type: '停工', time: '2026-08-08T12:00', note: '等货/等驳' }
        ]
      }),
      emptyDisp({
        id: 'dsp-w2', shipName: '海丰致远', voyage: 'V260722', instructionNo: '4802', status: 'working',
        berth: { plan: '2026-08-08T14:00', actual: '2026-08-08T14:20', berthNo: '4#泊位', remark: '' },
        start: { plan: '2026-08-08T16:00', actual: '2026-08-08T16:10', berthNo: '4#泊位', cargo: '件杂货 / 钢材', cargoL1: '件杂货', cargoL2: '钢材', loadUnload: '装卸', process: '船-船, 船-场', craneUp: '1#卸船机', craneDown: '2#卸船机', shorePower: false, remark: '' },
        workLogs: [
          { type: '靠泊', time: '2026-08-08T14:20', note: '4#泊位' },
          { type: '开工', time: '2026-08-08T16:10', note: '' }
        ]
      }),
      emptyDisp({
        id: 'dsp-fn1', shipName: '远航 168', voyage: 'V260731', instructionNo: '4901', status: 'finished',
        berth: { plan: '2026-08-07T00:00', actual: '2026-08-07T00:00', berthNo: '1#泊位', remark: '' },
        start: { plan: '2026-08-07T00:00', actual: '2026-08-07T00:00', berthNo: '1#泊位', cargo: '散货 / 氮磷肥', cargoL1: '散货', cargoL2: '氮磷肥', loadUnload: '装卸', process: '船-船, 船-场', craneUp: '1#装船机', craneDown: '1#装船机', shorePower: true, remark: '' },
        finish: { plan: '2026-08-07T18:00', actual: '2026-08-07T18:30', berthNo: '1#泊位', workers: 12, qty: 8650.5, remark: '移泊后，重新作业' },
        stoppages: [{ id: 'stp-2', from: '2026-08-07T10:00', to: '2026-08-07T11:00', reason: '移泊', remark: '移至1#' }],
        workLogs: [
          { type: '靠泊', time: '2026-08-07T00:00', note: '1#泊位' },
          { type: '开工', time: '2026-08-07T00:00', note: '' },
          { type: '停工', time: '2026-08-07T10:00', note: '移泊' },
          { type: '完工', time: '2026-08-07T18:30', note: '人数 12 · 产量 8650.5 吨' }
        ]
      }),
      emptyDisp({
        id: 'dsp-fn2', shipName: '海丰致远', voyage: 'V260732', instructionNo: '4902', status: 'finished',
        berth: { plan: '2026-08-06T08:00', actual: '2026-08-06T08:10', berthNo: '5#泊位', remark: '' },
        start: { plan: '2026-08-06T09:00', actual: '2026-08-06T09:20', berthNo: '5#泊位', cargo: '件杂货 / 设备件', cargoL1: '件杂货', cargoL2: '设备件', loadUnload: '卸船', process: '船-场', craneUp: '1#门机', craneDown: '1#门机', shorePower: false, remark: '' },
        finish: { plan: '2026-08-06T20:00', actual: '2026-08-06T19:45', berthNo: '5#泊位', workers: 8, qty: 3200, remark: '' },
        workLogs: [
          { type: '靠泊', time: '2026-08-06T08:10', note: '5#泊位' },
          { type: '开工', time: '2026-08-06T09:20', note: '' },
          { type: '完工', time: '2026-08-06T19:45', note: '人数 8 · 产量 3200 吨' }
        ]
      }),
      emptyDisp({
        id: 'dsp-d1', shipName: '远航 168', voyage: 'V260741', instructionNo: '5001', status: 'departed',
        berth: { plan: '2026-08-05T00:00', actual: '2026-08-05T00:30', berthNo: '2#泊位', remark: '' },
        start: { plan: '2026-08-05T02:00', actual: '2026-08-05T02:10', berthNo: '2#泊位', cargo: '散货 / 磷矿', cargoL1: '散货', cargoL2: '磷矿', loadUnload: '卸船', process: '船-场', craneUp: '2#卸船机', craneDown: '2#卸船机', shorePower: true, remark: '' },
        finish: { plan: '2026-08-05T16:00', actual: '2026-08-05T15:40', berthNo: '2#泊位', workers: 10, qty: 11200, remark: '' },
        unberth: { plan: '2026-08-05T18:00', actual: '2026-08-05T18:20', remark: '' },
        depart: { plan: '2026-08-05T20:00', actual: '2026-08-05T20:15' },
        workLogs: [
          { type: '靠泊', time: '2026-08-05T00:30', note: '2#泊位' },
          { type: '开工', time: '2026-08-05T02:10', note: '' },
          { type: '完工', time: '2026-08-05T15:40', note: '人数 10 · 产量 11200 吨' },
          { type: '离泊', time: '2026-08-05T18:20', note: '' }
        ]
      }),
      emptyDisp({
        id: 'dsp-d2', shipName: '海丰致远', voyage: 'V260742', instructionNo: '5002', status: 'departed',
        berth: { plan: '2026-08-04T10:00', actual: '2026-08-04T10:20', berthNo: '4#泊位', remark: '' },
        start: { plan: '2026-08-04T12:00', actual: '2026-08-04T12:05', berthNo: '4#泊位', cargo: '集装箱 / 20尺标箱', cargoL1: '集装箱', cargoL2: '20尺标箱', loadUnload: '装船', process: '船-船', craneUp: '1#卸船机', craneDown: '2#卸船机', shorePower: false, remark: '' },
        finish: { plan: '2026-08-04T22:00', actual: '2026-08-04T21:50', berthNo: '4#泊位', workers: 6, qty: 1860, remark: '' },
        unberth: { plan: '2026-08-05T06:00', actual: '2026-08-05T06:30', remark: '候潮离泊' },
        depart: { plan: '2026-08-05T08:00', actual: '2026-08-05T08:10' },
        workLogs: [
          { type: '靠泊', time: '2026-08-04T10:20', note: '4#泊位' },
          { type: '开工', time: '2026-08-04T12:05', note: '' },
          { type: '完工', time: '2026-08-04T21:50', note: '人数 6 · 产量 1860 吨' },
          { type: '离泊', time: '2026-08-05T06:30', note: '候潮离泊' }
        ]
      }),
      emptyDisp({
        id: 'dsp-v1', shipName: '远航 168', voyage: 'V260751', instructionNo: '5101', status: 'void',
        berth: { plan: '', actual: '', berthNo: '', remark: '调度取消' }
      }),
      emptyDisp({
        id: 'dsp-v2', shipName: '海丰致远', voyage: 'V260752', instructionNo: '5102', status: 'void'
      })
    ];

    return { schedules: schedules, dispatches: dispatches };
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (p && Array.isArray(p.schedules) && Array.isArray(p.dispatches) && p.schedules.length) return p;
      }
    } catch (e) {}
    var s = seedState();
    save(s);
    return s;
  }

  function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  function ships() {
    if (global.ShipArchiveDemo && ShipArchiveDemo.listActiveShips) return ShipArchiveDemo.listActiveShips();
    return [];
  }

  function machines() {
    if (global.DeviceDemo && DeviceDemo.listEnabledDevices) {
      return DeviceDemo.listEnabledDevices().map(function (d) { return d.name; });
    }
    return ['1#卸船机', '2#卸船机', '1#门机'];
  }

  /* —— 船期 —— */
  function listSchedules(tab) {
    var list = load().schedules;
    if (tab === 'forecast') return clone(list.filter(function (x) { return x.status === 'forecast'; }));
    if (tab === 'confirmed') return clone(list.filter(function (x) { return x.status === 'confirmed'; }));
    if (tab === 'void') return clone(list.filter(function (x) { return x.status === 'void'; }));
    return clone(list);
  }

  function getSchedule(id) {
    var list = load().schedules;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return clone(list[i]);
    return null;
  }

  function createForecast(row) {
    var shipName = String(row.shipName || '').trim();
    if (!shipName) return { ok: false, msg: '请选择船舶' };
    var state = load();
    var voyage = String(row.voyage || '').trim() || ('V' + Date.now().toString().slice(-6));
    var item = {
      id: uid('sch'),
      shipId: row.shipId || '',
      shipName: shipName,
      voyage: voyage,
      eta: row.eta || '',
      etd: row.etd || '',
      cargoInOut: row.cargoInOut || '',
      loadType: row.loadType || '',
      remark: row.remark || '',
      captain: row.captain || '',
      captainPhone: row.captainPhone || '',
      instructionNo: row.instructionNo || '',
      workMode: row.workMode || '',
      status: 'forecast',
      createdAt: nowLocal()
    };
    state.schedules.unshift(item);
    save(state);
    return { ok: true, item: item };
  }

  function updateForecast(id, row) {
    var state = load();
    var idx = -1;
    for (var i = 0; i < state.schedules.length; i++) if (state.schedules[i].id === id) { idx = i; break; }
    if (idx < 0) return { ok: false, msg: '船期不存在' };
    var cur = state.schedules[idx];
    if (cur.status === 'void') return { ok: false, msg: '已作废不可编辑' };
    /* 船次、船名不可改 */
    cur.eta = row.eta != null ? row.eta : cur.eta;
    cur.etd = row.etd != null ? row.etd : cur.etd;
    cur.cargoInOut = row.cargoInOut != null ? row.cargoInOut : cur.cargoInOut;
    cur.loadType = row.loadType != null ? row.loadType : cur.loadType;
    cur.remark = row.remark != null ? row.remark : cur.remark;
    cur.captain = row.captain != null ? row.captain : cur.captain;
    cur.captainPhone = row.captainPhone != null ? row.captainPhone : cur.captainPhone;
    cur.instructionNo = row.instructionNo != null ? row.instructionNo : cur.instructionNo;
    cur.workMode = row.workMode != null ? row.workMode : cur.workMode;
    save(state);
    return { ok: true, item: clone(cur) };
  }

  function confirmSchedule(id) {
    var state = load();
    var sch = null;
    for (var i = 0; i < state.schedules.length; i++) {
      if (state.schedules[i].id === id) { sch = state.schedules[i]; break; }
    }
    if (!sch) return { ok: false, msg: '船期不存在' };
    if (sch.status !== 'forecast') return { ok: false, msg: '仅预报可确报' };
    sch.status = 'confirmed';
    /* 生成调度未入港 */
    var exists = state.dispatches.some(function (d) { return d.scheduleId === id && d.status !== 'void'; });
    if (!exists) {
      state.dispatches.unshift({
        id: uid('dsp'),
        scheduleId: sch.id,
        shipName: sch.shipName,
        voyage: sch.voyage,
        instructionNo: sch.instructionNo || sch.voyage,
        captain: sch.captain || '',
        captainPhone: sch.captainPhone || '',
        cargoInOut: sch.cargoInOut || '进场',
        loadType: sch.loadType || '装卸',
        workMode: sch.workMode || '',
        status: 'pending',
        berth: { plan: '', actual: '', berthNo: '', remark: '' },
        start: { plan: '', actual: '', berthNo: '', cargo: '', cargoL1: '', cargoL2: '', loadUnload: '', process: '', craneUp: '', craneDown: '', shorePower: false, remark: '' },
        finish: { plan: '', actual: '', berthNo: '', workers: null, qty: null, remark: '' },
        unberth: { plan: '', actual: '', remark: '' },
        depart: { plan: '', actual: '' },
        stoppages: [],
        workLogs: []
      });
    }
    save(state);
    return { ok: true };
  }

  function voidSchedule(id) {
    var state = load();
    for (var i = 0; i < state.schedules.length; i++) {
      if (state.schedules[i].id === id) {
        state.schedules[i].status = 'void';
        /* 关联未开始的调度一并作废 */
        state.dispatches.forEach(function (d) {
          if (d.scheduleId === id && d.status === 'pending') d.status = 'void';
        });
        save(state);
        return { ok: true };
      }
    }
    return { ok: false, msg: '船期不存在' };
  }

  /* —— 调度 —— */
  function listDispatches(tab) {
    var list = load().dispatches;
    var map = {
      pending: 'pending',
      berthed: 'berthed',
      working: 'working',
      finished: 'finished',
      departed: 'departed',
      void: 'void'
    };
    if (tab && map[tab]) return clone(list.filter(function (x) { return x.status === map[tab]; }));
    return clone(list);
  }

  function getDispatch(id) {
    var list = load().dispatches;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return clone(list[i]);
    return null;
  }

  function findD(state, id) {
    for (var i = 0; i < state.dispatches.length; i++) if (state.dispatches[i].id === id) return state.dispatches[i];
    return null;
  }

  function requireOperator(row) {
    var deptId = String(row.deptId || '').trim();
    var deptName = String(row.deptName || '').trim();
    var userId = String(row.userId || '').trim();
    var userName = String(row.userName || '').trim();
    if (!deptId || !deptName) return { ok: false, msg: '请选择操作部门' };
    if (!userId || !userName) return { ok: false, msg: '请选择操作人员' };
    return {
      ok: true,
      op: { deptId: deptId, deptName: deptName, userId: userId, userName: userName }
    };
  }

  function applyOp(target, op) {
    target.deptId = op.deptId;
    target.deptName = op.deptName;
    target.userId = op.userId;
    target.userName = op.userName;
  }

  function logNote(base, op) {
    var prefix = op.deptName + ' · ' + op.userName;
    return base ? (prefix + ' · ' + base) : prefix;
  }

  function doBerth(id, row) {
    var state = load();
    var d = findD(state, id);
    if (!d || d.status !== 'pending') return { ok: false, msg: '仅未入港可靠泊' };
    var t = String(row.actual || '').trim();
    if (!t) return { ok: false, msg: '请填写靠泊时间' };
    if (!String(row.berthNo || '').trim()) return { ok: false, msg: '请选择作业泊位' };
    var opChk = requireOperator(row);
    if (!opChk.ok) return opChk;
    d.berth.actual = t;
    d.berth.plan = row.plan || t;
    d.berth.berthNo = row.berthNo || '';
    d.berth.remark = row.remark || '';
    applyOp(d.berth, opChk.op);
    d.status = 'berthed';
    d.workLogs.push({
      type: '靠泊', time: t, note: logNote(d.berth.berthNo || '', opChk.op),
      deptName: opChk.op.deptName, userName: opChk.op.userName
    });
    save(state);
    return { ok: true };
  }

  function doStart(id, row) {
    var state = load();
    var d = findD(state, id);
    if (!d || d.status !== 'berthed') return { ok: false, msg: '仅靠泊状态可开工' };
    var t = String(row.actual || '').trim();
    if (!t) return { ok: false, msg: '请填写开工时间' };
    if (!String(row.berthNo || '').trim()) return { ok: false, msg: '请选择作业泊位' };
    if (!String(row.cargoL2 || row.cargo || '').trim()) return { ok: false, msg: '请选择货种二级（子集）' };
    var opChk = requireOperator(row);
    if (!opChk.ok) return opChk;
    d.start.actual = t;
    d.start.plan = row.plan || t;
    d.start.berthNo = row.berthNo || d.berth.berthNo || '';
    d.start.cargoL1 = row.cargoL1 || '';
    d.start.cargoL2 = row.cargoL2 || '';
    d.start.cargo = row.cargo || (d.start.cargoL1 && d.start.cargoL2
      ? (d.start.cargoL1 + ' / ' + d.start.cargoL2)
      : (d.start.cargoL2 || d.start.cargoL1 || ''));
    d.start.loadUnload = row.loadUnload || '';
    d.start.process = row.process || '';
    d.start.craneUp = row.craneUp || '';
    d.start.craneDown = row.craneDown || '';
    d.start.shorePower = !!row.shorePower;
    d.start.remark = row.remark || '';
    applyOp(d.start, opChk.op);
    if (row.workMode) d.workMode = row.workMode;
    d.status = 'working';
    d.workLogs.push({
      type: '开工', time: t, note: logNote(d.start.remark || '', opChk.op),
      deptName: opChk.op.deptName, userName: opChk.op.userName
    });
    save(state);
    return { ok: true };
  }

  function doFinish(id, row) {
    var state = load();
    var d = findD(state, id);
    if (!d || d.status !== 'working') return { ok: false, msg: '仅开工状态可完工' };
    var t = String(row.actual || '').trim() || nowLocal();
    var workers = null;
    if (row.workers !== '' && row.workers != null) {
      workers = Number(row.workers);
      if (isNaN(workers) || workers < 0) return { ok: false, msg: '作业人数须为不小于 0 的数字' };
    }
    var qty = Number(row.qty);
    if (row.qty === '' || row.qty == null || isNaN(qty) || qty < 0) {
      return { ok: false, msg: '请填写产量（吨）' };
    }
    var opChk = requireOperator(row);
    if (!opChk.ok) return opChk;
    d.finish.actual = t;
    d.finish.plan = row.plan || t;
    d.finish.berthNo = row.berthNo || d.start.berthNo || d.berth.berthNo || '';
    d.finish.workers = workers;
    d.finish.qty = qty;
    d.finish.remark = row.remark || '';
    applyOp(d.finish, opChk.op);
    d.status = 'finished';
    d.workLogs.push({
      type: '完工', time: t,
      note: logNote((workers != null ? ('人数 ' + workers + ' · ') : '') + '产量 ' + qty + ' 吨', opChk.op),
      deptName: opChk.op.deptName, userName: opChk.op.userName
    });
    save(state);
    return { ok: true };
  }

  var FIELD_OP = {
    deptId: 'wecom', deptName: '企微现场', userId: 'wecom-op', userName: '现场录入'
  };

  function resolveOperator(row) {
    row = row || {};
    if (row.source === 'h5_live' || row.skipOperator) {
      return { ok: true, op: FIELD_OP };
    }
    return requireOperator(row);
  }

  function findActiveStoppage(d) {
    var list = (d && d.stoppages) || [];
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      if (s.status === 'active' || (s.from && !s.to)) return s;
    }
    return null;
  }

  function addStoppage(id, row) {
    var state = load();
    var d = findD(state, id);
    if (!d || (d.status !== 'working' && d.status !== 'finished')) {
      return { ok: false, msg: '仅开工/完工状态可登记停工' };
    }
    var from = String(row.from || '').trim();
    var to = String(row.to || '').trim();
    var reason = String(row.reason || '').trim();
    if (!from || !to) return { ok: false, msg: '请填写停工开始与结束时间' };
    if (!reason) return { ok: false, msg: '请选择停工原因' };
    if (new Date(from) > new Date(to)) return { ok: false, msg: '停工结束时间须不早于开始时间' };
    var opChk = resolveOperator(row);
    if (!opChk.ok) return opChk;
    var stop = {
      id: uid('stp'), from: from, to: to, reason: reason, remark: row.remark || '',
      status: 'ended', source: row.source || 'dispatch'
    };
    applyOp(stop, opChk.op);
    d.stoppages.push(stop);
    d.stopping = !!findActiveStoppage(d);
    d.workLogs.push({
      type: '停工', time: from, note: logNote(reason + (row.remark ? ' · ' + row.remark : ''), opChk.op),
      deptName: opChk.op.deptName, userName: opChk.op.userName
    });
    save(state);
    return { ok: true, stop: stop };
  }

  function startStoppageLive(id, row) {
    row = row || {};
    var state = load();
    var d = findD(state, id);
    if (!d || d.status !== 'working') {
      return { ok: false, msg: '仅「开工」船舶可登记停工' };
    }
    if (findActiveStoppage(d)) {
      return { ok: false, msg: '该船已在停工中' };
    }
    var reason = String(row.reason || '').trim();
    if (!reason) return { ok: false, msg: '请选择停工原因' };
    var from = String(row.from || '').trim() || nowLocal();
    var opChk = resolveOperator(Object.assign({}, row, { source: 'h5_live' }));
    if (!opChk.ok) return opChk;
    var stop = {
      id: uid('stp'),
      from: from,
      to: '',
      status: 'active',
      reason: reason,
      remark: row.remark || '',
      source: 'h5_live',
      startedAtMs: row.startedAtMs || Date.now()
    };
    applyOp(stop, opChk.op);
    d.stoppages.push(stop);
    d.stopping = true;
    d.workLogs.push({
      type: '停工开始', time: from, note: logNote(reason + '（现场计时）', opChk.op),
      deptName: opChk.op.deptName, userName: opChk.op.userName
    });
    save(state);
    return { ok: true, stop: stop, dispatch: d };
  }

  function endStoppageLive(id, row) {
    row = row || {};
    var state = load();
    var d = findD(state, id);
    if (!d) return { ok: false, msg: '调度单不存在' };
    var active = null;
    if (row.stoppageId) {
      var list = d.stoppages || [];
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === row.stoppageId && (list[i].status === 'active' || !list[i].to)) {
          active = list[i];
          break;
        }
      }
    }
    if (!active) active = findActiveStoppage(d);
    if (!active) return { ok: false, msg: '该船当前未在停工' };
    var to = String(row.to || '').trim() || nowLocal();
    if (to <= active.from) {
      var t2 = new Date(new Date(active.from.replace('T', ' ')).getTime() + 60000);
      var pad = function (n) { return (n < 10 ? '0' : '') + n; };
      to = t2.getFullYear() + '-' + pad(t2.getMonth() + 1) + '-' + pad(t2.getDate()) + 'T' +
        pad(t2.getHours()) + ':' + pad(t2.getMinutes());
    }
    if (row.reason) active.reason = String(row.reason).trim();
    active.to = to;
    active.status = 'ended';
    if (row.remark != null) active.remark = String(row.remark);
    d.stopping = !!findActiveStoppage(d);
    d.workLogs.push({
      type: '停工结束', time: to,
      note: logNote(active.reason + (active.remark ? ' · ' + active.remark : ''), {
        deptName: active.deptName || FIELD_OP.deptName,
        userName: active.userName || FIELD_OP.userName
      }),
      deptName: active.deptName || FIELD_OP.deptName,
      userName: active.userName || FIELD_OP.userName
    });
    save(state);
    return { ok: true, stop: active, dispatch: d };
  }

  function updateStoppage(dispatchId, stoppageId, row) {
    row = row || {};
    var state = load();
    var d = findD(state, dispatchId);
    if (!d) return { ok: false, msg: '调度单不存在' };
    var stop = null;
    for (var i = 0; i < (d.stoppages || []).length; i++) {
      if (d.stoppages[i].id === stoppageId) { stop = d.stoppages[i]; break; }
    }
    if (!stop) return { ok: false, msg: '停工记录不存在' };
    if (stop.status === 'active' || !stop.to) {
      return { ok: false, msg: '进行中停工请先「结束停工」' };
    }
    var from = String(row.from != null ? row.from : stop.from).trim();
    var to = String(row.to != null ? row.to : stop.to).trim();
    var reason = String(row.reason != null ? row.reason : stop.reason).trim();
    var remark = row.remark != null ? String(row.remark) : (stop.remark || '');
    if (!from || !to) return { ok: false, msg: '请填写开始与结束时间' };
    if (!reason) return { ok: false, msg: '请选择停工类型' };
    if (new Date(to) <= new Date(from)) return { ok: false, msg: '结束时间须晚于开始时间' };
    stop.from = from;
    stop.to = to;
    stop.reason = reason;
    stop.remark = remark;
    stop.status = 'ended';
    d.workLogs.push({
      type: '停工修订', time: nowLocal(),
      note: logNote(reason + ' · ' + from + ' ~ ' + to + (remark ? ' · ' + remark : ''), FIELD_OP),
      deptName: FIELD_OP.deptName,
      userName: FIELD_OP.userName
    });
    save(state);
    return { ok: true, stop: stop, dispatch: d };
  }

  function listStoppages(filter) {
    filter = filter || {};
    var state = load();
    var out = [];
    state.dispatches.forEach(function (d) {
      (d.stoppages || []).forEach(function (s) {
        var date = String(s.from || '').slice(0, 10);
        if (filter.date && date !== filter.date) return;
        if (filter.vesselName && String(d.shipName) !== String(filter.vesselName)) return;
        if (filter.dispatchId && d.id !== filter.dispatchId) return;
        if (filter.endedOnly && s.status === 'active') return;
        out.push({
          id: s.id,
          dispatchId: d.id,
          shipName: d.shipName,
          voyage: d.voyage || '',
          date: date,
          from: s.from,
          to: s.to || '',
          status: s.status || (s.to ? 'ended' : 'active'),
          reason: s.reason || '',
          remark: s.remark || '',
          source: s.source || 'dispatch',
          stopping: !!d.stopping
        });
      });
    });
    out.sort(function (a, b) {
      if (a.from === b.from) return 0;
      return a.from < b.from ? 1 : -1;
    });
    return out;
  }

  function getActiveStoppageByDispatch(id) {
    var state = load();
    var d = findD(state, id);
    if (!d) return null;
    var s = findActiveStoppage(d);
    if (!s) return null;
    return {
      id: s.id,
      dispatchId: d.id,
      shipName: d.shipName,
      from: s.from,
      to: '',
      status: 'active',
      reason: s.reason,
      remark: s.remark || '',
      startedAtMs: s.startedAtMs || null
    };
  }

  function doUnberth(id, row) {
    var state = load();
    var d = findD(state, id);
    if (!d || d.status !== 'finished') return { ok: false, msg: '仅完工后可离泊' };
    var t = String(row.actual || '').trim();
    if (!t) return { ok: false, msg: '请填写离泊时间' };
    var opChk = requireOperator(row);
    if (!opChk.ok) return opChk;
    d.unberth.actual = t;
    d.unberth.plan = row.plan || t;
    d.unberth.remark = row.remark || '';
    applyOp(d.unberth, opChk.op);
    d.depart.actual = row.departActual || t;
    d.depart.plan = row.departPlan || t;
    d.status = 'departed';
    d.workLogs.push({
      type: '离泊', time: t, note: logNote(d.unberth.remark || '', opChk.op),
      deptName: opChk.op.deptName, userName: opChk.op.userName
    });
    save(state);
    return { ok: true };
  }

  function voidDispatch(id, row) {
    var state = load();
    var d = findD(state, id);
    if (!d) return { ok: false, msg: '调度单不存在' };
    row = row || {};
    var opChk = requireOperator(row);
    if (!opChk.ok) return opChk;
    d.status = 'void';
    d.voidInfo = {
      at: nowLocal(),
      remark: row.remark || '',
      deptId: opChk.op.deptId,
      deptName: opChk.op.deptName,
      userId: opChk.op.userId,
      userName: opChk.op.userName
    };
    d.workLogs.push({
      type: '作废', time: d.voidInfo.at, note: logNote(d.voidInfo.remark || '', opChk.op),
      deptName: opChk.op.deptName, userName: opChk.op.userName
    });
    save(state);
    return { ok: true };
  }

  function resetDemo() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    save(seedState());
  }

  function todayDate() {
    return String(nowLocal() || '').slice(0, 10);
  }

  function isDemoStoppageId(id) {
    return String(id || '').indexOf('stp-demo-') === 0;
  }

  function stripDemoStoppages(state) {
    (state.dispatches || []).forEach(function (d) {
      d.stoppages = (d.stoppages || []).filter(function (s) { return !isDemoStoppageId(s.id); });
      d.stopping = !!findActiveStoppage(d);
    });
  }

  function pickDemoDispatch(state, preferId, fallbackIdx) {
    var hit = preferId ? findD(state, preferId) : null;
    if (hit) return hit;
    var working = (state.dispatches || []).filter(function (d) { return d.status === 'working'; });
    if (working[fallbackIdx]) return working[fallbackIdx];
    if (working[0]) return working[0];
    return (state.dispatches || [])[fallbackIdx] || (state.dispatches || [])[0] || null;
  }

  /**
   * PC 停工台账案例：写入今日「进行中 + 已结束」样例
   * opts.force=true 时先清掉旧案例 id 再写入（不删用户真实停工）
   */
  function ensurePcStoppageDemo(opts) {
    opts = opts || {};
    var state = load();
    var t = todayDate();
    if (!t) return { ok: false, msg: '日期无效' };

    if (opts.force) {
      stripDemoStoppages(state);
    } else {
      var hasToday = false;
      state.dispatches.forEach(function (d) {
        (d.stoppages || []).forEach(function (s) {
          if (String(s.from || '').slice(0, 10) === t) hasToday = true;
        });
      });
      if (hasToday) return { ok: true, seeded: false, date: t };
    }

    if (!(state.dispatches && state.dispatches.length)) {
      state = seedState();
    }

    var w1 = pickDemoDispatch(state, 'dsp-w1', 0);
    var w2 = pickDemoDispatch(state, 'dsp-w2', 1);
    if (!w1) {
      state = seedState();
      save(state);
      state = load();
      w1 = pickDemoDispatch(state, 'dsp-w1', 0);
      w2 = pickDemoDispatch(state, 'dsp-w2', 1);
    }
    if (!w1) return { ok: false, msg: '无可用调度单', seeded: false };
    if (w2 && w2.id === w1.id) w2 = null;
    var activeTarget = w2 || w1;

    // 先清两船案例，再一次性写入，避免同船二次 filter 把已结束样例删掉
    [w1, activeTarget].forEach(function (d) {
      d.stoppages = (d.stoppages || []).filter(function (s) { return !isDemoStoppageId(s.id); });
      d.stopping = !!findActiveStoppage(d);
    });

    w1.stoppages.push({
      id: 'stp-demo-ended-1',
      from: t + 'T08:10',
      to: t + 'T08:45',
      status: 'ended',
      reason: '设备异常',
      remark: '案例：白班已结束 · 35 分',
      source: 'dispatch',
      deptName: FIELD_OP.deptName,
      userName: FIELD_OP.userName
    });
    w1.stoppages.push({
      id: 'stp-demo-ended-2',
      from: t + 'T10:00',
      to: t + 'T10:25',
      status: 'ended',
      reason: '等货/等驳',
      remark: '案例：H5 计时结束 · 25 分',
      source: 'h5_live',
      deptName: '现场作业',
      userName: '李现场'
    });

    if (!findActiveStoppage(activeTarget)) {
      var liveMs = Date.now() - 22 * 60000;
      var liveFrom = (function (ms) {
        var d = new Date(ms);
        var pad = function (n) { return (n < 10 ? '0' : '') + n; };
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' +
          pad(d.getHours()) + ':' + pad(d.getMinutes());
      })(liveMs);
      activeTarget.stoppages.push({
        id: 'stp-demo-active',
        from: liveFrom,
        to: '',
        status: 'active',
        reason: '避让大船',
        remark: '案例：H5 现场计时中',
        source: 'h5_live',
        startedAtMs: liveMs,
        deptName: '现场作业',
        userName: '李现场'
      });
    }
    activeTarget.stopping = !!findActiveStoppage(activeTarget);
    w1.stopping = !!findActiveStoppage(w1);

    save(state);
    return { ok: true, seeded: true, date: t, ships: [w1.shipName, activeTarget.shipName] };
  }

  global.ShipOpsDemo = {
    STOP_REASONS: STOP_REASONS,
    CARGO_OPTS: CARGO_OPTS,
    LOAD_OPTS: LOAD_OPTS,
    PROCESS_OPTS: PROCESS_OPTS,
    BERTH_OPTS: BERTH_OPTS,
    nowLocal: nowLocal,
    ships: ships,
    machines: machines,
    listSchedules: listSchedules,
    getSchedule: getSchedule,
    createForecast: createForecast,
    updateForecast: updateForecast,
    confirmSchedule: confirmSchedule,
    voidSchedule: voidSchedule,
    listDispatches: listDispatches,
    getDispatch: getDispatch,
    doBerth: doBerth,
    doStart: doStart,
    doFinish: doFinish,
    addStoppage: addStoppage,
    startStoppageLive: startStoppageLive,
    endStoppageLive: endStoppageLive,
    updateStoppage: updateStoppage,
    listStoppages: listStoppages,
    getActiveStoppageByDispatch: getActiveStoppageByDispatch,
    findActiveStoppage: findActiveStoppage,
    doUnberth: doUnberth,
    voidDispatch: voidDispatch,
    resetDemo: resetDemo,
    ensurePcStoppageDemo: ensurePcStoppageDemo
  };
})(window);
