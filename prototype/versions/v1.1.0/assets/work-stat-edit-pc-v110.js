(function () {
  var S = WorkStatSheetStore;
  var activeUnitId = '';
  var readonly = false;
  var cargoCtl = null;
  var editCargoCtl = null;
  var unitEditCargoCtl = null;
  var createVesselCtl = null;
  var unitEditVesselCtl = null;
  var rowEditVesselCtl = null;

  function showToast(msg, type) {
    type = type || 'ok';
    var el = document.createElement('div');
    el.className = 'toast fade-in px-4 py-3 text-sm text-white ' + (type === 'err' ? 'bg-red-500' : type === 'warn' ? 'bg-amber-500' : 'bg-emerald-500');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2600);
  }

  function statusClass(st) {
    if (st === '审批中') return 'badge-pending';
    if (st === '已驳回') return 'badge-reject';
    if (st === '已通过') return 'badge-ok';
    return 'badge-draft';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function syncMachine() {
    var berth = document.getElementById('fBerth').value;
    var mSel = document.getElementById('fMachine');
    var list = S.BERTH_MACHINES[berth] || [];
    mSel.innerHTML = list.map(function (m) { return '<option value="' + m + '">' + m + '</option>'; }).join('') || '<option value="">无</option>';
  }

  function initCreateFields() {
    document.getElementById('fBerth').innerHTML = Object.keys(S.BERTH_MACHINES).map(function (b) {
      return '<option value="' + b + '">' + b + '</option>';
    }).join('');
    syncMachine();
    document.getElementById('fDriver').innerHTML = S.DRIVERS.map(function (d) {
      return '<option value="' + d + '">' + d + '</option>';
    }).join('');
    cargoCtl = CargoCascade.bindPair(document.getElementById('fCargoL1'), document.getElementById('fCargoL2'), { entryMode: true, defaultL1: '散货', defaultL2: '氧化钙' });
    document.getElementById('editDriver').innerHTML = S.DRIVERS.map(function (d) { return '<option value="' + d + '">' + d + '</option>'; }).join('');
    editCargoCtl = CargoCascade.bindPair(document.getElementById('editCargoL1'), document.getElementById('editCargoL2'), { entryMode: true });
    document.getElementById('unitEditDriver').innerHTML = S.DRIVERS.map(function (d) { return '<option value="' + d + '">' + d + '</option>'; }).join('');
    unitEditCargoCtl = CargoCascade.bindPair(document.getElementById('unitEditCargoL1'), document.getElementById('unitEditCargoL2'), { entryMode: true });
    document.getElementById('editReason').innerHTML = '<option value="">请选择原因</option>' +
      (AbnormalFill.REASONS || []).map(function (x) { return '<option value="' + esc(x) + '">' + esc(x) + '</option>'; }).join('');
    createVesselCtl = VesselSearch.bind(document.getElementById('createVesselWrap'), { placeholder: '搜索确报/靠泊/开工船舶' });
    unitEditVesselCtl = VesselSearch.bind(document.getElementById('unitEditVesselWrap'), { placeholder: '搜索确报/靠泊/开工船舶' });
    rowEditVesselCtl = VesselSearch.bind(document.getElementById('rowEditVesselWrap'), { placeholder: '搜索确报/靠泊/开工船舶' });
  }

  window.toggleCreate = function (on) {
    if (on && readonly) { showToast('当前班次不可新增', 'err'); return; }
    if (on && createVesselCtl) createVesselCtl.clear();
    document.getElementById('createModal').classList.toggle('open', !!on);
  };

  function getDate() { return document.getElementById('hdrDate').value; }
  function getShift() { return document.getElementById('hdrShift').value; }

  function bootContext() {
    var range = S.dateRange();
    var dateEl = document.getElementById('hdrDate');
    dateEl.min = range.from;
    dateEl.max = range.to;
    var a = S.getActive();
    if (a && a.date && a.date >= range.from && a.date <= range.to) {
      dateEl.value = a.date;
      document.getElementById('hdrShift').value = a.shift || '白班';
      activeUnitId = a.unitId || '';
    } else {
      var pick = S.pickLatestEditable();
      if (pick) {
        dateEl.value = pick.date;
        document.getElementById('hdrShift').value = pick.shift;
        activeUnitId = (pick.units && pick.units[0]) ? pick.units[0].id : '';
      } else {
        dateEl.value = S.todayStr();
        document.getElementById('hdrShift').value = '白班';
        S.ensureSheet(S.todayStr(), '白班');
      }
    }
    S.setActive({ date: getDate(), shift: getShift(), unitId: activeUnitId });
  }

  window.onContextChange = function () {
    activeUnitId = '';
    S.setActive({ date: getDate(), shift: getShift(), unitId: '' });
    S.ensureSheet(getDate(), getShift());
    render();
  };

  window.createUnit = function () {
    var cargo = cargoCtl ? cargoCtl.getValue() : {};
    if (!cargo.l1 || !cargo.l2) { showToast('请选择货种', 'err'); return; }
    var vessel = createVesselCtl ? createVesselCtl.getValue() : {};
    if (!createVesselCtl || !createVesselCtl.validateRequired()) { showToast('请选择船舶', 'err'); createVesselCtl && createVesselCtl.focus(); return; }
    vessel = createVesselCtl.getValue();
    var res = S.createUnit({
      date: getDate(), shift: getShift(),
      berth: document.getElementById('fBerth').value,
      machine: document.getElementById('fMachine').value,
      driver: document.getElementById('fDriver').value,
      cargoL1: cargo.l1, cargoL2: cargo.l2,
      vesselId: vessel.vesselId, vesselName: vessel.vesselName
    });
    if (!res.ok) { showToast(res.msg, 'err'); if (res.existing) render(); return; }
    activeUnitId = res.unit.id;
    toggleCreate(false);
    showToast('已生成大表');
    render();
  };

  window.selectUnit = function (id) {
    activeUnitId = id;
    S.setActive({ date: getDate(), shift: getShift(), unitId: activeUnitId });
    render();
  };

  window.closeUnitEdit = function () { document.getElementById('unitEditModal').classList.remove('open'); };

  window.openUnitEdit = function (unitId) {
    if (readonly) { showToast('当前班次状态不可编辑机台表', 'err'); return; }
    var unit = S.findUnit(S.getSheet(getDate(), getShift()), unitId);
    if (!unit) return;
    document.getElementById('unitEditId').value = unitId;
    document.getElementById('unitEditBerth').value = unit.berth;
    document.getElementById('unitEditMachine').value = unit.machine;
    document.getElementById('unitEditDriver').value = unit.driver;
    unitEditCargoCtl.setValue(unit.cargoL1 || '', unit.cargoL2 || '');
    unitEditVesselCtl.setValue(unit.vesselId, unit.vesselName);
    document.getElementById('unitEditModal').classList.add('open');
  };

  window.saveUnitEdit = function () {
    var unitId = document.getElementById('unitEditId').value;
    var cargo = unitEditCargoCtl.getValue();
    if (!cargo.l1 || !cargo.l2) { showToast('请选择货种', 'err'); return; }
    var vessel = unitEditVesselCtl.getValue();
    if (!unitEditVesselCtl || !unitEditVesselCtl.validateRequired()) { showToast('请选择船舶', 'err'); return; }
    vessel = unitEditVesselCtl.getValue();
    var res = S.updateUnit(getDate(), getShift(), unitId, {
      driver: document.getElementById('unitEditDriver').value,
      cargoL1: cargo.l1, cargoL2: cargo.l2,
      vesselId: vessel.vesselId, vesselName: vessel.vesselName
    });
    if (!res.ok) { showToast(res.msg, 'err'); return; }
    closeUnitEdit();
    activeUnitId = unitId;
    showToast('机台表已更新');
    render();
  };

  window.deleteUnitConfirm = function (unitId) {
    if (readonly) { showToast('当前班次状态不可删除机台表', 'err'); return; }
    var unit = S.findUnit(S.getSheet(getDate(), getShift()), unitId);
    if (!unit) return;
    if (S.unitHasSentRows(unit)) { showToast('该机台表含已推送企微的行，不可删除', 'err'); return; }
    if (!confirm('确认删除该机台表？\n' + unit.berth + ' · ' + unit.machine)) return;
    var res = S.deleteUnit(getDate(), getShift(), unitId);
    if (!res.ok) { showToast(res.msg, 'err'); return; }
    if (activeUnitId === unitId) activeUnitId = '';
    showToast('已删除机台表');
    render();
  };

  function validateRows(rows) {
    var errors = [];
    rows.forEach(function (r, i) {
      if (!r.normal) {
        if (!r.reason) errors.push('第 ' + (i + 1) + ' 行（' + r.slot + '）非正常须选择原因');
        if (r.abMins == null || isNaN(r.abMins) || r.abMins <= 0) errors.push('第 ' + (i + 1) + ' 行请填写非正常时长');
        if (r.reason === '其他' && !r.remark) errors.push('第 ' + (i + 1) + ' 行选「其他」须填备注');
      }
      if (r.qty < 0) errors.push('第 ' + (i + 1) + ' 行作业量不能为负');
    });
    return errors;
  }

  window.submitCurrent = function () {
    if (readonly) { showToast('当前状态不可提交', 'err'); return; }
    var sheet = S.getSheet(getDate(), getShift());
    if (!sheet || !sheet.units.length) { showToast('请先新增至少一张机台大表', 'err'); toggleCreate(true); return; }
    var allRows = [];
    sheet.units.forEach(function (u) { (u.rows || []).forEach(function (r) { allRows.push(r); }); });
    var errs = validateRows(allRows);
    if (errs.length) { showToast(errs[0], 'err'); return; }
    if (!confirm('确认提交本班审批？\n' + getDate() + ' · ' + getShift())) return;
    var res = S.submitSheet(getDate(), getShift());
    if (!res.ok) { showToast(res.msg, 'err'); return; }
    showToast('已提交本班，请到「作业记录」审批');
    setTimeout(function () { location.href = 'work-stat-records-pc.html'; }, 700);
  };

  function reasonOptionsHtml(selected) {
    var opts = '<option value="">请选择原因</option>';
    (AbnormalFill.REASONS || []).forEach(function (x) {
      opts += '<option value="' + esc(x) + '"' + (selected === x ? ' selected' : '') + '>' + esc(x) + '</option>';
    });
    return opts;
  }

  window.onInlineNormalChange = function (slot, el) {
    var no = el.value === 'no';
    var tr = el.closest('tr');
    if (!tr) return;
    var reasonEl = tr.querySelector('[data-field="reason"]');
    var minsEl = tr.querySelector('[data-field="abMins"]');
    if (reasonEl) { reasonEl.disabled = !no; if (!no) reasonEl.value = ''; }
    if (minsEl) { minsEl.disabled = !no; if (!no) minsEl.value = ''; }
    saveInlineRow(slot, true);
  };

  window.saveInlineRow = function (slot, fromNormal) {
    if (readonly || !activeUnitId) return;
    var unit = S.findUnit(S.getSheet(getDate(), getShift()), activeUnitId);
    if (!unit) return;
    var row = null;
    for (var i = 0; i < (unit.rows || []).length; i++) {
      if (unit.rows[i].slot === slot) { row = unit.rows[i]; break; }
    }
    if (!row || row.wecomSent) return;
    var tr = document.querySelector('#matrixBody tr[data-slot="' + slot + '"]');
    if (!tr) return;
    var qtyEl = tr.querySelector('[data-field="qty"]');
    var normalEl = tr.querySelector('[data-field="normal"]');
    var reasonEl = tr.querySelector('[data-field="reason"]');
    var minsEl = tr.querySelector('[data-field="abMins"]');
    var remarkEl = tr.querySelector('[data-field="remark"]');
    var normal = normalEl && normalEl.value === 'yes';
    var abRaw = minsEl ? String(minsEl.value || '').trim() : '';
    var patch = {
      qty: qtyEl ? (Number(qtyEl.value) || 0) : 0,
      normal: normal,
      reason: normal ? '' : (reasonEl ? reasonEl.value || '' : ''),
      abMins: normal || abRaw === '' ? null : Number(abRaw),
      remark: remarkEl ? String(remarkEl.value || '').trim() : ''
    };
    if (patch.qty < 0) { showToast('作业量不能为负', 'err'); return; }
    var res = S.updateRow(getDate(), getShift(), activeUnitId, slot, patch);
    if (!res.ok) { showToast(res.msg, 'err'); return; }
    document.getElementById('unitTotal').textContent = S.unitTotal(S.findUnit(S.getSheet(getDate(), getShift()), activeUnitId)).toFixed(2);
    document.getElementById('sheetTotal').textContent = S.sheetTotal(S.getSheet(getDate(), getShift())).toFixed(2);
    if (fromNormal) renderTable(S.findUnit(S.getSheet(getDate(), getShift()), activeUnitId));
  };

  window.toggleRowEditAbnormal = function () {
    var no = document.getElementById('editNormal').value === 'no';
    document.getElementById('editReason').disabled = !no;
    document.getElementById('editAbMins').disabled = !no;
    if (!no) { document.getElementById('editReason').value = ''; document.getElementById('editAbMins').value = ''; }
  };

  window.clearRowVesselOverride = function () {
    if (rowEditVesselCtl) rowEditVesselCtl.clear();
  };

  window.closeRowEdit = function () { document.getElementById('rowEditModal').classList.remove('open'); };

  window.openRowEdit = function (slot) {
    if (readonly) { showToast('当前班次状态不可编辑', 'err'); return; }
    var unit = S.findUnit(S.getSheet(getDate(), getShift()), activeUnitId);
    if (!unit) return;
    var row = null;
    for (var i = 0; i < (unit.rows || []).length; i++) {
      if (unit.rows[i].slot === slot) { row = unit.rows[i]; break; }
    }
    if (!row || row.wecomSent) { showToast('已推送企微，不可再修改', 'err'); return; }
    document.getElementById('editSlot').value = slot;
    document.getElementById('editSlotDisplay').value = slot;
    document.getElementById('rowEditSub').textContent = getDate() + ' · ' + getShift() + ' · ' + unit.berth + ' / ' + unit.machine;
    document.getElementById('editBerth').value = unit.berth;
    document.getElementById('editMachine').value = unit.machine;
    document.getElementById('rowEditUnitVessel').textContent = unit.vesselName || '—';
    document.getElementById('editDriver').value = row.driver || unit.driver;
    editCargoCtl.setValue(row.cargoL1 || unit.cargoL1 || '', row.cargoL2 || unit.cargoL2 || '');
    if (S.rowHasVesselOverride(row)) rowEditVesselCtl.setValue(row.vesselId, row.vesselName);
    else rowEditVesselCtl.clear();
    document.getElementById('editQty').value = Number(row.qty) || 0;
    document.getElementById('editNormal').value = row.normal === false ? 'no' : 'yes';
    document.getElementById('editReason').value = row.reason || '';
    document.getElementById('editAbMins').value = row.abMins != null ? row.abMins : '';
    document.getElementById('editRemark').value = row.remark || '';
    toggleRowEditAbnormal();
    document.getElementById('rowEditModal').classList.add('open');
  };

  window.saveRowEdit = function () {
    var slot = document.getElementById('editSlot').value;
    var cargo = editCargoCtl.getValue();
    if (!cargo.l1 || !cargo.l2) { showToast('请选择货种', 'err'); return; }
    var normal = document.getElementById('editNormal').value === 'yes';
    var abRaw = String(document.getElementById('editAbMins').value || '').trim();
    var vessel = rowEditVesselCtl.getValue();
    var patch = {
      driver: document.getElementById('editDriver').value,
      cargoL1: cargo.l1, cargoL2: cargo.l2,
      qty: Number(document.getElementById('editQty').value) || 0,
      normal: normal,
      reason: normal ? '' : document.getElementById('editReason').value,
      abMins: normal || abRaw === '' ? null : Number(abRaw),
      remark: String(document.getElementById('editRemark').value || '').trim(),
      vesselId: vessel.vesselId || '',
      vesselName: vessel.vesselName || ''
    };
    var res = S.updateRow(getDate(), getShift(), activeUnitId, slot, patch);
    if (!res.ok) { showToast(res.msg, 'err'); return; }
    closeRowEdit();
    showToast('已保存时段行');
    render();
  };

  window.sendRow = function (slot) {
    saveInlineRow(slot, false);
    var unit = S.findUnit(S.getSheet(getDate(), getShift()), activeUnitId);
    if (!unit) return;
    var row = null;
    for (var i = 0; i < (unit.rows || []).length; i++) {
      if (unit.rows[i].slot === slot) { row = unit.rows[i]; break; }
    }
    if (!row || row.wecomSent) { showToast('该行已推送企微', 'warn'); return; }
    var errs = validateRows([row]);
    if (errs.length) { showToast(errs[0], 'err'); return; }
    if (!confirm('确认将此时段数据推送到企微？\n' + slot)) return;
    var res = S.sendRowWecom(getDate(), getShift(), activeUnitId, slot);
    if (!res.ok) { showToast(res.msg, 'err'); return; }
    var vessel = S.resolveVessel(unit, row);
    if (typeof WecomPush !== 'undefined' && WecomPush.notifyAfterSave) {
      WecomPush.notifyAfterSave({
        slot: slot,
        berth: unit.berth,
        machine: unit.machine,
        driver: row.driver || unit.driver,
        vesselName: vessel.name,
        qty: row.qty
      }, 'push');
    }
    showToast(res.msg || '已推送企微并保存');
    render();
  };

  function renderHeaderOnly() {
    var sheet = S.getSheet(getDate(), getShift()) || S.ensureSheet(getDate(), getShift());
    var st = sheet.status || '草稿';
    var stEl = document.getElementById('sheetStatus');
    stEl.textContent = st;
    stEl.className = 'badge ' + statusClass(st);
    document.getElementById('sheetTotal').textContent = S.sheetTotal(sheet).toFixed(2);
    readonly = st === '审批中' || st === '已通过';
    document.getElementById('btnSubmit').classList.toggle('hidden', readonly);
    document.getElementById('btnShowCreate').classList.toggle('opacity-50', readonly);
  }

  function render() {
    var sheet = S.getSheet(getDate(), getShift()) || S.ensureSheet(getDate(), getShift());
    renderHeaderOnly();
    var tabs = document.getElementById('unitTabs');
    var empty = document.getElementById('unitEmpty');
    if (!sheet.units.length) {
      tabs.innerHTML = '';
      empty.classList.remove('hidden');
      document.getElementById('tableCard').classList.add('hidden');
      toggleCreate(true);
      return;
    }
    empty.classList.add('hidden');
    if (!activeUnitId || !S.findUnit(sheet, activeUnitId)) activeUnitId = sheet.units[0].id;
    tabs.innerHTML = sheet.units.map(function (u) {
      var active = u.id === activeUnitId ? ' active' : '';
      var hasSent = S.unitHasSentRows(u);
      var ops = !readonly ? '<div class="unit-tab-actions">' +
        '<button type="button" class="op-link" onclick="event.stopPropagation();openUnitEdit(\'' + u.id + '\')">编辑</button>' +
        '<button type="button" class="op-link op-del" onclick="event.stopPropagation();deleteUnitConfirm(\'' + u.id + '\')"' +
        (hasSent ? ' disabled' : '') + '>删除</button></div>' : '';
      return '<div class="unit-tab' + active + '" onclick="selectUnit(\'' + u.id + '\')">' +
        '<div class="font-medium">' + esc(u.berth) + ' · ' + esc(u.machine) + '</div>' +
        '<div class="text-xs opacity-80 mt-0.5">' + esc(u.vesselName || '—') + '</div>' + ops + '</div>';
    }).join('');
    var unit = S.findUnit(sheet, activeUnitId);
    activeUnitId = unit.id;
    S.setActive({ date: getDate(), shift: getShift(), unitId: activeUnitId });
    renderTable(unit);
  }

  function renderTable(unit) {
    document.getElementById('tableCard').classList.remove('hidden');
    var uv = S.resolveVessel(unit, null);
    document.getElementById('tableTitle').innerHTML =
      esc(unit.berth) + ' · ' + esc(unit.machine) + ' · <span class="text-teal-800">' + esc(uv.name || '—') + '</span>' +
      (!readonly ? ' <button type="button" class="op-link ml-2" onclick="openUnitEdit(\'' + unit.id + '\')">编辑机台表</button>' : '');
    document.getElementById('unitTotal').textContent = S.unitTotal(unit).toFixed(2);
    document.getElementById('matrixBody').innerHTML = (unit.rows || []).map(function (r) {
      var sent = !!r.wecomSent;
      var locked = readonly || sent;
      var rv = S.resolveVessel(unit, r);
      var vesselLabel = rv.name || '—';
      if (S.rowHasVesselOverride(r)) vesselLabel += ' *';
      var driver = r.driver || unit.driver || '—';
      var cargo = r.cargoL2 || unit.cargoL2 || '—';
      var isAbnormal = r.normal === false;
      var slotJs = String(r.slot).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      var ops = '';
      if (!locked) ops += '<button type="button" class="op-link" onclick="openRowEdit(\'' + slotJs + '\')">编辑</button>';
      if (!readonly && !sent) ops += '<button type="button" class="op-link danger" onclick="sendRow(\'' + slotJs + '\')">发送</button>';
      else if (sent) ops += '<span class="text-slate-400 text-xs">已锁定</span>';

      function cellInput(field, html) {
        return locked ? '<td class="text-slate-600">' + html + '</td>' :
          '<td>' + html + '</td>';
      }
      var qtyCell = locked
        ? cellInput('qty', (Number(r.qty) || 0).toFixed(2))
        : '<td><input data-field="qty" type="number" step="0.01" min="0" value="' + (Number(r.qty) || 0).toFixed(2) + '" onchange="saveInlineRow(\'' + slotJs + '\')" /></td>';
      var normalCell = locked
        ? '<td>' + (isAbnormal ? '非正常' : '正常') + '</td>'
        : '<td><select data-field="normal" onchange="onInlineNormalChange(\'' + slotJs + '\', this)"><option value="yes"' + (!isAbnormal ? ' selected' : '') + '>正常</option><option value="no"' + (isAbnormal ? ' selected' : '') + '>非正常</option></select></td>';
      var reasonCell = locked
        ? '<td class="text-slate-600">' + esc(isAbnormal ? (r.reason || '—') : '—') + '</td>'
        : '<td><select data-field="reason"' + (!isAbnormal ? ' disabled' : '') + ' onchange="saveInlineRow(\'' + slotJs + '\')">' + reasonOptionsHtml(isAbnormal ? (r.reason || '') : '') + '</select></td>';
      var minsVal = isAbnormal && r.abMins != null ? r.abMins : '';
      var minsCell = locked
        ? '<td class="text-slate-600">' + esc(isAbnormal && r.abMins != null ? (r.abMins + ' 分钟') : '—') + '</td>'
        : '<td><input data-field="abMins" type="number" min="1" max="60"' + (!isAbnormal ? ' disabled' : '') + ' value="' + esc(minsVal) + '" onchange="saveInlineRow(\'' + slotJs + '\')" /></td>';
      var remarkCell = locked
        ? '<td class="text-slate-600">' + esc(r.remark || '—') + '</td>'
        : '<td><input data-field="remark" type="text" value="' + esc(r.remark || '') + '" onchange="saveInlineRow(\'' + slotJs + '\')" /></td>';

      return '<tr data-slot="' + esc(r.slot) + '">' +
        '<td class="sticky-col font-medium">' + esc(r.slot) + '</td>' +
        '<td class="text-slate-500">' + esc(unit.machine) + '</td>' +
        '<td class="text-teal-800 text-xs">' + esc(vesselLabel) + '</td>' +
        '<td>' + esc(driver) + '</td><td>' + esc(cargo) + '</td>' +
        qtyCell + normalCell + reasonCell + minsCell + remarkCell +
        '<td>' + (sent ? '<span class="badge badge-sent">已推送</span>' : '<span class="text-slate-400 text-xs">未推送</span>') + '</td>' +
        '<td class="whitespace-nowrap">' + ops + '</td></tr>';
    }).join('');
  }

  initCreateFields();
  bootContext();
  render();
  window.addEventListener('storage', function (e) {
    if (e.key === 'tosWorkStatSheets_v6') render();
  });
})();
