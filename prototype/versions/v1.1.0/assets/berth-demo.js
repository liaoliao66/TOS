/**
 * 泊位管理演示数据（原型）
 * - 替代原「泊位机械配置」
 * - 作业设备：多选，来自设备管理·已启用，不设上限
 * - 作业货种：集装箱 / 散货 / 件杂货（固定枚举，可多选）
 * - 支持新增 / 编辑 / 删除 / 启用禁用
 */
(function (global) {
  /** v3：6 泊位 · 8 设备；2/3/4 号可双机同时作业 */
  var STORAGE_KEY = 'tos_berth_mgmt_v3';
  var CARGO_OPTIONS = ['集装箱', '散货', '件杂货'];

  var SEED = [
    {
      code: 'BW-01',
      name: '1#泊位',
      displayName: '集装箱1号泊位',
      deviceCodes: ['ZCJ-01'],
      cargos: ['集装箱'],
      dualCapable: false,
      enabled: true
    },
    {
      code: 'BW-02',
      name: '2#泊位',
      displayName: '散货1号泊位',
      deviceCodes: ['XSJ-02', 'XSJ-05'],
      cargos: ['散货'],
      dualCapable: true,
      enabled: true
    },
    {
      code: 'BW-03',
      name: '3#泊位',
      displayName: '散货2号泊位',
      deviceCodes: ['XSJ-03', 'XSJ-04'],
      cargos: ['散货'],
      dualCapable: true,
      enabled: true
    },
    {
      code: 'BW-04',
      name: '4#泊位',
      displayName: '散货3号泊位',
      deviceCodes: ['XSJ-01', 'XSJ-02'],
      cargos: ['散货', '件杂货'],
      dualCapable: true,
      enabled: true
    },
    {
      code: 'BW-05',
      name: '5#泊位',
      displayName: '杂货1号泊位',
      deviceCodes: ['MJ-01'],
      cargos: ['件杂货'],
      dualCapable: false,
      enabled: true
    },
    {
      code: 'BW-06',
      name: '6#泊位',
      displayName: '杂货2号泊位',
      deviceCodes: ['MJ-02'],
      cargos: ['件杂货', '散货'],
      dualCapable: false,
      enabled: true
    }
  ];

  function clone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function loadList() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    var seed = clone(SEED);
    saveList(seed);
    return seed;
  }

  function saveList(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  function listBerths() {
    return clone(loadList());
  }

  function getByCode(code) {
    var list = loadList();
    for (var i = 0; i < list.length; i++) {
      if (list[i].code === code) return clone(list[i]);
    }
    return null;
  }

  function upsert(berth, isEdit) {
    var list = loadList();
    var code = String(berth.code || '').trim();
    var name = String(berth.name || '').trim();
    var deviceCodes = berth.deviceCodes || [];
    var cargos = berth.cargos || [];
    var enabled = !!berth.enabled;

    if (!code) return { ok: false, msg: '请填写泊位编码' };
    if (!name) return { ok: false, msg: '请填写泊位名称' };
    if (!deviceCodes.length) return { ok: false, msg: '请至少选择 1 台作业设备' };
    if (!cargos.length) return { ok: false, msg: '请至少选择 1 种作业货种' };

    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].code === code) { idx = i; break; }
    }
    if (!isEdit && idx >= 0) return { ok: false, msg: '泊位编码已存在' };
    if (isEdit && idx < 0) return { ok: false, msg: '泊位不存在' };

    var row = {
      code: code,
      name: name,
      displayName: berth.displayName || name,
      deviceCodes: deviceCodes.slice(),
      cargos: cargos.slice(),
      dualCapable: !!berth.dualCapable,
      enabled: enabled
    };
    if (isEdit) {
      if (list[idx].displayName && !berth.displayName) row.displayName = list[idx].displayName;
      if (list[idx].dualCapable && berth.dualCapable === undefined) row.dualCapable = list[idx].dualCapable;
      list[idx] = row;
    } else list.push(row);
    saveList(list);
    return { ok: true, list: clone(list) };
  }

  function remove(code) {
    var list = loadList().filter(function (b) { return b.code !== code; });
    saveList(list);
    return clone(list);
  }

  function setEnabled(code, enabled) {
    var list = loadList();
    for (var i = 0; i < list.length; i++) {
      if (list[i].code === code) {
        list[i].enabled = !!enabled;
        saveList(list);
        return clone(list);
      }
    }
    return clone(list);
  }

  function resetDemo() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  function resolveDeviceNames(codes) {
    var map = {};
    if (global.DeviceDemo && DeviceDemo.listDevices) {
      DeviceDemo.listDevices('all').forEach(function (d) {
        map[d.code] = d.name + (d.enabled ? '' : '（已禁用）');
      });
    }
    return (codes || []).map(function (c) { return map[c] || c; });
  }

  function listEnabledBerths() {
    return listBerths().filter(function (b) { return !!b.enabled; });
  }

  function getByName(name) {
    var list = loadList();
    for (var i = 0; i < list.length; i++) {
      if (list[i].name === name) return clone(list[i]);
    }
    return null;
  }

  /** 按编码或名称取泊位（兼容历史「1#」写法） */
  function findBerth(key) {
    if (!key) return null;
    var hit = getByCode(key) || getByName(key);
    if (hit) return hit;
    var list = loadList();
    for (var i = 0; i < list.length; i++) {
      var n = list[i].name || '';
      if (n === key || n.indexOf(key) === 0 || key.indexOf(n) === 0) return clone(list[i]);
      /* 「1#」匹配「1#泊位」 */
      if (key.indexOf('#') >= 0 && n.indexOf(key) === 0) return clone(list[i]);
    }
    return null;
  }

  /** 泊位已绑定且设备已启用的作业设备 */
  function listDevicesForBerth(key) {
    var b = findBerth(key);
    if (!b || !b.deviceCodes || !b.deviceCodes.length) return [];
    var enabled = [];
    if (global.DeviceDemo && DeviceDemo.listEnabledDevices) {
      enabled = DeviceDemo.listEnabledDevices();
    }
    var map = {};
    enabled.forEach(function (d) { map[d.code] = d; });
    var out = [];
    b.deviceCodes.forEach(function (code) {
      if (map[code]) out.push(clone(map[code]));
    });
    return out;
  }

  global.BerthDemo = {
    CARGO_OPTIONS: CARGO_OPTIONS,
    listBerths: listBerths,
    listEnabledBerths: listEnabledBerths,
    getByCode: getByCode,
    getByName: getByName,
    findBerth: findBerth,
    listDevicesForBerth: listDevicesForBerth,
    upsert: upsert,
    remove: remove,
    setEnabled: setEnabled,
    resetDemo: resetDemo,
    resolveDeviceNames: resolveDeviceNames
  };
})(window);
