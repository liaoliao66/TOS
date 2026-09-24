/**
 * 船舶档案演示数据（原型）
 * - 菜单：作业管理 → 船舶档案
 * - 新增/编辑：仅「船名中文」「联系方式」必填，其余选填
 * - 工班作业/船舶调度：船名从档案选择打通
 */
(function (global) {
  var STORAGE_KEY = 'tos_ship_archive_v1';

  var SHIP_TYPES = ['散货船', '件杂货船', '集装箱船', '多用途船'];
  var NATIONALITIES = ['中国', '中国香港', '巴拿马', '利比里亚', '马绍尔群岛'];
  var COMPANIES = ['远航海运', '海丰航运', '长江航运', '联投港务代理'];
  var STATUSES = ['正常', '停航', '维修', '注销'];
  var CAPTAINS = ['张伟', '李强', '王海', '赵明'];

  var SEED = [
    {
      id: 's1',
      code: 'SH-001',
      nameCn: '远航 168',
      nameEn: 'YUAN HANG 168',
      nationality: '中国',
      shipType: '散货船',
      imo: '9123456',
      mmsi: '413123456',
      callSign: 'BZYA',
      length: 158.5,
      hatchLength: 42.0,
      width: 24.0,
      hatchWidth: 18.5,
      netWeight: 8200,
      dwt: 28000,
      grossWeight: 18500,
      licenseNo: 'YYYS-2024-001',
      validFrom: '2024-01-01',
      validTo: '2027-12-31',
      status: '正常',
      company: '远航海运',
      captain: '张伟',
      contacts: [{ phone: '13800001111' }],
      remark: '常用进江散货船',
      quals: []
    },
    {
      id: 's2',
      code: 'SH-002',
      nameCn: '海丰致远',
      nameEn: 'SITC ZHIYUAN',
      nationality: '中国',
      shipType: '件杂货船',
      imo: '9234567',
      mmsi: '413234567',
      callSign: 'BZYB',
      length: 132.0,
      hatchLength: null,
      width: 21.0,
      hatchWidth: null,
      netWeight: 6500,
      dwt: 18000,
      grossWeight: 12000,
      licenseNo: '',
      validFrom: '',
      validTo: '',
      status: '正常',
      company: '海丰航运',
      captain: '李强',
      contacts: [{ phone: '13900002222' }],
      remark: '',
      quals: []
    }
  ];

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    var seed = clone(SEED);
    save(seed);
    return seed;
  }

  function save(list) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch (e) {}
  }

  function uid() {
    return 's-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  }

  function listShips() {
    return clone(load());
  }

  function listActiveShips() {
    return listShips().filter(function (s) { return s.status === '正常'; });
  }

  function getById(id) {
    var list = load();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return clone(list[i]);
    return null;
  }

  function getByNameCn(name) {
    var list = load();
    for (var i = 0; i < list.length; i++) if (list[i].nameCn === name) return clone(list[i]);
    return null;
  }

  function numOrNull(v) {
    if (v === '' || v == null) return null;
    var n = Number(v);
    return isNaN(n) ? null : n;
  }

  function upsert(row, isEdit) {
    var list = load();
    var nameCn = String(row.nameCn || '').trim();
    var shipType = row.shipType || '';
    var mmsi = String(row.mmsi || '').trim();
    var status = row.status || '正常';
    var company = row.company || '';
    var contacts = Array.isArray(row.contacts) ? row.contacts : [];
    var hasPhone = contacts.some(function (c) {
      return String((c && c.phone) || '').trim();
    });

    if (!nameCn) return { ok: false, msg: '请填写船名中文' };
    if (!hasPhone) return { ok: false, msg: '请至少填写 1 个联系方式' };

    var dupName = list.some(function (s) {
      return s.nameCn === nameCn && (!isEdit || s.id !== row.id);
    });
    if (dupName) return { ok: false, msg: '船名中文已存在' };

    var payload = {
      id: isEdit ? row.id : uid(),
      code: String(row.code || '').trim(),
      nameCn: nameCn,
      nameEn: String(row.nameEn || '').trim(),
      nationality: row.nationality || '',
      shipType: shipType,
      imo: String(row.imo || '').trim(),
      mmsi: mmsi,
      callSign: String(row.callSign || '').trim(),
      length: numOrNull(row.length),
      hatchLength: numOrNull(row.hatchLength),
      width: numOrNull(row.width),
      hatchWidth: numOrNull(row.hatchWidth),
      netWeight: numOrNull(row.netWeight),
      dwt: numOrNull(row.dwt),
      grossWeight: numOrNull(row.grossWeight),
      licenseNo: String(row.licenseNo || '').trim(),
      validFrom: row.validFrom || '',
      validTo: row.validTo || '',
      status: status || '正常',
      company: company,
      captain: row.captain || '',
      contacts: contacts.length ? contacts : [{ phone: '' }],
      remark: String(row.remark || ''),
      quals: Array.isArray(row.quals) ? row.quals : []
    };

    if (isEdit) {
      var idx = -1;
      for (var i = 0; i < list.length; i++) if (list[i].id === row.id) { idx = i; break; }
      if (idx < 0) return { ok: false, msg: '船舶不存在' };
      list[idx] = payload;
    } else {
      list.unshift(payload);
    }
    save(list);
    return { ok: true, ship: payload };
  }

  function remove(id) {
    save(load().filter(function (s) { return s.id !== id; }));
    return { ok: true };
  }

  function resetDemo() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  global.ShipArchiveDemo = {
    SHIP_TYPES: SHIP_TYPES,
    NATIONALITIES: NATIONALITIES,
    COMPANIES: COMPANIES,
    STATUSES: STATUSES,
    CAPTAINS: CAPTAINS,
    listShips: listShips,
    listActiveShips: listActiveShips,
    getById: getById,
    getByNameCn: getByNameCn,
    upsert: upsert,
    remove: remove,
    resetDemo: resetDemo
  };
})(window);
