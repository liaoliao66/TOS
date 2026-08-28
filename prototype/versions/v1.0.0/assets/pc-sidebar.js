/**
 * PC 侧栏统一菜单（原型）
 * 用法：<nav id="pcSidebarNav" data-active="fill-shift"></nav>
 *      <script src="../assets/pc-sidebar.js"></script>
 *
 * data-active:
 *   efficiency-master | efficiency-volume | efficiency-daily | efficiency-ship
 *   fill-shift | fill-records
 *   ship-archive | ship-schedule | ship-dispatch | ship-screen | ship-command
 *   cfg-device | cfg-berth | cfg-cargo | cfg-job | cfg-dict | cfg-wecom
 */
(function () {
  function link(href, icon, label, active, indent, external) {
    var base = indent
      ? 'flex items-center gap-2 pl-10 pr-3 py-2 rounded-xl text-sm '
      : 'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm ';
    var state = active
      ? 'bg-slate-700 text-white'
      : 'text-slate-300 hover:bg-slate-700 hover:text-white';
    var ext = external ? ' target="_blank" rel="noopener noreferrer"' : '';
    return '<a href="' + href + '"' + ext + ' class="' + base + state + '">' +
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
    html += link('work-stat-ship-eff-pc.html', 'fa-solid fa-ship', '船舶效率', active === 'efficiency-ship', true);

    html += group('作业管理');
    html += link('work-stat-edit-pc.html', 'fa-solid fa-table', '工班作业', active === 'fill-shift', true);
    html += link('work-stat-records-pc.html', 'fa-solid fa-clipboard-check', '作业记录', active === 'fill-records', true);
    html += link('ship-archive-pc.html', 'fa-solid fa-book-open', '船舶档案', active === 'ship-archive', true);
    html += link('ship-schedule-pc.html', 'fa-solid fa-calendar-days', '船期管理', active === 'ship-schedule', true);
    html += link('ship-dispatch-pc.html', 'fa-solid fa-ship', '船舶调度', active === 'ship-dispatch', true);
    html += link('ship-dispatch-screen.html', 'fa-solid fa-tv', '调度大屏', active === 'ship-screen', true);
    html += link('https://jgyw.crfsdi.com.cn:51111/dp-port/#/home', 'fa-solid fa-desktop', '指挥大屏', active === 'ship-command', true, true);

    html += group('系统配置');
    html += link('device-mgmt-pc.html', 'fa-solid fa-gears', '设备管理', active === 'cfg-device', true);
    html += link('berth-mgmt-pc.html', 'fa-solid fa-anchor', '泊位管理', active === 'cfg-berth', true);
    html += link('cargo-mgmt-pc.html', 'fa-solid fa-boxes-stacked', '货种配置', active === 'cfg-cargo', true);
    html += link('job-type-mgmt-pc.html', 'fa-solid fa-id-badge', '工种管理', active === 'cfg-job', true);
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
