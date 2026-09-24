/**

 * 船舶可搜索下拉（原型）· 数据来自 ShipOpsDemo（确报 / 靠泊 / 开工）

 */

(function (global) {

  var PRIORITY = { working: 3, berthed: 2, confirmed: 1 };

  var EMPTY_MSG = '暂无确报、靠泊或开工船舶';

  var DEFAULT_PLACEHOLDER = '搜索确报/靠泊/开工船舶';



  function esc(s) {

    return String(s == null ? '' : s)

      .replace(/&/g, '&amp;')

      .replace(/</g, '&lt;')

      .replace(/"/g, '&quot;');

  }



  function opsReady() {

    return typeof global.ShipOpsDemo !== 'undefined' &&

      typeof ShipOpsDemo.listSchedules === 'function' &&

      typeof ShipOpsDemo.listDispatches === 'function';

  }



  function rawCandidates() {

    if (!opsReady()) return [];

    var out = [];

    ShipOpsDemo.listSchedules('confirmed').forEach(function (sch) {

      var name = String(sch.shipName || '').trim();

      if (!name) return;

      out.push({

        id: 'sch:' + sch.id,

        nameCn: name,

        sourceStatusLabel: '确报',

        _rank: PRIORITY.confirmed

      });

    });

    ShipOpsDemo.listDispatches('berthed').forEach(function (dsp) {

      var name = String(dsp.shipName || '').trim();

      if (!name) return;

      out.push({

        id: 'dsp:' + dsp.id,

        nameCn: name,

        sourceStatusLabel: '靠泊',

        _rank: PRIORITY.berthed

      });

    });

    ShipOpsDemo.listDispatches('working').forEach(function (dsp) {

      var name = String(dsp.shipName || '').trim();

      if (!name) return;

      out.push({

        id: 'dsp:' + dsp.id,

        nameCn: name,

        sourceStatusLabel: '开工',

        _rank: PRIORITY.working

      });

    });

    return out;

  }



  function listCandidates() {

    var byName = {};

    rawCandidates().forEach(function (c) {

      var key = c.nameCn;

      var prev = byName[key];

      if (!prev || c._rank > prev._rank) {

        byName[key] = c;

      }

    });

    return Object.keys(byName).map(function (k) {

      var item = byName[k];

      return {

        id: item.id,

        nameCn: item.nameCn,

        sourceStatusLabel: item.sourceStatusLabel

      };

    }).sort(function (a, b) { return a.nameCn.localeCompare(b.nameCn, 'zh-CN'); });

  }



  function findCandidate(id, nameCn) {

    var list = listCandidates();

    var idStr = String(id || '').trim();

    if (idStr) {

      var hit = list.filter(function (x) { return x.id === idStr; })[0];

      if (hit) return hit;

      if (idStr.indexOf(':') < 0) {

        hit = list.filter(function (x) {

          return x.id === 'sch:' + idStr || x.id === 'dsp:' + idStr;

        })[0];

        if (hit) return hit;

      }

    }

    var name = String(nameCn || '').trim();

    if (name) {

      return list.filter(function (x) { return x.nameCn === name; })[0] || null;

    }

    return null;

  }



  function filterShips(q) {

    var query = String(q || '').trim().toLowerCase();

    var ships = listCandidates();

    if (!query) return ships.slice(0, 20);

    return ships.filter(function (s) {

      return s.nameCn.toLowerCase().indexOf(query) >= 0;

    }).slice(0, 20);

  }



  /**

   * @param {HTMLElement} wrap 容器（需 position:relative）

   * @param {object} opts { inputId, idHiddenId, nameHiddenId, placeholder, onChange }

   */

  function bind(wrap, opts) {

    opts = opts || {};

    if (!wrap) return null;

    wrap.classList.add('vessel-search-wrap');

    if (!wrap.style.position) wrap.style.position = 'relative';



    var input = document.createElement('input');

    input.type = 'text';

    input.autocomplete = 'off';

    input.placeholder = opts.placeholder || DEFAULT_PLACEHOLDER;

    input.className = opts.inputClass || '';

    input.style.cssText = 'width:100%;border:1px solid #e2e8f0;border-radius:12px;padding:8px 10px;font-size:14px;background:#fff;box-sizing:border-box;';

    if (opts.inputId) input.id = opts.inputId;



    var idHidden = document.createElement('input');

    idHidden.type = 'hidden';

    if (opts.idHiddenId) idHidden.id = opts.idHiddenId;



    var nameHidden = document.createElement('input');

    nameHidden.type = 'hidden';

    if (opts.nameHiddenId) nameHidden.id = opts.nameHiddenId;



    var drop = document.createElement('div');

    drop.className = 'vessel-search-drop';

    drop.style.cssText = 'display:none;position:absolute;left:0;right:0;top:100%;margin-top:4px;max-height:220px;overflow-y:auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 8px 24px rgba(15,23,42,.12);z-index:40;';



    wrap.innerHTML = '';

    wrap.appendChild(input);

    wrap.appendChild(idHidden);

    wrap.appendChild(nameHidden);

    wrap.appendChild(drop);



    function closeDrop() { drop.style.display = 'none'; }



    function pick(ship) {

      idHidden.value = ship.id || '';

      nameHidden.value = ship.nameCn;

      input.value = ship.nameCn;

      closeDrop();

      if (typeof opts.onChange === 'function') opts.onChange(ship);

    }



    function renderDrop() {

      var all = listCandidates();

      if (!all.length) {

        drop.innerHTML = '<div style="padding:10px 12px;font-size:13px;color:#94a3b8;">' + esc(EMPTY_MSG) + '</div>';

        drop.style.display = 'block';

        return;

      }

      var items = filterShips(input.value);

      if (!items.length) {

        drop.innerHTML = '<div style="padding:10px 12px;font-size:13px;color:#94a3b8;">无匹配船舶</div>';

        drop.style.display = 'block';

        return;

      }

      drop.innerHTML = items.map(function (s) {

        return '<button type="button" class="vessel-search-item" data-id="' + esc(s.id) + '" style="display:block;width:100%;text-align:left;border:0;background:#fff;padding:10px 12px;font-size:13px;cursor:pointer;border-bottom:1px solid #f1f5f9;">' +

          '<div style="font-weight:500;color:#0f172a;">' + esc(s.nameCn) + '</div>' +

        '</button>';

      }).join('');

      drop.style.display = 'block';

      drop.querySelectorAll('.vessel-search-item').forEach(function (btn) {

        btn.onmousedown = function (e) { e.preventDefault(); };

        btn.onclick = function () {

          var id = btn.getAttribute('data-id');

          var ship = listCandidates().filter(function (x) { return x.id === id; })[0];

          if (ship) pick(ship);

        };

      });

    }



    input.addEventListener('focus', renderDrop);

    input.addEventListener('input', function () {

      idHidden.value = '';

      nameHidden.value = '';

      renderDrop();

    });

    input.addEventListener('blur', function () {

      setTimeout(closeDrop, 150);

    });



    document.addEventListener('click', function (e) {

      if (!wrap.contains(e.target)) closeDrop();

    });



    return {

      getValue: function () {

        return { vesselId: idHidden.value || '', vesselName: nameHidden.value || '' };

      },

      setValue: function (id, name) {

        var ship = findCandidate(id, name);

        idHidden.value = ship ? ship.id : (id || '');

        nameHidden.value = ship ? ship.nameCn : (name || '');

        input.value = nameHidden.value;

      },

      clear: function () {

        idHidden.value = '';

        nameHidden.value = '';

        input.value = '';

      },

      validateRequired: function () {

        return !!String(nameHidden.value || '').trim();

      },

      focus: function () { input.focus(); }

    };

  }



  global.VesselSearch = {

    listCandidates: listCandidates,

    filterShips: filterShips,

    bind: bind

  };

})(window);


