/**
 * 填报：非正常原因 / 非正常时段 / 备注
 */
(function (global) {
  var REASONS = [
    '停电/无生产作业',
    '吃饭休息',
    '车辆断档',
    '交接班',
    '避高温，暂停作业',
    '下雨，暂停作业',
    '完船',
    '设备异常',
    '其他'
  ];

  function reasonOptionsHtml(selected) {
    var html = '<option value="">请选择原因</option>';
    REASONS.forEach(function (r) {
      html += '<option value="' + r + '"' + (r === selected ? ' selected' : '') + '>' + r + '</option>';
    });
    return html;
  }

  function timeToMin(t) {
    if (!t) return NaN;
    var p = String(t).split(':');
    if (p.length < 2) return NaN;
    return Number(p[0]) * 60 + Number(p[1]);
  }

  function parseSlot(slotText) {
    var m = String(slotText || '').match(/(\d{1,2}:\d{2})\s*[-–~]\s*(\d{1,2}:\d{2})/);
    if (!m) return null;
    function norm(x) {
      var parts = x.split(':');
      return ('0' + parts[0]).slice(-2) + ':' + parts[1];
    }
    return { from: norm(m[1]), to: norm(m[2]) };
  }

  function getSlotForCell(box) {
    var tr = box.closest('tr');
    if (!tr) return '';
    var slotTd = tr.querySelector('.sticky-col');
    return slotTd ? slotTd.textContent.trim() : '';
  }

  function syncRemarkRequired(box) {
    var reason = box.querySelector('.reason-sel');
    var remark = box.querySelector('.remark-inp');
    if (!remark) return;
    var need = reason && !reason.classList.contains('hidden') && reason.value === '其他';
    remark.placeholder = need ? '选「其他」时必填备注' : '备注（选填）';
    remark.classList.toggle('ring-1', !!need);
    remark.classList.toggle('ring-amber-400', !!need);
  }

  function toggleReason(sel) {
    var box = sel.parentElement;
    if (!box) return;
    var reason = box.querySelector('.reason-sel');
    var extra = box.querySelector('.abnormal-extra');
    var no = sel.value === 'no';
    if (reason) {
      reason.classList.toggle('hidden', !no);
      if (!no) reason.selectedIndex = 0;
    }
    if (extra) {
      extra.classList.toggle('hidden', !no);
      if (!no) {
        var f = extra.querySelector('.ab-from');
        var t = extra.querySelector('.ab-to');
        if (f) f.value = '';
        if (t) t.value = '';
      }
    }
    syncRemarkRequired(box);
  }

  function onReasonChange(sel) {
    syncRemarkRequired(sel.parentElement);
  }

  function validatePeriod(slotText, abFrom, abTo) {
    if (!abFrom || !abTo) return '非正常须填写非正常时段（开始/结束）';
    var a0 = timeToMin(abFrom);
    var a1 = timeToMin(abTo);
    if (isNaN(a0) || isNaN(a1)) return '非正常时段格式无效';
    if (a1 <= a0) return '非正常时段结束时间须晚于开始时间';
    var slot = parseSlot(slotText);
    if (!slot) return '无法识别所属作业时段，请检查行时段';
    var s0 = timeToMin(slot.from);
    var s1 = timeToMin(slot.to);
    /* 夜班跨日：若结束小于开始（如 23:00-00:00）暂按同日格子处理，本原型时段均为整点同日 */
    if (a0 < s0 || a1 > s1) {
      return '非正常时段须落在对应作业时段内（' + slot.from + '-' + slot.to + '）';
    }
    return '';
  }

  function validateCell(box) {
    var flag = box.querySelector('.normal-flag');
    if (!flag || flag.value !== 'no') {
      var remarkOk = box.querySelector('.remark-inp');
      /* 正常：备注可选 */
      return '';
    }
    var reason = box.querySelector('.reason-sel');
    if (!reason || !reason.value) return '非正常作业须选择原因';
    var abFrom = box.querySelector('.ab-from');
    var abTo = box.querySelector('.ab-to');
    var slotText = getSlotForCell(box);
    var perr = validatePeriod(slotText, abFrom && abFrom.value, abTo && abTo.value);
    if (perr) return perr;
    if (reason.value === '其他') {
      var remark = box.querySelector('.remark-inp');
      if (!remark || !String(remark.value || '').trim()) return '选择「其他」时必须填写备注';
    }
    return '';
  }

  function validateMatrix(root) {
    root = root || document;
    var cells = root.querySelectorAll('.matrix td .space-y-1, .matrix td > div');
    var msg = '';
    Array.prototype.some.call(cells, function (box) {
      if (!box.querySelector('.normal-flag')) return false;
      msg = validateCell(box);
      return !!msg;
    });
    return msg;
  }

  global.AbnormalFill = {
    REASONS: REASONS,
    reasonOptionsHtml: reasonOptionsHtml,
    toggleReason: toggleReason,
    onReasonChange: onReasonChange,
    validatePeriod: validatePeriod,
    validateCell: validateCell,
    validateMatrix: validateMatrix,
    parseSlot: parseSlot,
    syncRemarkRequired: syncRemarkRequired
  };

  /* 兼容行内 onchange="toggleReason(this)" */
  global.toggleReason = toggleReason;
  global.onReasonChange = onReasonChange;
})(window);
