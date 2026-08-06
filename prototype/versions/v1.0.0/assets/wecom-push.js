/**
 * 日班时段填报 · 企微推送（原型示意）
 * 全局一套；默认开启；每条明细保存/修改各推一条
 */
(function (global) {
  var KEY = 'wecomPushConfig_v1';

  var DEFAULT = {
    enabled: true,
    people: [
      { id: 'u001', name: '张调度', dept: '调度中心' },
      { id: 'u002', name: '李班长', dept: '装卸一班' }
    ],
    groups: [
      { id: 'g001', name: '装卸现场群' },
      { id: 'g002', name: '调度值班群' }
    ]
  };

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var cfg = JSON.parse(raw);
        if (typeof cfg.enabled !== 'boolean') cfg.enabled = true;
        if (!Array.isArray(cfg.people)) cfg.people = DEFAULT.people.slice();
        if (!Array.isArray(cfg.groups)) cfg.groups = DEFAULT.groups.slice();
        return cfg;
      }
    } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULT));
  }

  function save(cfg) {
    try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {}
  }

  function formatMessage(line) {
    var slot = line.slot || '—';
    var berth = line.berth || '—';
    var machine = line.machine || '—';
    var driver = line.driver || '—';
    var qty = (line.qty == null || line.qty === '') ? '—' : Number(line.qty).toFixed(2);
    return [
      '时间：' + slot,
      '泊位：' + berth,
      '设备：' + machine,
      '司机：' + driver,
      '作业量：' + qty + ' 吨'
    ].join('\n');
  }

  function isEnabled() {
    return !!load().enabled;
  }

  /**
   * 原型：弹出推送预览（非真发企微）
   * @param {object} line
   * @param {'create'|'update'} action
   */
  function notifyAfterSave(line, action) {
    var cfg = load();
    if (!cfg.enabled) return false;
    var text = formatMessage(line);
    var people = (cfg.people || []).map(function (p) { return p.name; }).join('、') || '（未选人员）';
    var groups = (cfg.groups || []).map(function (g) { return g.name; }).join('、') || '（未选群）';
    var title = action === 'update' ? '企微推送（修改后再发）' : '企微推送（时段保存）';

    var mask = document.createElement('div');
    mask.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:90;display:flex;align-items:center;justify-content:center;padding:24px;';
    mask.innerHTML =
      '<div style="width:100%;max-width:420px;background:#fff;border-radius:20px;padding:20px;box-shadow:0 12px 40px rgba(0,0,0,.15);">' +
        '<div style="font-weight:600;font-size:15px;margin-bottom:8px;">' + title + '</div>' +
        '<div style="font-size:12px;color:#64748b;margin-bottom:12px;">已推送至人员：' + people + '<br/>已推送至群：' + groups + '</div>' +
        '<pre style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px;font-size:13px;line-height:1.7;white-space:pre-wrap;color:#0f172a;margin:0 0 14px;">' +
          text.replace(/</g, '&lt;') +
        '</pre>' +
        '<button type="button" id="wecomPushOk" style="width:100%;border:0;border-radius:16px;background:#0f766e;color:#fff;padding:10px;font-size:14px;cursor:pointer;">知道了</button>' +
      '</div>';
    document.body.appendChild(mask);
    mask.querySelector('#wecomPushOk').onclick = function () { mask.remove(); };
    mask.onclick = function (e) { if (e.target === mask) mask.remove(); };
    return true;
  }

  global.WecomPush = {
    KEY: KEY,
    DEFAULT: DEFAULT,
    load: load,
    save: save,
    formatMessage: formatMessage,
    isEnabled: isEnabled,
    notifyAfterSave: notifyAfterSave
  };
})(window);
