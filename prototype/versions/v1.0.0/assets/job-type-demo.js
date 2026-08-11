/**
 * 工种管理演示数据（原型）
 * - 左侧：工种类型（一级扁平）
 * - 右侧：人员主数据
 * - 「司机」工种下在职人员 = 填报/字典司机选项来源（替代原司机字典维护）
 * - 归属单位：本期固定演示枚举（单位配置另期）
 */
(function (global) {
  var STORAGE_KEY = 'tos_job_type_mgmt_v1';
  var UNIT_OPTIONS = ['装卸作业一班', '装卸作业二班', '生产调度室', '设备保障班'];
  var DRIVER_TYPE_ID = 'jt-driver';

  var SEED = {
    types: [
      { id: DRIVER_TYPE_ID, name: '司机' },
      { id: 'jt-tally', name: '理货员' },
      { id: 'jt-dispatch', name: '调度员' }
    ],
    people: [
      { id: 'p1', typeId: DRIVER_TYPE_ID, empNo: 'SJ001', name: '涂峰', idNo: '420102198801011234', gender: '男', mobile: '13800001001', unit: '装卸作业一班', status: '在职', remark: '', idFront: '', idBack: '' },
      { id: 'p2', typeId: DRIVER_TYPE_ID, empNo: 'SJ002', name: '陈迪政', idNo: '420102198802021234', gender: '男', mobile: '13800001002', unit: '装卸作业一班', status: '在职', remark: '', idFront: '', idBack: '' },
      { id: 'p3', typeId: DRIVER_TYPE_ID, empNo: 'SJ003', name: '刘志显', idNo: '420102198803031234', gender: '男', mobile: '13800001003', unit: '装卸作业二班', status: '在职', remark: '', idFront: '', idBack: '' },
      { id: 'p4', typeId: DRIVER_TYPE_ID, empNo: 'SJ004', name: '柯力', idNo: '420102198804041234', gender: '男', mobile: '13800001004', unit: '装卸作业二班', status: '离职', remark: '已调离', idFront: '', idBack: '' },
      { id: 'p5', typeId: DRIVER_TYPE_ID, empNo: 'SJ005', name: '刘念', idNo: '420102198805051234', gender: '男', mobile: '13800001005', unit: '装卸作业一班', status: '在职', remark: '', idFront: '', idBack: '' },
      { id: 'p6', typeId: DRIVER_TYPE_ID, empNo: 'SJ006', name: '胡涛', idNo: '420102198806061234', gender: '男', mobile: '13800001006', unit: '装卸作业二班', status: '在职', remark: '', idFront: '', idBack: '' },
      { id: 'p7', typeId: DRIVER_TYPE_ID, empNo: 'SJ007', name: '雷雨', idNo: '420102198807071234', gender: '男', mobile: '13800001007', unit: '装卸作业一班', status: '在职', remark: '', idFront: '', idBack: '' },
      { id: 'p8', typeId: 'jt-tally', empNo: 'LH001', name: '王敏', idNo: '420102199001011111', gender: '女', mobile: '13900002001', unit: '生产调度室', status: '在职', remark: '', idFront: '', idBack: '' }
    ]
  };

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.types) && Array.isArray(parsed.people)) return parsed;
      }
    } catch (e) {}
    var seed = clone(SEED);
    save(seed);
    return seed;
  }

  function save(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function uid(prefix) {
    return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function listTypes(keyword) {
    var list = load().types.slice();
    var kw = String(keyword || '').trim();
    if (kw) list = list.filter(function (t) { return t.name.indexOf(kw) >= 0; });
    return list;
  }

  function getType(id) {
    var list = load().types;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return clone(list[i]);
    return null;
  }

  function addType(name) {
    name = String(name || '').trim();
    if (!name) return { ok: false, msg: '请输入工种类型名称' };
    var state = load();
    if (state.types.some(function (t) { return t.name === name; })) {
      return { ok: false, msg: '工种类型已存在' };
    }
    var row = { id: uid('jt'), name: name };
    state.types.push(row);
    save(state);
    return { ok: true, type: row };
  }

  function renameType(id, name) {
    name = String(name || '').trim();
    if (!name) return { ok: false, msg: '请输入工种类型名称' };
    var state = load();
    if (state.types.some(function (t) { return t.name === name && t.id !== id; })) {
      return { ok: false, msg: '工种类型已存在' };
    }
    for (var i = 0; i < state.types.length; i++) {
      if (state.types[i].id === id) {
        if (id === DRIVER_TYPE_ID) {
          /* 允许改名，但保留 id，保证司机口径稳定 */
        }
        state.types[i].name = name;
        save(state);
        return { ok: true };
      }
    }
    return { ok: false, msg: '工种类型不存在' };
  }

  function removeType(id) {
    if (id === DRIVER_TYPE_ID) return { ok: false, msg: '系统内置「司机」工种不可删除' };
    var state = load();
    var used = state.people.some(function (p) { return p.typeId === id; });
    if (used) return { ok: false, msg: '该工种下仍有人员，请先删除或调整人员后再删类型' };
    state.types = state.types.filter(function (t) { return t.id !== id; });
    save(state);
    return { ok: true };
  }

  function listPeople(typeId) {
    var people = load().people;
    if (!typeId) return clone(people);
    return clone(people.filter(function (p) { return p.typeId === typeId; }));
  }

  function getPerson(id) {
    var people = load().people;
    for (var i = 0; i < people.length; i++) if (people[i].id === id) return clone(people[i]);
    return null;
  }

  function upsertPerson(row, isEdit) {
    var state = load();
    var empNo = String(row.empNo || '').trim();
    var name = String(row.name || '').trim();
    var idNo = String(row.idNo || '').trim();
    var mobile = String(row.mobile || '').trim();
    var typeId = row.typeId;
    var unit = row.unit;
    var gender = row.gender === '女' ? '女' : '男';
    var status = row.status === '离职' ? '离职' : '在职';
    var remark = String(row.remark || '').slice(0, 500);

    if (!typeId || !getType(typeId)) return { ok: false, msg: '请选择所属工种' };
    if (!empNo) return { ok: false, msg: '请填写人员工号' };
    if (!name) return { ok: false, msg: '请填写人员姓名' };
    if (!idNo) return { ok: false, msg: '请填写身份证号码' };
    if (!mobile) return { ok: false, msg: '请填写手机号码' };
    if (!unit) return { ok: false, msg: '请选择归属单位' };

    var dup = state.people.some(function (p) {
      return p.empNo === empNo && (!isEdit || p.id !== row.id);
    });
    if (dup) return { ok: false, msg: '人员工号已存在' };

    var payload = {
      id: isEdit ? row.id : uid('p'),
      typeId: typeId,
      empNo: empNo,
      name: name,
      idNo: idNo,
      gender: gender,
      mobile: mobile,
      unit: unit,
      status: status,
      remark: remark,
      idFront: row.idFront || '',
      idBack: row.idBack || ''
    };

    if (isEdit) {
      var idx = -1;
      for (var i = 0; i < state.people.length; i++) if (state.people[i].id === row.id) { idx = i; break; }
      if (idx < 0) return { ok: false, msg: '人员不存在' };
      state.people[idx] = payload;
    } else {
      state.people.push(payload);
    }
    save(state);
    return { ok: true, person: payload };
  }

  function removePerson(id) {
    var state = load();
    state.people = state.people.filter(function (p) { return p.id !== id; });
    save(state);
    return { ok: true };
  }

  /** 填报用：司机工种 + 在职 */
  function listActiveDrivers() {
    return listPeople(DRIVER_TYPE_ID).filter(function (p) { return p.status === '在职'; });
  }

  function resetDemo() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  global.JobTypeDemo = {
    DRIVER_TYPE_ID: DRIVER_TYPE_ID,
    UNIT_OPTIONS: UNIT_OPTIONS,
    listTypes: listTypes,
    getType: getType,
    addType: addType,
    renameType: renameType,
    removeType: removeType,
    listPeople: listPeople,
    getPerson: getPerson,
    upsertPerson: upsertPerson,
    removePerson: removePerson,
    listActiveDrivers: listActiveDrivers,
    resetDemo: resetDemo
  };
})(window);
