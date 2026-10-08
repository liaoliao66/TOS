/**
 * PC 工班作业：开班日+班次 聚合；其下多张「泊位×机械×司机×货种」大表
 */
(function (global) {
  var STORE_KEY = 'tosWorkStatSheets_v6';
  var ACTIVE_KEY = 'tosWorkStatActive_v2';

  var BERTH_MACHINES = {
    '1#泊位': ['1#卸船机'],
    '2#泊位': ['1#门机', '2#门机'],
    '3#泊位': ['3#门机', '4#门机'],
    '4#泊位': ['2#卸船机', '5#门机'],
    '5#泊位': ['1#门机'],
    '6#泊位': ['2#门机']
  };

  var DRIVERS = ['涂峰', '陈迪政', '刘志显', '雷雨', '柯力', '刘念', '胡涛', '聂星宇', '李军民', '杨湘岳', '刘显伟'];

  var DAY_SLOTS = [
    '08:00-09:00', '09:00-10:00', '10:00-11:00', '11:00-12:00',
    '12:00-13:00', '13:00-14:00', '14:00-15:00', '15:00-16:00',
    '16:00-17:00', '17:00-18:00', '18:00-19:00', '19:00-20:00'
  ];

  var NIGHT_SLOTS = [
    '20:00-21:00', '21:00-22:00', '22:00-23:00', '23:00-00:00',
    '00:00-01:00', '01:00-02:00', '02:00-03:00', '03:00-04:00',
    '04:00-05:00', '05:00-06:00', '06:00-07:00', '07:00-08:00'
  ];

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function addDays(iso, delta) {
    var p = iso.split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    d.setDate(d.getDate() + delta);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  /** 当天 + 前一天（共 2 天）：min=今天-1，max=今天；支持补录昨天 */
  function dateRange() {
    var to = todayStr();
    return { from: addDays(to, -1), to: to };
  }

  function slotsForShift(shift) {
    return shift === '夜班' ? NIGHT_SLOTS.slice() : DAY_SLOTS.slice();
  }

  function uid() {
    return 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function loadAll() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return seedDemo();
  }

  function saveAll(data) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  function emptyRows(shift, defaults) {
    defaults = defaults || {};
    return slotsForShift(shift).map(function (slot) {
      return {
        slot: slot,
        driver: defaults.driver || '',
        cargoL1: defaults.cargoL1 || '',
        cargoL2: defaults.cargoL2 || '',
        vesselId: '',
        vesselName: '',
        qty: 0,
        normal: true,
        reason: '',
        abMins: null,
        abTime: '',
        abFrom: '',
        abTo: '',
        remark: '',
        wecomSent: false,
        wecomSentAt: ''
      };
    });
  }

  function rowHasVesselOverride(r) {
    return !!(r && (r.vesselId || r.vesselName));
  }

  function resolveVessel(unit, row) {
    if (row && rowHasVesselOverride(row)) {
      return { id: row.vesselId || '', name: row.vesselName || '' };
    }
    return {
      id: (unit && unit.vesselId) || '',
      name: (unit && unit.vesselName) || ''
    };
  }

  /** 兼容旧行：补齐司机/货种/推送标记 */
  function normalizeRow(r, unit) {
    if (!r) return r;
    if (!r.driver) r.driver = (unit && unit.driver) || '';
    if (!r.cargoL1) r.cargoL1 = (unit && unit.cargoL1) || '';
    if (!r.cargoL2) r.cargoL2 = (unit && unit.cargoL2) || (unit && unit.cargo) || '';
    if (typeof r.wecomSent !== 'boolean') r.wecomSent = false;
    if (!r.wecomSentAt) r.wecomSentAt = '';
    if (r.vesselId == null) r.vesselId = '';
    if (r.vesselName == null) r.vesselName = '';
    return r;
  }

  function normalizeUnit(unit) {
    if (!unit) return unit;
    if (unit.vesselId == null) unit.vesselId = '';
    if (unit.vesselName == null) unit.vesselName = '';
    (unit.rows || []).forEach(function (r) { normalizeRow(r, unit); });
    return unit;
  }

  function unitKey(u) {
    return [u.berth, u.machine, u.driver, u.cargoL2 || u.cargo, u.vesselName || ''].join('\0');
  }

  function sheetKey(date, shift) {
    return date + '\0' + shift;
  }

  function findSheet(data, date, shift) {
    for (var i = 0; i < data.sheets.length; i++) {
      var s = data.sheets[i];
      if (s.date === date && s.shift === shift) return s;
    }
    return null;
  }

  function unitTotal(unit) {
    return (unit.rows || []).reduce(function (s, r) { return s + (Number(r.qty) || 0); }, 0);
  }

  function sheetTotal(sheet) {
    return (sheet.units || []).reduce(function (s, u) { return s + unitTotal(u); }, 0);
  }

  function seedDemo() {
    var t = todayStr();
    var y = addDays(t, -1);
    var data = { sheets: [] };

    var daySheet = {
      id: 's_demo_day',
      date: t,
      shift: '白班',
      status: '草稿',
      updater: '张录入',
      updatedAt: t + ' 10:20',
      units: []
    };
    var u1 = {
      id: 'u_demo_5',
      berth: '5#泊位',
      machine: '1#门机',
      driver: '涂峰',
      cargoL1: '散货',
      cargoL2: '氧化钙',
      vesselId: 's1',
      vesselName: '远航 168',
      rows: emptyRows('白班', { driver: '涂峰', cargoL1: '散货', cargoL2: '氧化钙' })
    };
    var demoQty = [72, 108, 144, 0, 0, 96, 120, 0, 88, 100, 110, 0];
    var demoRemark = [
      '', '', '', '交接班，等车', '车辆跟不上', '', '', '吃饭休息', '', '', '', '避高温，暂停作业'
    ];
    u1.rows.forEach(function (r, i) {
      r.qty = demoQty[i];
      r.remark = demoRemark[i];
      if (demoQty[i] === 0 && demoRemark[i]) {
        r.normal = false;
        r.reason = demoRemark[i].indexOf('吃饭') >= 0 ? '吃饭休息'
          : (demoRemark[i].indexOf('高温') >= 0 ? '避高温，暂停作业'
            : (demoRemark[i].indexOf('交接') >= 0 ? '交接班' : '车辆断档'));
        r.abMins = 30;
      }
    });
    daySheet.units.push(u1);

    var nightSheet = {
      id: 's_demo_night',
      date: y,
      shift: '夜班',
      status: '审批中',
      updater: '李录入',
      updatedAt: t + ' 08:05',
      units: [{
        id: 'u_demo_6',
        berth: '6#泊位',
        machine: '2#门机',
        driver: '陈迪政',
        cargoL1: '吨包袋',
        cargoL2: '吨包',
        vesselId: 's2',
        vesselName: '海丰致远',
        rows: emptyRows('夜班', { driver: '陈迪政', cargoL1: '吨包袋', cargoL2: '吨包' }).map(function (r, i) {
          r.qty = i % 3 === 0 ? 0 : 80 + i * 3;
          if (r.qty === 0) {
            r.normal = false;
            r.reason = '吃饭休息';
            r.remark = '吃饭休息';
            r.abMins = 30;
          }
          return r;
        })
      }]
    };

    data.sheets.push(daySheet, nightSheet);
    saveAll(data);
    return data;
  }

  function listSheets() {
    return loadAll().sheets.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      if (a.shift === b.shift) return 0;
      return a.shift === '白班' ? -1 : 1;
    }).map(function (s) {
      (s.units || []).forEach(normalizeUnit);
      return s;
    });
  }

  function getSheet(date, shift) {
    var s = findSheet(loadAll(), date, shift);
    if (s) (s.units || []).forEach(normalizeUnit);
    return s;
  }

  function ensureSheet(date, shift) {
    var data = loadAll();
    var s = findSheet(data, date, shift);
    if (s) return s;
    s = {
      id: uid(),
      date: date,
      shift: shift,
      status: '草稿',
      updater: '张录入',
      updatedAt: todayStr() + ' ' + pad2(new Date().getHours()) + ':' + pad2(new Date().getMinutes()),
      units: []
    };
    data.sheets.unshift(s);
    saveAll(data);
    return s;
  }

  function createUnit(opts) {
    var range = dateRange();
    if (!opts.date || opts.date < range.from || opts.date > range.to) {
      return { ok: false, msg: '开班日仅可选当天或前一天' };
    }
    if (opts.shift !== '白班' && opts.shift !== '夜班') {
      return { ok: false, msg: '请选择班次' };
    }
    if (!opts.berth || !opts.machine || !opts.driver || !opts.cargoL2) {
      return { ok: false, msg: '请完整选择泊位、机械、司机、货种' };
    }
    if (!opts.vesselId || !opts.vesselName) {
      return { ok: false, msg: '请选择船舶' };
    }
    var data = loadAll();
    var sheet = findSheet(data, opts.date, opts.shift);
    if (!sheet) {
      sheet = {
        id: uid(),
        date: opts.date,
        shift: opts.shift,
        status: '草稿',
        updater: '张录入',
        updatedAt: todayStr() + ' ' + pad2(new Date().getHours()) + ':' + pad2(new Date().getMinutes()),
        units: []
      };
      data.sheets.unshift(sheet);
    }
    if (sheet.status === '审批中' || sheet.status === '已通过') {
      return { ok: false, msg: '该班次已提交或已通过，不可再新增填报' };
    }
    var dup = (sheet.units || []).some(function (u) {
      return unitKey(u) === unitKey({
        berth: opts.berth,
        machine: opts.machine,
        driver: opts.driver,
        cargoL2: opts.cargoL2,
        vesselName: opts.vesselName
      });
    });
    if (dup) {
      return { ok: false, msg: '同一开班日+班次下，该泊位/机械/司机/货种/船舶已存在，请直接打开', existing: true };
    }
    var unit = {
      id: uid(),
      berth: opts.berth,
      machine: opts.machine,
      driver: opts.driver,
      cargoL1: opts.cargoL1 || '',
      cargoL2: opts.cargoL2,
      vesselId: opts.vesselId,
      vesselName: opts.vesselName,
      rows: emptyRows(opts.shift, {
        driver: opts.driver,
        cargoL1: opts.cargoL1 || '',
        cargoL2: opts.cargoL2
      })
    };
    sheet.units.push(unit);
    sheet.updater = '张录入';
    sheet.updatedAt = todayStr() + ' ' + pad2(new Date().getHours()) + ':' + pad2(new Date().getMinutes());
    if (sheet.status === '已驳回') sheet.status = '草稿';
    saveAll(data);
    setActive({ date: opts.date, shift: opts.shift, unitId: unit.id });
    return { ok: true, sheet: sheet, unit: unit };
  }

  function unitHasSentRows(unit) {
    return (unit.rows || []).some(function (r) { return !!r.wecomSent; });
  }

  /** 编辑机台表：可改司机/货种；泊位机械不可改；同步未推送行 */
  function updateUnit(date, shift, unitId, patch) {
    var data = loadAll();
    var sheet = findSheet(data, date, shift);
    if (!sheet) return { ok: false, msg: '单据不存在' };
    if (sheet.status === '审批中' || sheet.status === '已通过') {
      return { ok: false, msg: '当前班次状态不可编辑机台表' };
    }
    var unit = null;
    var unitIdx = -1;
    for (var i = 0; i < sheet.units.length; i++) {
      if (sheet.units[i].id === unitId) { unit = sheet.units[i]; unitIdx = i; break; }
    }
    if (!unit) return { ok: false, msg: '机台表不存在' };
    normalizeUnit(unit);
    if (!patch.driver || !patch.cargoL2) {
      return { ok: false, msg: '请完整选择司机与货种' };
    }
    var candidate = {
      berth: unit.berth,
      machine: unit.machine,
      driver: patch.driver,
      cargoL2: patch.cargoL2,
      vesselName: patch.vesselName != null ? patch.vesselName : unit.vesselName
    };
    var dup = (sheet.units || []).some(function (u, idx) {
      return idx !== unitIdx && unitKey(u) === unitKey(candidate);
    });
    if (dup) {
      return { ok: false, msg: '同一班次下该泊位/机械/司机/货种组合已存在' };
    }
    unit.driver = patch.driver;
    unit.cargoL1 = patch.cargoL1 || '';
    unit.cargoL2 = patch.cargoL2;
    if (patch.vesselId != null && patch.vesselName) {
      unit.vesselId = patch.vesselId;
      unit.vesselName = patch.vesselName;
    }
    (unit.rows || []).forEach(function (r) {
      if (!r.wecomSent) {
        r.driver = patch.driver;
        r.cargoL1 = patch.cargoL1 || '';
        r.cargoL2 = patch.cargoL2;
        if (patch.vesselId != null && patch.vesselName && !rowHasVesselOverride(r)) {
          r.vesselId = '';
          r.vesselName = '';
        }
      }
    });
    sheet.updater = '张录入';
    sheet.updatedAt = todayStr() + ' ' + pad2(new Date().getHours()) + ':' + pad2(new Date().getMinutes());
    if (sheet.status === '已驳回') sheet.status = '草稿';
    saveAll(data);
    return { ok: true, unit: unit };
  }

  /** 删除机台表：存在已推送企微行时不可删 */
  function deleteUnit(date, shift, unitId) {
    var data = loadAll();
    var sheet = findSheet(data, date, shift);
    if (!sheet) return { ok: false, msg: '单据不存在' };
    if (sheet.status === '审批中' || sheet.status === '已通过') {
      return { ok: false, msg: '当前班次状态不可删除机台表' };
    }
    var unit = null;
    var idx = -1;
    for (var i = 0; i < sheet.units.length; i++) {
      if (sheet.units[i].id === unitId) { unit = sheet.units[i]; idx = i; break; }
    }
    if (!unit) return { ok: false, msg: '机台表不存在' };
    normalizeUnit(unit);
    if (unitHasSentRows(unit)) {
      return { ok: false, msg: '该机台表含已推送企微的行，不可删除' };
    }
    sheet.units.splice(idx, 1);
    sheet.updater = '张录入';
    sheet.updatedAt = todayStr() + ' ' + pad2(new Date().getHours()) + ':' + pad2(new Date().getMinutes());
    saveAll(data);
    return { ok: true, sheet: sheet };
  }

  function saveUnitRows(date, shift, unitId, rows) {
    var data = loadAll();
    var sheet = findSheet(data, date, shift);
    if (!sheet) return { ok: false, msg: '单据不存在' };
    if (sheet.status === '审批中' || sheet.status === '已通过') {
      return { ok: false, msg: '当前状态不可编辑' };
    }
    var unit = null;
    for (var i = 0; i < sheet.units.length; i++) {
      if (sheet.units[i].id === unitId) { unit = sheet.units[i]; break; }
    }
    if (!unit) return { ok: false, msg: '填报表不存在' };
    normalizeUnit(unit);
    var bySlot = {};
    (unit.rows || []).forEach(function (r) { bySlot[r.slot] = r; });
    unit.rows = (rows || []).map(function (incoming) {
      var prev = bySlot[incoming.slot];
      if (prev && prev.wecomSent) {
        return prev;
      }
      return normalizeRow({
        slot: incoming.slot,
        driver: incoming.driver != null ? incoming.driver : (prev && prev.driver) || unit.driver,
        cargoL1: incoming.cargoL1 != null ? incoming.cargoL1 : (prev && prev.cargoL1) || unit.cargoL1,
        cargoL2: incoming.cargoL2 != null ? incoming.cargoL2 : (prev && prev.cargoL2) || unit.cargoL2,
        vesselId: prev && prev.vesselId != null ? prev.vesselId : (incoming.vesselId || ''),
        vesselName: prev && prev.vesselName != null ? prev.vesselName : (incoming.vesselName || ''),
        qty: incoming.qty,
        normal: incoming.normal,
        reason: incoming.reason || '',
        abMins: incoming.abMins,
        abTime: incoming.abTime || '',
        abFrom: incoming.abFrom || '',
        abTo: incoming.abTo || '',
        remark: incoming.remark || '',
        wecomSent: false,
        wecomSentAt: ''
      }, unit);
    });
    sheet.updater = '张录入';
    sheet.updatedAt = todayStr() + ' ' + pad2(new Date().getHours()) + ':' + pad2(new Date().getMinutes());
    saveAll(data);
    return { ok: true };
  }

  function findRow(unit, slot) {
    if (!unit) return null;
    for (var i = 0; i < (unit.rows || []).length; i++) {
      if (unit.rows[i].slot === slot) return unit.rows[i];
    }
    return null;
  }

  /** 编辑单行：可改司机/货种/作业数据；泊位机械在 unit 上不可改 */
  function updateRow(date, shift, unitId, slot, patch) {
    var data = loadAll();
    var sheet = findSheet(data, date, shift);
    if (!sheet) return { ok: false, msg: '单据不存在' };
    if (sheet.status === '审批中' || sheet.status === '已通过') {
      return { ok: false, msg: '当前班次状态不可编辑' };
    }
    var unit = null;
    for (var i = 0; i < sheet.units.length; i++) {
      if (sheet.units[i].id === unitId) { unit = sheet.units[i]; break; }
    }
    if (!unit) return { ok: false, msg: '填报表不存在' };
    normalizeUnit(unit);
    var row = findRow(unit, slot);
    if (!row) return { ok: false, msg: '时段行不存在' };
    if (row.wecomSent) return { ok: false, msg: '已推送企微，不可再修改' };
    if (patch.driver != null) row.driver = patch.driver;
    if (patch.cargoL1 != null) row.cargoL1 = patch.cargoL1;
    if (patch.cargoL2 != null) row.cargoL2 = patch.cargoL2;
    if (patch.qty != null) row.qty = Number(patch.qty) || 0;
    if (patch.normal != null) row.normal = !!patch.normal;
    if (patch.reason != null) row.reason = patch.reason;
    if (patch.abMins !== undefined) row.abMins = patch.abMins;
    if (patch.remark != null) row.remark = patch.remark;
    if (patch.vesselId !== undefined || patch.vesselName !== undefined) {
      var vid = patch.vesselId != null ? patch.vesselId : row.vesselId;
      var vname = patch.vesselName != null ? patch.vesselName : row.vesselName;
      if (!vid && !vname) {
        row.vesselId = '';
        row.vesselName = '';
      } else {
        row.vesselId = vid || '';
        row.vesselName = vname || '';
      }
    }
    if (row.normal) {
      row.reason = '';
      row.abMins = null;
    }
    sheet.updater = '张录入';
    sheet.updatedAt = todayStr() + ' ' + pad2(new Date().getHours()) + ':' + pad2(new Date().getMinutes());
    saveAll(data);
    return { ok: true, row: row };
  }

  /** 推送企微并锁定该行（与班次审批无关） */
  function sendRowWecom(date, shift, unitId, slot) {
    var data = loadAll();
    var sheet = findSheet(data, date, shift);
    if (!sheet) return { ok: false, msg: '单据不存在' };
    var unit = null;
    for (var i = 0; i < sheet.units.length; i++) {
      if (sheet.units[i].id === unitId) { unit = sheet.units[i]; break; }
    }
    if (!unit) return { ok: false, msg: '填报表不存在' };
    normalizeUnit(unit);
    var row = findRow(unit, slot);
    if (!row) return { ok: false, msg: '时段行不存在' };
    if (row.wecomSent) return { ok: false, msg: '该行已推送企微' };
    if (!row.driver || !row.cargoL2) return { ok: false, msg: '请先完善司机与货种后再发送' };
    var vessel = resolveVessel(unit, row);
    if (!vessel.name) return { ok: false, msg: '请先选择船舶后再发送' };
    if (!row.normal) {
      if (!row.reason) return { ok: false, msg: '非正常须选择原因后再发送' };
      if (row.abMins == null || isNaN(row.abMins) || row.abMins <= 0) {
        return { ok: false, msg: '请填写非正常时长（分钟）后再发送' };
      }
      if (row.reason === '其他' && !row.remark) return { ok: false, msg: '选「其他」须填备注后再发送' };
    }
    if (row.qty < 0) return { ok: false, msg: '作业量不能为负' };
    row.wecomSent = true;
    row.wecomSentAt = todayStr() + ' ' + pad2(new Date().getHours()) + ':' + pad2(new Date().getMinutes());
    sheet.updater = '张录入';
    sheet.updatedAt = row.wecomSentAt;
    saveAll(data);
    return { ok: true, row: row, msg: '已推送企微并保存，该行不可再修改' };
  }

  function submitSheet(date, shift) {
    var data = loadAll();
    var sheet = findSheet(data, date, shift);
    if (!sheet) return { ok: false, msg: '单据不存在' };
    if (!sheet.units.length) return { ok: false, msg: '请先新增至少一张机台填报表' };
    if (sheet.status === '审批中') return { ok: false, msg: '本班已在审批中' };
    if (sheet.status === '已通过') return { ok: false, msg: '本班已通过，无需再提交' };
    sheet.status = '审批中';
    sheet.updatedAt = todayStr() + ' ' + pad2(new Date().getHours()) + ':' + pad2(new Date().getMinutes());
    saveAll(data);
    return { ok: true };
  }

  /** 一个班次一次审批：白班/夜班整单通过 */
  function approveSheet(date, shift) {
    var data = loadAll();
    var sheet = findSheet(data, date, shift);
    if (!sheet) return { ok: false, msg: '单据不存在' };
    if (sheet.status !== '审批中') return { ok: false, msg: '仅「审批中」的班次可通过' };
    sheet.status = '已通过';
    sheet.updatedAt = todayStr() + ' ' + pad2(new Date().getHours()) + ':' + pad2(new Date().getMinutes());
    sheet.approver = '审批人';
    saveAll(data);
    return { ok: true };
  }

  /** 一个班次一次审批：整单驳回 */
  function rejectSheet(date, shift, reason) {
    var data = loadAll();
    var sheet = findSheet(data, date, shift);
    if (!sheet) return { ok: false, msg: '单据不存在' };
    if (sheet.status !== '审批中') return { ok: false, msg: '仅「审批中」的班次可驳回' };
    sheet.status = '已驳回';
    sheet.rejectReason = reason || '';
    sheet.updatedAt = todayStr() + ' ' + pad2(new Date().getHours()) + ':' + pad2(new Date().getMinutes());
    sheet.approver = '审批人';
    saveAll(data);
    return { ok: true };
  }

  function pickLatestEditable() {
    var range = dateRange();
    var list = listSheets().filter(function (s) {
      return s.date >= range.from && s.date <= range.to;
    });
    for (var i = 0; i < list.length; i++) {
      if (list[i].status === '草稿' || list[i].status === '已驳回') {
        return list[i];
      }
    }
    for (var j = 0; j < list.length; j++) {
      if (list[j].units && list[j].units.length) return list[j];
    }
    return null;
  }

  function setActive(obj) {
    try { sessionStorage.setItem(ACTIVE_KEY, JSON.stringify(obj || {})); } catch (e) {}
  }

  function getActive() {
    try {
      var raw = sessionStorage.getItem(ACTIVE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }

  function findUnit(sheet, unitId) {
    if (!sheet) return null;
    for (var i = 0; i < (sheet.units || []).length; i++) {
      if (sheet.units[i].id === unitId) return sheet.units[i];
    }
    return sheet.units && sheet.units[0] ? sheet.units[0] : null;
  }

  global.WorkStatSheetStore = {
    BERTH_MACHINES: BERTH_MACHINES,
    DRIVERS: DRIVERS,
    DAY_SLOTS: DAY_SLOTS,
    NIGHT_SLOTS: NIGHT_SLOTS,
    todayStr: todayStr,
    dateRange: dateRange,
    slotsForShift: slotsForShift,
    listSheets: listSheets,
    getSheet: getSheet,
    ensureSheet: ensureSheet,
    createUnit: createUnit,
    updateUnit: updateUnit,
    deleteUnit: deleteUnit,
    unitHasSentRows: unitHasSentRows,
    saveUnitRows: saveUnitRows,
    updateRow: updateRow,
    sendRowWecom: sendRowWecom,
    submitSheet: submitSheet,
    approveSheet: approveSheet,
    rejectSheet: rejectSheet,
    pickLatestEditable: pickLatestEditable,
    setActive: setActive,
    getActive: getActive,
    findUnit: findUnit,
    unitTotal: unitTotal,
    sheetTotal: sheetTotal,
    unitKey: unitKey,
    resolveVessel: resolveVessel,
    rowHasVesselOverride: rowHasVesselOverride
  };
})(window);
