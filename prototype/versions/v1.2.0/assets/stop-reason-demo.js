/**
 * 船舶调度 · 停工原因字典（原型）
 * - 原因名称 + 归类：天气 / 故障 / 其他
 * - 供船舶效率三类停工汇总、调度停工下拉共用
 */
(function (global) {
  var KEY = 'tos_stop_reason_v1';
  var CATEGORIES = ['天气', '故障', '其他'];

  var SEED = [
    { id: 'sr1', name: '天气原因', category: '天气', status: '启用' },
    { id: 'sr2', name: '下雨，暂停作业', category: '天气', status: '启用' },
    { id: 'sr3', name: '设备异常', category: '故障', status: '启用' },
    { id: 'sr4', name: '等货/等驳', category: '其他', status: '启用' },
    { id: 'sr5', name: '移泊', category: '其他', status: '启用' },
    { id: 'sr6', name: '其他', category: '其他', status: '启用' }
  ];

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (Array.isArray(p) && p.length) return p;
      }
    } catch (e) {}
    var seed = clone(SEED);
    save(seed);
    return seed;
  }

  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
  }

  function listAll() { return clone(load()); }

  function listEnabled() {
    return listAll().filter(function (x) { return x.status === '启用'; });
  }

  function namesEnabled() {
    return listEnabled().map(function (x) { return x.name; });
  }

  function categoryOf(name) {
    var list = load();
    for (var i = 0; i < list.length; i++) {
      if (list[i].name === name) return list[i].category || '其他';
    }
    return '其他';
  }

  function upsert(row, isEdit) {
    var list = load();
    var name = String(row.name || '').trim();
    var category = String(row.category || '').trim();
    var status = row.status === '停用' ? '停用' : '启用';
    if (!name) return { ok: false, msg: '请填写停工原因' };
    if (CATEGORIES.indexOf(category) < 0) return { ok: false, msg: '请选择归类（天气/故障/其他）' };
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === row.id) { idx = i; break; }
      if (!isEdit && list[i].name === name) return { ok: false, msg: '原因名称已存在' };
    }
    if (isEdit && idx < 0) return { ok: false, msg: '记录不存在' };
    if (isEdit) {
      for (var j = 0; j < list.length; j++) {
        if (j !== idx && list[j].name === name) return { ok: false, msg: '原因名称已存在' };
      }
      list[idx] = { id: list[idx].id, name: name, category: category, status: status };
    } else {
      list.push({
        id: 'sr-' + Date.now().toString(36),
        name: name,
        category: category,
        status: status
      });
    }
    save(list);
    return { ok: true, list: clone(list) };
  }

  function remove(id) {
    var list = load().filter(function (x) { return x.id !== id; });
    save(list);
    return clone(list);
  }

  function resetDemo() {
    try { localStorage.removeItem(KEY); } catch (e) {}
  }

  global.StopReasonDemo = {
    CATEGORIES: CATEGORIES,
    listAll: listAll,
    listEnabled: listEnabled,
    namesEnabled: namesEnabled,
    categoryOf: categoryOf,
    upsert: upsert,
    remove: remove,
    resetDemo: resetDemo
  };
})(window);
