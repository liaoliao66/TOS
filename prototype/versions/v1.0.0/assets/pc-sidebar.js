/**
 * PC 侧栏统一菜单（原型）
 * 用法：<nav id="pcSidebarNav" data-active="fill-shift"></nav>
 *      <script src="../assets/pc-sidebar.js"></script>
 *
 * data-active:
 *   efficiency-master | efficiency-volume | efficiency-daily
 *   fill-shift | fill-vessel
 *   cfg-berth | cfg-dict | cfg-wecom
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
    html += group('作业效率分析');
    html += link('work-stat-efficiency-pc.html?tab=master', 'fa-solid fa-user-gear', '司机效率', active === 'efficiency-master', true);
    html += link('work-stat-efficiency-pc.html?tab=volume', 'fa-solid fa-chart-column', '作业统计', active === 'efficiency-volume', true);
    html += link('work-stat-efficiency-pc.html?tab=daily', 'fa-solid fa-calendar-day', '日报明细', active === 'efficiency-daily', true);

    html += group('作业填报');
    html += link('work-stat-list-pc.html', 'fa-solid fa-clipboard-list', '工班作业', active === 'fill-shift', true);
    html += link('vessel-list-pc.html', 'fa-solid fa-ship', '船舶作业', active === 'fill-vessel', true);

    html += group('系统配置');
    html += link('work-stat-berth-machine-pc.html', 'fa-solid fa-anchor', '泊位机械配置', active === 'cfg-berth', true);
    html += link('work-stat-dict-pc.html', 'fa-solid fa-book', '字典管理', active === 'cfg-dict', true);
    html += link('work-stat-wecom-push-pc.html', 'fa-brands fa-weixin', '企业微信推送配置', active === 'cfg-wecom', true);

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
