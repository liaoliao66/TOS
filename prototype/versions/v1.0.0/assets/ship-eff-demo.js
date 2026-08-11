/**
 * 船舶效率分析 · 演示数据（对齐《船舶作业信息效率统计表》口径）
 * - 产量：调度完工填写产量（吨）
 * - 在港时间 = 离泊 − 靠泊（小时）
 * - 生产用时 = 完工 − 开工 − 三类停工（小时）
 * - 单船效率 = 产量 ÷ 生产用时
 * - 停工三类：天气 / 故障 / 其他（由停工原因字典归类汇总）
 */
(function (global) {
  /** 演示单据：模拟调度已完工/离泊录入 */
  var SEED = [
    {
      id: 'se-0', date: '2026-08-01', shipName: '无生产作业', voyage: '', noWork: true,
      workers: null, cargo: '', loadUnload: '', process: '', craneUp: '', craneDown: '',
      length: null, hatchLen: null, width: null, hatchWidth: null,
      dwt: null, draftLight: null, qty: null, draftLoaded: null,
      berthAt: '', startAt: '', finishAt: '', unberthAt: '',
      stoppages: [], shorePower: ''
    },
    {
      id: 'se-1', date: '2026-08-02', shipName: '航龙809', voyage: 'V260802A', noWork: false,
      workers: 9, cargo: '集装箱 / 20尺标箱', cargoL1: '集装箱', cargoL2: '20尺标箱',
      loadUnload: '卸', process: '船-场', craneUp: 'QC102', craneDown: '',
      length: 110, hatchLen: null, width: 16.2, hatchWidth: null,
      dwt: 4150, draftLight: 0.9, qty: 30, draftLoaded: 4.2,
      berthAt: '2026-08-02 10:00', startAt: '2026-08-02 10:30', finishAt: '2026-08-02 12:00', unberthAt: '2026-08-02 16:00',
      stoppages: [], shorePower: '是'
    },
    {
      id: 'se-2', date: '2026-08-02', shipName: '航龙809', voyage: 'V260802B', noWork: false,
      workers: 9, cargo: '集装箱 / 40尺高箱', cargoL1: '集装箱', cargoL2: '40尺高箱',
      loadUnload: '装', process: '场-船', craneUp: '', craneDown: 'QC102',
      length: 110, hatchLen: null, width: 16.2, hatchWidth: null,
      dwt: 4150, draftLight: 2.1, qty: 40, draftLoaded: 4.2,
      berthAt: '2026-08-02 10:00', startAt: '2026-08-02 12:30', finishAt: '2026-08-02 15:00', unberthAt: '2026-08-02 16:00',
      stoppages: [], shorePower: '是'
    },
    {
      id: 'se-3', date: '2026-08-03', shipName: '航龙803', voyage: 'V260803', noWork: false,
      workers: 9, cargo: '集装箱 / 20尺标箱', cargoL1: '集装箱', cargoL2: '20尺标箱',
      loadUnload: '装', process: '场-船', craneUp: '', craneDown: 'QC102',
      length: 105, hatchLen: null, width: 16.2, hatchWidth: null,
      dwt: 4150, draftLight: 2.8, qty: 31, draftLoaded: 4.2,
      berthAt: '2026-08-03 15:30', startAt: '2026-08-03 18:30', finishAt: '2026-08-03 21:30', unberthAt: '2026-08-03 22:00',
      stoppages: [], shorePower: '是'
    },
    {
      id: 'se-4', date: '2026-08-03', shipName: '邦朋6', voyage: 'V260803B', noWork: false,
      workers: 7, cargo: '散货 / 氧化钙', cargoL1: '散货', cargoL2: '氧化钙',
      loadUnload: '卸', process: '船-库', craneUp: 'QC102', craneDown: '',
      length: 108, hatchLen: null, width: 17.2, hatchWidth: null,
      dwt: 6800, draftLight: null, qty: 6800, draftLoaded: 5.6,
      berthAt: '2026-08-03 12:00', startAt: '2026-08-03 12:30', finishAt: '2026-08-05 10:00', unberthAt: '2026-08-05 17:00',
      stoppages: [
        { reason: '天气原因', hours: 4 },
        { reason: '设备异常', hours: 2 },
        { reason: '等货/等驳', hours: 1.5 }
      ],
      shorePower: '是'
    },
    {
      id: 'se-5', date: '2026-08-04', shipName: '红光999', voyage: 'V260804A', noWork: false,
      workers: 7, cargo: '散货 / 磷矿', cargoL1: '散货', cargoL2: '磷矿',
      loadUnload: '装', process: '场-船', craneUp: '', craneDown: 'DLPT',
      length: 110, hatchLen: null, width: 16.2, hatchWidth: null,
      dwt: 7200, draftLight: null, qty: 5200, draftLoaded: 5.3,
      berthAt: '2026-08-04 18:00', startAt: '2026-08-04 18:30', finishAt: '2026-08-05 06:30', unberthAt: '2026-08-05 08:00',
      stoppages: [{ reason: '移泊', hours: 1 }],
      shorePower: '否'
    },
    {
      id: 'se-6', date: '2026-08-04', shipName: '富硕吉祥', voyage: 'V260804B', noWork: false,
      workers: 7, cargo: '散货 / 磷矿', cargoL1: '散货', cargoL2: '磷矿',
      loadUnload: '装', process: '场-船', craneUp: '', craneDown: 'DLPT',
      length: 106, hatchLen: null, width: 17.2, hatchWidth: null,
      dwt: 7300, draftLight: null, qty: 6100, draftLoaded: 4.3,
      berthAt: '2026-08-04 18:00', startAt: '2026-08-04 19:00', finishAt: '2026-08-05 08:00', unberthAt: '2026-08-05 09:30',
      stoppages: [{ reason: '下雨，暂停作业', hours: 2 }],
      shorePower: '否'
    },
    {
      id: 'se-7', date: '2026-08-06', shipName: '远航 168', voyage: 'V260806', noWork: false,
      workers: 12, cargo: '散货 / 氮磷肥', cargoL1: '散货', cargoL2: '氮磷肥',
      loadUnload: '卸', process: '船-场', craneUp: '1#卸船机', craneDown: '1#门机',
      length: 158.5, hatchLen: 42, width: 24, hatchWidth: 18.5,
      dwt: 28000, draftLight: 3.2, qty: 8650.5, draftLoaded: 9.1,
      berthAt: '2026-08-06 00:00', startAt: '2026-08-06 01:00', finishAt: '2026-08-06 18:30', unberthAt: '2026-08-06 20:00',
      stoppages: [{ reason: '移泊', hours: 1 }],
      shorePower: '是'
    },
    {
      id: 'se-8', date: '2026-08-07', shipName: '海丰致远', voyage: 'V260807', noWork: false,
      workers: 8, cargo: '件杂货 / 钢材', cargoL1: '件杂货', cargoL2: '钢材',
      loadUnload: '装', process: '船-船', craneUp: '1#门机', craneDown: '2#门机',
      length: 132, hatchLen: null, width: 21, hatchWidth: null,
      dwt: 18000, draftLight: 2.5, qty: 1860, draftLoaded: 4.8,
      berthAt: '2026-08-07 10:00', startAt: '2026-08-07 12:00', finishAt: '2026-08-07 21:50', unberthAt: '2026-08-08 06:30',
      stoppages: [{ reason: '设备异常', hours: 0.5 }],
      shorePower: '否'
    }
  ];

  function parseTs(s) {
    if (!s) return null;
    var t = Date.parse(String(s).replace(/-/g, '/'));
    return isNaN(t) ? null : t;
  }

  function hoursBetween(a, b) {
    var ta = parseTs(a);
    var tb = parseTs(b);
    if (ta == null || tb == null) return null;
    return (tb - ta) / 3600000;
  }

  function round2(n) {
    if (n == null || isNaN(n)) return null;
    return Math.round(n * 100) / 100;
  }

  function stopBuckets(stoppages) {
    var out = { weather: 0, fault: 0, other: 0 };
    (stoppages || []).forEach(function (s) {
      var h = Number(s.hours) || 0;
      var cat = '其他';
      if (global.StopReasonDemo && StopReasonDemo.categoryOf) {
        cat = StopReasonDemo.categoryOf(s.reason);
      } else if (s.reason && /天气|下雨|高温/.test(s.reason)) cat = '天气';
      else if (s.reason && /设备|故障/.test(s.reason)) cat = '故障';
      if (cat === '天气') out.weather += h;
      else if (cat === '故障') out.fault += h;
      else out.other += h;
    });
    return out;
  }

  function enrich(row) {
    var r = JSON.parse(JSON.stringify(row));
    if (r.noWork) {
      r.portHours = null;
      r.prodHours = null;
      r.efficiency = null;
      r.stopWeather = 0;
      r.stopFault = 0;
      r.stopOther = 0;
      return r;
    }
    var stops = stopBuckets(r.stoppages);
    r.stopWeather = round2(stops.weather);
    r.stopFault = round2(stops.fault);
    r.stopOther = round2(stops.other);
    r.portHours = round2(hoursBetween(r.berthAt, r.unberthAt));
    var rawProd = hoursBetween(r.startAt, r.finishAt);
    if (rawProd == null) {
      r.prodHours = null;
      r.efficiency = null;
    } else {
      r.prodHours = round2(rawProd - (stops.weather + stops.fault + stops.other));
      if (r.prodHours != null && r.prodHours > 0 && r.qty != null && !isNaN(Number(r.qty))) {
        r.efficiency = round2(Number(r.qty) / r.prodHours);
      } else {
        r.efficiency = null;
      }
    }
    return r;
  }

  function listRows(filter) {
    filter = filter || {};
    return SEED.map(enrich).filter(function (r) {
      if (filter.from && r.date && r.date < filter.from) return false;
      if (filter.to && r.date && r.date > filter.to) return false;
      if (filter.ship && r.shipName !== filter.ship) return false;
      if (filter.loadUnload && r.loadUnload !== filter.loadUnload) return false;
      if (filter.shorePower && r.shorePower !== filter.shorePower) return false;
      if (filter.cargoL1 && filter.cargoL1 !== '全部') {
        if (r.noWork) return false;
        if (r.cargoL1 !== filter.cargoL1) return false;
      }
      if (filter.cargoL2 && filter.cargoL2 !== '全部') {
        if (r.noWork) return false;
        if (r.cargoL2 !== filter.cargoL2) return false;
      }
      if (filter.excludeNoWork && r.noWork) return false;
      return true;
    });
  }

  function summarize(rows) {
    var work = rows.filter(function (r) { return !r.noWork; });
    var qtySum = 0;
    var portSum = 0;
    var portN = 0;
    var prodSum = 0;
    var prodN = 0;
    var effSum = 0;
    var effN = 0;
    work.forEach(function (r) {
      if (r.qty != null) qtySum += Number(r.qty) || 0;
      if (r.portHours != null) { portSum += r.portHours; portN++; }
      if (r.prodHours != null && r.prodHours > 0) { prodSum += r.prodHours; prodN++; }
      if (r.efficiency != null) { effSum += r.efficiency; effN++; }
    });
    return {
      trips: work.length,
      qtySum: round2(qtySum),
      avgPort: portN ? round2(portSum / portN) : null,
      avgProd: prodN ? round2(prodSum / prodN) : null,
      avgEff: effN ? round2(effSum / effN) : null
    };
  }

  function rankByVoyage(rows) {
    return rows.filter(function (r) { return !r.noWork; }).map(function (r) {
      return {
        shipName: r.shipName,
        voyage: r.voyage || '—',
        qty: r.qty,
        prodHours: r.prodHours,
        portHours: r.portHours,
        efficiency: r.efficiency
      };
    }).sort(function (a, b) {
      return (b.efficiency || 0) - (a.efficiency || 0);
    });
  }

  function shipOptions() {
    var set = {};
    SEED.forEach(function (r) {
      if (r.shipName && !r.noWork) set[r.shipName] = 1;
    });
    return Object.keys(set).sort();
  }

  global.ShipEffDemo = {
    listRows: listRows,
    summarize: summarize,
    rankByShip: rankByVoyage,
    rankByVoyage: rankByVoyage,
    shipOptions: shipOptions,
    enrich: enrich
  };
})(window);
