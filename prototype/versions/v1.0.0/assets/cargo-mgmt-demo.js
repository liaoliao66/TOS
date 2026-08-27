/**
 * 货种配置（系统配置 · 原型）
 * - 三大类页签：集装箱 / 散货 / 件杂货
 * - 树形：可添加子级；仅名称必填
 * - 替代原字典管理·货种；调度/效率级联从此读取
 */
(function (global) {
  var KEY = 'tos_cargo_mgmt_v1';
  var MAJORS = ['吨包袋', '散货', '集装箱', '件杂货'];
  var UNITS = ['吨', 'TEU', '件', '立方米'];
  var BULK_TYPES = ['—', '固体散货', '液体散货', '件杂', '集装箱'];

  var SEED = {
    '吨包袋': [
      {
        id: 'tb-1', name: '工铵吨包', motCode: '81001', unit: '吨', bulkType: '件杂', remark: '',
        children: []
      },
      {
        id: 'tb-2', name: '吨包', motCode: '81002', unit: '吨', bulkType: '件杂', remark: '',
        children: []
      }
    ],
    '集装箱': [
      {
        id: 'ct-1', name: '20尺标箱', motCode: 'JZX20', unit: 'TEU', bulkType: '集装箱', remark: '',
        children: []
      },
      {
        id: 'ct-2', name: '40尺高箱', motCode: 'JZX40', unit: 'TEU', bulkType: '集装箱', remark: '',
        children: []
      }
    ],
    '散货': [
      {
        id: 'sg-1', name: '煤', motCode: '79876', unit: '吨', bulkType: '固体散货', remark: '',
        children: [
          { id: 'sg-1-1', name: '动力煤', motCode: '79877', unit: '吨', bulkType: '固体散货', remark: '' },
          { id: 'sg-1-2', name: '焦煤', motCode: '79878', unit: '吨', bulkType: '固体散货', remark: '' }
        ]
      },
      {
        id: 'sg-2', name: '氧化钙', motCode: '80001', unit: '吨', bulkType: '固体散货', remark: '',
        children: []
      },
      {
        id: 'sg-3', name: '氮磷肥', motCode: '80002', unit: '吨', bulkType: '固体散货', remark: '',
        children: []
      },
      {
        id: 'sg-4', name: '磷矿', motCode: '80003', unit: '吨', bulkType: '固体散货', remark: '',
        children: []
      },
      {
        id: 'sg-5', name: '硫矿', motCode: '80004', unit: '吨', bulkType: '固体散货', remark: '',
        children: []
      },
      {
        id: 'sg-6', name: '二氢钾', motCode: '80005', unit: '吨', bulkType: '固体散货', remark: '',
        children: []
      },
      {
        id: 'sg-7', name: '硫磺', motCode: '80006', unit: '吨', bulkType: '固体散货', remark: '',
        children: []
      },
      {
        id: 'sg-8', name: '磷酸二氢氨', motCode: '80007', unit: '吨', bulkType: '固体散货', remark: '',
        children: []
      },
      {
        id: 'sg-9', name: '脱硫石膏', motCode: '80008', unit: '吨', bulkType: '固体散货', remark: '',
        children: []
      }
    ],
    '件杂货': [
      {
        id: 'jz-1', name: '钢材', motCode: '90001', unit: '吨', bulkType: '件杂', remark: '',
        children: []
      },
      {
        id: 'jz-2', name: '设备件', motCode: '90002', unit: '件', bulkType: '件杂', remark: '',
        children: []
      }
    ]
  };

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (p && typeof p === 'object') return p;
      }
    } catch (e) {}
    var seed = clone(SEED);
    save(seed);
    return seed;
  }

  function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  function uid(p) {
    return (p || 'cg') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  }

  function listByMajor(major) {
    var state = load();
    return clone(state[major] || []);
  }

  function findNode(major, id) {
    var list = load()[major] || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return { parent: null, node: list[i], index: i, list: list };
      var kids = list[i].children || [];
      for (var j = 0; j < kids.length; j++) {
        if (kids[j].id === id) return { parent: list[i], node: kids[j], index: j, list: kids };
      }
    }
    return null;
  }

  function upsert(major, row, opts) {
    opts = opts || {};
    var name = String(row.name || '').trim();
    if (!name) return { ok: false, msg: '请填写名称' };
    if (MAJORS.indexOf(major) < 0) return { ok: false, msg: '货种大类无效' };

    var state = load();
    if (!state[major]) state[major] = [];
    var item = {
      id: row.id || uid('cg'),
      name: name,
      motCode: String(row.motCode || '').trim(),
      unit: String(row.unit || '').trim(),
      bulkType: String(row.bulkType || '').trim(),
      remark: String(row.remark || '').trim(),
      children: Array.isArray(row.children) ? row.children : []
    };

    if (opts.asChildOf) {
      var hit = findNode(major, opts.asChildOf);
      if (!hit || hit.parent) return { ok: false, msg: '仅支持在一级节点下添加子级' };
      var parent = hit.node;
      if (!parent.children) parent.children = [];
      if (opts.isEdit) {
        var ci = -1;
        for (var k = 0; k < parent.children.length; k++) if (parent.children[k].id === item.id) { ci = k; break; }
        if (ci < 0) return { ok: false, msg: '子级不存在' };
        item.children = [];
        parent.children[ci] = item;
      } else {
        item.children = [];
        parent.children.push(item);
      }
    } else if (opts.isEdit) {
      var found = findNode(major, item.id);
      if (!found) return { ok: false, msg: '记录不存在' };
      if (found.parent) {
        item.children = [];
        found.list[found.index] = item;
      } else {
        item.children = found.node.children || [];
        found.list[found.index] = item;
      }
    } else {
      item.children = [];
      state[major].unshift(item);
    }
    save(state);
    return { ok: true };
  }

  function remove(major, id) {
    var state = load();
    var list = state[major] || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        list.splice(i, 1);
        save(state);
        return { ok: true };
      }
      var kids = list[i].children || [];
      for (var j = 0; j < kids.length; j++) {
        if (kids[j].id === id) {
          kids.splice(j, 1);
          save(state);
          return { ok: true };
        }
      }
    }
    return { ok: false, msg: '记录不存在' };
  }

  /** 级联用：一级=大类，二级=可选货种名（有子级则取其子级名，否则取本级名） */
  function cascadeTree() {
    return MAJORS.map(function (major) {
      var children = [];
      listByMajor(major).forEach(function (n) {
        var kids = n.children || [];
        if (kids.length) {
          kids.forEach(function (c) { children.push(c.name); });
        } else {
          children.push(n.name);
        }
      });
      return { name: major, children: children };
    });
  }

  function resetDemo() {
    try { localStorage.removeItem(KEY); } catch (e) {}
  }

  global.CargoMgmtDemo = {
    MAJORS: MAJORS,
    UNITS: UNITS,
    BULK_TYPES: BULK_TYPES,
    listByMajor: listByMajor,
    findNode: findNode,
    upsert: upsert,
    remove: remove,
    cascadeTree: cascadeTree,
    resetDemo: resetDemo
  };
})(window);
