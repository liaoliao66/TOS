/**
 * v1.2.0 PC 侧栏：仅作业效率三页
 * data-active: efficiency-master | efficiency-volume | efficiency-ship
 */
(function () {
  function link(href, icon, label, active) {
    var state = active
      ? 'bg-slate-700 text-white'
      : 'text-slate-300 hover:bg-slate-700 hover:text-white';
    return '<a href="' + href + '" class="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm ' + state + '">' +
      '<i class="' + icon + ' w-5 text-center text-xs"></i><span>' + label + '</span></a>';
  }

  function group(title) {
    return '<div class="px-4 pt-3 pb-1 text-[11px] tracking-wide text-slate-500">' + title + '</div>';
  }

  function render(active) {
    var html = '';
    html += group('作业效率分析');
    html += link('work-stat-efficiency-pc.html?tab=master', 'fa-solid fa-user-gear', '司机效率', active === 'efficiency-master');
    html += link('work-stat-efficiency-pc.html?tab=volume', 'fa-solid fa-chart-column', '作业统计', active === 'efficiency-volume');
    html += link('work-stat-ship-eff-pc.html', 'fa-solid fa-ship', '船舶效率', active === 'efficiency-ship');
    return html;
  }

  function mount() {
    var el = document.getElementById('pcSidebarNav');
    if (!el) return;
    el.innerHTML = render(el.getAttribute('data-active') || '');
  }

  window.renderPcSidebar = mount;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
