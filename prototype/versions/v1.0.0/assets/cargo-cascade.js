/**
 * 货种二级级联（对齐字典：一级大类 → 二级货种）
 */
(function (global) {
  var TREE = [
    { name: '吨包袋', children: ['磷肥', '工铵吨包'] },
    { name: '散货', children: ['氧化钙', '氮磷肥', '硫矿'] }
  ];

  function parentOf(l2) {
    for (var i = 0; i < TREE.length; i++) {
      if (TREE[i].children.indexOf(l2) >= 0) return TREE[i].name;
    }
    return '';
  }

  function childrenOf(l1) {
    for (var i = 0; i < TREE.length; i++) {
      if (TREE[i].name === l1) return TREE[i].children.slice();
    }
    return [];
  }

  /**
   * @param {HTMLSelectElement} l1Sel
   * @param {HTMLSelectElement} l2Sel
   * @param {object} opts
   *   allowAll: 筛选场景，一级/二级可「全部」；一级=全部时二级仅「全部」
   *   entryMode: 录入场景，无「全部」，空值为请选择
   *   defaultL1 / defaultL2
   *   onChange({l1,l2})
   */
  function bindPair(l1Sel, l2Sel, opts) {
    opts = opts || {};
    var allowAll = !!opts.allowAll;
    var entryMode = !!opts.entryMode;
    var onChange = typeof opts.onChange === 'function' ? opts.onChange : function () {};

    function emit() {
      onChange({ l1: l1Sel.value, l2: l2Sel.value });
    }

    function buildL1() {
      var html = '';
      if (allowAll) html += '<option value="全部">全部</option>';
      if (entryMode) html += '<option value="">请选择一级</option>';
      TREE.forEach(function (g) {
        html += '<option value="' + g.name + '">' + g.name + '</option>';
      });
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
      /* 必选单货种（效率对比） */
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
    buildL2(d2 || (allowAll ? '全部' : '氧化钙'));

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
          /* 回写隐藏旧 select，兼容可能读取逻辑 */
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

  global.CARGO_TREE = TREE;
  global.CargoCascade = {
    TREE: TREE,
    parentOf: parentOf,
    childrenOf: childrenOf,
    bindPair: bindPair,
    upgradeLegacySelects: upgradeLegacySelects
  };
})(window);
