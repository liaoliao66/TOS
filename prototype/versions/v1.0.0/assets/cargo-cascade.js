/**
 * 货种二级级联（一级大类 → 二级货种）
 * - 数据源优先：系统配置 · 货种配置（CargoMgmtDemo）
 * - 无配置时回退内置演示树
 */
(function (global) {
  var FALLBACK = [
    { name: '吨包袋', children: ['工铵吨包', '吨包'] },
    {
      name: '散货',
      children: ['二氢钾', '氧化钙', '氮磷肥', '硫矿', '硫磺', '磷矿', '磷酸二氢氨', '脱硫石膏']
    }
  ];

  function treeFromRealDemo() {
    var D = global.RealWorkStatDemo;
    if (!D || !D.meta || !D.meta.cargos || !D.meta.cargos.length) return null;
    var meta = D.meta;
    var l1map = meta.l1_map || {};
    var byL1 = {};
    meta.cargos.forEach(function (c) {
      var l1 = l1map[c] || '散货';
      if (!byL1[l1]) byL1[l1] = [];
      byL1[l1].push(c);
    });
    var order = ['吨包袋', '散货'];
    return Object.keys(byL1).sort(function (a, b) {
      var ia = order.indexOf(a);
      var ib = order.indexOf(b);
      if (ia < 0) ia = 99;
      if (ib < 0) ib = 99;
      return ia - ib || a.localeCompare(b, 'zh-CN');
    }).map(function (k) {
      return { name: k, children: byL1[k] };
    });
  }

  function getTree() {
    var demoTree = treeFromRealDemo();
    if (demoTree && demoTree.length) return demoTree;
    if (global.CargoMgmtDemo && CargoMgmtDemo.cascadeTree) {
      try {
        var t = CargoMgmtDemo.cascadeTree();
        if (t && t.length) return t;
      } catch (e) {}
    }
    return FALLBACK;
  }

  function parentOf(l2) {
    var TREE = getTree();
    for (var i = 0; i < TREE.length; i++) {
      if (TREE[i].children.indexOf(l2) >= 0) return TREE[i].name;
    }
    return '';
  }

  function childrenOf(l1) {
    var TREE = getTree();
    for (var i = 0; i < TREE.length; i++) {
      if (TREE[i].name === l1) return TREE[i].children.slice();
    }
    return [];
  }

  function filterTree(l1Filter) {
    var TREE = getTree();
    if (l1Filter == null) return TREE.slice();
    if (!l1Filter.length) return [];
    return TREE.filter(function (g) { return l1Filter.indexOf(g.name) >= 0; });
  }

  /**
   * @param {HTMLSelectElement} l1Sel
   * @param {HTMLSelectElement} l2Sel
   * @param {object} opts
   *   allowAll / entryMode / defaultL1 / defaultL2 / l1Filter / onChange
   */
  function bindPair(l1Sel, l2Sel, opts) {
    opts = opts || {};
    var allowAll = !!opts.allowAll;
    var entryMode = !!opts.entryMode;
    var l1Filter = opts.l1Filter || null;
    var onChange = typeof opts.onChange === 'function' ? opts.onChange : function () {};

    function emit() {
      onChange({ l1: l1Sel.value, l2: l2Sel.value });
    }

    function buildL1() {
      var html = '';
      if (allowAll) html += '<option value="全部">全部</option>';
      if (entryMode) html += '<option value="">请选择一级</option>';
      var groups = filterTree(l1Filter);
      if (!groups.length && entryMode) {
        html = '<option value="">当前泊位无可选货种大类</option>';
      } else {
        groups.forEach(function (g) {
          html += '<option value="' + g.name + '">' + g.name + '</option>';
        });
      }
      l1Sel.innerHTML = html;
    }

    function buildL2(prefer) {
      var l1 = l1Sel.value;
      var html = '';
      if (allowAll) {
        if (l1 === '全部' || !l1) {
          l2Sel.innerHTML = '<option value="全部">全部</option>';
          l2Sel.value = '全部';
          return;
        }
        html = '<option value="全部">全部</option>';
        childrenOf(l1).forEach(function (c) {
          html += '<option value="' + c + '">' + c + '</option>';
        });
        l2Sel.innerHTML = html;
        if (prefer && prefer !== '全部' && childrenOf(l1).indexOf(prefer) >= 0) l2Sel.value = prefer;
        else l2Sel.value = '全部';
        return;
      }
      if (entryMode) {
        if (!l1) {
          l2Sel.innerHTML = '<option value="">请先选一级</option>';
          return;
        }
        html = '<option value="">请选择货种</option>';
        childrenOf(l1).forEach(function (c) {
          html += '<option value="' + c + '">' + c + '</option>';
        });
        l2Sel.innerHTML = html;
        if (prefer && childrenOf(l1).indexOf(prefer) >= 0) l2Sel.value = prefer;
        return;
      }
      childrenOf(l1).forEach(function (c) {
        html += '<option value="' + c + '">' + c + '</option>';
      });
      l2Sel.innerHTML = html;
      if (prefer && childrenOf(l1).indexOf(prefer) >= 0) l2Sel.value = prefer;
      else if (l2Sel.options.length) l2Sel.selectedIndex = 0;
    }

    buildL1();
    var d1 = opts.defaultL1;
    var d2 = opts.defaultL2;
    if (opts.presetL2 && parentOf(opts.presetL2)) {
      d1 = parentOf(opts.presetL2);
      d2 = opts.presetL2;
    }
    if (d1 && Array.prototype.some.call(l1Sel.options, function (o) { return o.value === d1; })) {
      l1Sel.value = d1;
    } else if (allowAll) {
      l1Sel.value = '全部';
    } else if (entryMode) {
      l1Sel.value = '';
    } else {
      l1Sel.value = '散货';
    }
    buildL2(d2 || (allowAll ? '全部' : ''));

    l1Sel.onchange = function () {
      buildL2(allowAll ? '全部' : '');
      emit();
    };
    l2Sel.onchange = function () { emit(); };

    return {
      getValue: function () { return { l1: l1Sel.value, l2: l2Sel.value }; },
      setValue: function (l1, l2) {
        if (l1 != null) l1Sel.value = l1;
        buildL2(l2);
        emit();
      },
      setL1Filter: function (names) {
        if (names == null) l1Filter = null;
        else l1Filter = names.slice();
        var keep = l1Sel.value;
        buildL1();
        if (keep && Array.prototype.some.call(l1Sel.options, function (o) { return o.value === keep; })) {
          l1Sel.value = keep;
        } else if (allowAll) {
          l1Sel.value = '全部';
        } else {
          l1Sel.value = '';
        }
        buildL2('');
        emit();
      }
    };
  }

  function upgradeLegacySelects(root) {
    root = root || document;
    var selects = root.querySelectorAll('select');
    Array.prototype.forEach.call(selects, function (sel) {
      if (sel.getAttribute('data-cargo-upgraded')) return;
      if (!sel.options.length) return;
      if (sel.options[0].textContent.trim() !== '货种') return;

      var selected = '';
      Array.prototype.forEach.call(sel.options, function (o) {
        if (o.selected && o.textContent.trim() !== '货种') selected = o.textContent.trim();
      });
      if (selected && !parentOf(selected)) selected = '';

      var disabled = !!sel.disabled;
      var cls = (sel.className || 'w-full border border-slate-200 rounded-lg px-1 py-1') + '';
      var wrap = document.createElement('div');
      wrap.className = 'cargo-cascade space-y-1';
      var l1 = document.createElement('select');
      var l2 = document.createElement('select');
      l1.className = cls.replace(/\bcargo-l[12]\b/g, '') + ' cargo-l1';
      l2.className = cls.replace(/\bcargo-l[12]\b/g, '') + ' cargo-l2';
      l1.disabled = disabled;
      l2.disabled = disabled;
      sel.setAttribute('data-cargo-upgraded', '1');
      sel.style.display = 'none';
      sel.parentNode.insertBefore(wrap, sel);
      wrap.appendChild(l1);
      wrap.appendChild(l2);

      bindPair(l1, l2, {
        entryMode: true,
        presetL2: selected || undefined,
        defaultL1: selected ? parentOf(selected) : '',
        defaultL2: selected || '',
        onChange: function (v) {
          if (v.l2) {
            var found = false;
            Array.prototype.forEach.call(sel.options, function (o) {
              if (o.textContent.trim() === v.l2) { o.selected = true; found = true; }
            });
            if (!found) {
              var opt = document.createElement('option');
              opt.value = v.l2;
              opt.textContent = v.l2;
              opt.selected = true;
              sel.appendChild(opt);
            }
          } else {
            sel.selectedIndex = 0;
          }
        }
      });
    });
  }

  global.CargoCascade = {
    get TREE() { return getTree(); },
    parentOf: parentOf,
    childrenOf: childrenOf,
    bindPair: bindPair,
    upgradeLegacySelects: upgradeLegacySelects
  };
})(window);
