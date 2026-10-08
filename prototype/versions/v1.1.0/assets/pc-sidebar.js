/**
 * PC 侧栏菜单（v1.1.0）· 仅本版范围
 * 用法：<nav id="pcSidebarNav" data-active="fill-shift"></nav>
 *
 * data-active: fill-shift | fill-records | fill-stoppage
 */
(function () {
  function link(href, icon, label, active, indent) {
    var base = indent
      ? 'flex items-center gap-2 pl-10 pr-3 py-2 rounded-xl text-sm '
      : 'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm ';
    var state = active
      ? 'bg-slate-700 text-white'
      : 'text-slate-300 hover:bg-slate-700 hover:text-white';
    return '<a href="' + href + '" class="' + base + state + '">' +
      '<i class="' + icon + ' w-5 text-center text-xs"></i><span>' + label + '</span></a>';
  }

  function group(title) {
    return '<div class="px-4 pt-3 pb-1 text-[11px] tracking-wide text-slate-500">' + title + '</div>';
  }

  function render(active) {
    var html = '';
    html += group('作业管理');
    html += link('work-stat-edit-pc.html', 'fa-solid fa-table', '工班作业', active === 'fill-shift', true);
    html += link('work-stat-records-pc.html', 'fa-solid fa-clipboard-check', '作业记录', active === 'fill-records', true);
    html += link('work-stat-stoppage-pc.html', 'fa-solid fa-pause', '停工记录', active === 'fill-stoppage', true);
    return html;
  }

  function mount() {
    var el = document.getElementById('pcSidebarNav');
    if (!el) return;
    var active = el.getAttribute('data-active') || '';
    el.innerHTML = render(active);
  }

  window.renderPcSidebar = mount;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
