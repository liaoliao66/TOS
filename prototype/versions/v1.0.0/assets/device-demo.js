/**
 * 设备管理演示数据（原型）
 * - 主数据仅来自「设备管理系统」同步，本地不可新增/编辑主档
 * - 启用/禁用以外系统为准（同步覆盖）
 * - 外系统删除 → 本地直接删除
 * - 泊位管理作业设备选项：仅已启用设备
 */
(function (global) {
  var STORAGE_KEY = 'tos_device_mgmt_v1';

  var TYPE_TREE = [
    { id: 'all', name: '全部设备', parentId: null },
    { id: 'unload', name: '卸船机', parentId: null },
    { id: 'gantry', name: '门机', parentId: null },
    { id: 'load', name: '装船机', parentId: null }
  ];

  /** 本地当前库（可被同步覆盖） */
  var LOCAL_SEED = [
    { code: 'XSJ-01', name: '1#卸船机', model: 'XQ3500', typeId: 'unload', enabled: true },
    { code: 'XSJ-02', name: '2#卸船机', model: 'XQ3500', typeId: 'unload', enabled: true },
    { code: 'XSJ-03', name: '3#卸船机', model: 'XQ4200', typeId: 'unload', enabled: true },
    { code: 'XSJ-04', name: '4#卸船机', model: 'XQ4200', typeId: 'unload', enabled: false },
    { code: 'MJ-01', name: '1#门机', model: 'MQ4035', typeId: 'gantry', enabled: true },
    { code: 'MJ-02', name: '2#门机', model: 'MQ4035', typeId: 'gantry', enabled: true },
    { code: 'ZCJ-01', name: '1#装船机', model: 'ZC2000', typeId: 'load', enabled: true }
  ];

  /**
   * 模拟外系统快照：相对 LOCAL_SEED
   * - 更新 XSJ-01 型号与启用状态
   * - 新增 XSJ-05
   * - 删除 XSJ-04（外系统已无）
   * - MJ-02 改为禁用
   */
  var REMOTE_SNAPSHOT = [
    { code: 'XSJ-01', name: '1#卸船机', model: 'XQ3500-A', typeId: 'unload', enabled: true },
    { code: 'XSJ-02', name: '2#卸船机', model: 'XQ3500', typeId: 'unload', enabled: true },
    { code: 'XSJ-03', name: '3#卸船机', model: 'XQ4200', typeId: 'unload', enabled: true },
    { code: 'XSJ-05', name: '5#卸船机', model: 'XQ4800', typeId: 'unload', enabled: true },
    { code: 'MJ-01', name: '1#门机', model: 'MQ4035', typeId: 'gantry', enabled: true },
    { code: 'MJ-02', name: '2#门机', model: 'MQ4035', typeId: 'gantry', enabled: false },
    { code: 'ZCJ-01', name: '1#装船机', model: 'ZC2000', typeId: 'load', enabled: true }
  ];

  function clone(list) {
    return JSON.parse(JSON.stringify(list || []));
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.devices)) return parsed;
      }
    } catch (e) {}
    return {
      devices: clone(LOCAL_SEED),
      lastSyncAt: null,
      lastSyncResult: null
    };
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function getTypeName(typeId) {
    var t = TYPE_TREE.filter(function (x) { return x.id === typeId; })[0];
    return t ? t.name : typeId;
  }

  function listDevices(typeId) {
    var state = loadState();
    var list = state.devices || [];
    if (!typeId || typeId === 'all') return clone(list);
    return clone(list.filter(function (d) { return d.typeId === typeId; }));
  }

  function listEnabledDevices() {
    return listDevices('all').filter(function (d) { return !!d.enabled; });
  }

  function syncFromRemote() {
    var state = loadState();
    var before = {};
    (state.devices || []).forEach(function (d) { before[d.code] = d; });

    var remote = clone(REMOTE_SNAPSHOT);
    var afterMap = {};
    remote.forEach(function (d) { afterMap[d.code] = d; });

    var added = 0;
    var updated = 0;
    var removed = 0;

    Object.keys(afterMap).forEach(function (code) {
      if (!before[code]) added += 1;
      else {
        var a = before[code];
        var b = afterMap[code];
        if (a.name !== b.name || a.model !== b.model || a.typeId !== b.typeId || !!a.enabled !== !!b.enabled) {
          updated += 1;
        }
      }
    });
    Object.keys(before).forEach(function (code) {
      if (!afterMap[code]) removed += 1;
    });

    var now = new Date();
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var stamp =
      now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + ' ' +
      pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());

    state.devices = remote;
    state.lastSyncAt = stamp;
    state.lastSyncResult = { added: added, updated: updated, removed: removed };
    saveState(state);
    return {
      devices: clone(state.devices),
      lastSyncAt: state.lastSyncAt,
      result: state.lastSyncResult
    };
  }

  function getMeta() {
    var state = loadState();
    return {
      lastSyncAt: state.lastSyncAt,
      lastSyncResult: state.lastSyncResult
    };
  }

  function resetDemo() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  global.DeviceDemo = {
    TYPE_TREE: TYPE_TREE,
    getTypeName: getTypeName,
    listDevices: listDevices,
    listEnabledDevices: listEnabledDevices,
    syncFromRemote: syncFromRemote,
    getMeta: getMeta,
    resetDemo: resetDemo
  };
})(window);
