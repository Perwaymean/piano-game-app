/* charts.js — ECharts (radar + history) & Mermaid init */
(function () {
  var s = getComputedStyle(document.documentElement);
  var accent = s.getPropertyValue('--accent').trim() || '#6d28d9';
  var accent2 = s.getPropertyValue('--accent2').trim() || '#db2777';
  var ink = s.getPropertyValue('--ink').trim() || '#16182d';
  var muted = s.getPropertyValue('--muted').trim() || '#6a6c80';
  var rule = s.getPropertyValue('--rule').trim() || '#e7e8f0';

  /* ---- Mermaid ---- */
  if (window.mermaid) {
    mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose', flowchart: { curve: 'basis' } });
    try { mermaid.run(); } catch (e) {}
  }

  /* ---- Radar: competitive comparison ---- */
  var radarEl = document.getElementById('chart-radar');
  if (radarEl && window.echarts) {
    var r = echarts.init(radarEl, null, { renderer: 'svg' });
    r.setOption({
      tooltip: { appendToBody: true },
      legend: { data: ['本产品', 'Synthesia', 'Virtual Piano'], bottom: 0, textStyle: { color: muted } },
      radar: {
        indicator: [
          { name: '上手容易度', max: 10 },
          { name: 'AI 转谱', max: 10 },
          { name: '沉浸视觉', max: 10 },
          { name: '乐谱渲染', max: 10 },
          { name: '免费开放', max: 10 },
          { name: '移动适配', max: 10 }
        ],
        radius: '62%',
        axisName: { color: ink, fontSize: 12 },
        splitLine: { lineStyle: { color: rule } },
        splitArea: { areaStyle: { color: ['rgba(109,40,217,0.03)', 'rgba(109,40,217,0.06)'] } },
        axisLine: { lineStyle: { color: rule } }
      },
      series: [{
        type: 'radar',
        data: [
          { value: [9, 10, 9, 8, 10, 8], name: '本产品', areaStyle: { color: accent + '33' }, lineStyle: { color: accent, width: 2 }, itemStyle: { color: accent } },
          { value: [6, 0, 4, 9, 3, 7], name: 'Synthesia', lineStyle: { color: accent2, width: 2, type: 'dashed' }, itemStyle: { color: accent2 } },
          { value: [8, 0, 3, 4, 8, 6], name: 'Virtual Piano', lineStyle: { color: muted, width: 2, type: 'dotted' }, itemStyle: { color: muted } }
        ]
      }],
      animation: false
    });
    window.addEventListener('resize', function () { r.resize(); });
  }

  /* ---- History line: score progress ---- */
  var histEl = document.getElementById('chart-history');
  if (histEl && window.echarts) {
    var h = echarts.init(histEl, null, { renderer: 'svg' });
    var xs = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
    var ys = [620, 680, 710, 690, 760, 800, 780, 850, 880, 910];
    h.setOption({
      tooltip: { appendToBody: true, trigger: 'axis' },
      grid: { left: 44, right: 20, top: 24, bottom: 36 },
      xAxis: { type: 'category', data: xs, name: '第 N 次', axisLine: { lineStyle: { color: rule } }, axisLabel: { color: muted } },
      yAxis: { type: 'value', min: 500, max: 1000, axisLine: { show: false }, splitLine: { lineStyle: { color: rule } }, axisLabel: { color: muted } },
      series: [{
        type: 'line', data: ys, smooth: true, symbol: 'circle', symbolSize: 7,
        lineStyle: { color: accent, width: 3 },
        itemStyle: { color: accent2 },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: accent + '33' }, { offset: 1, color: accent + '02' }] } }
      }],
      animation: false
    });
    window.addEventListener('resize', function () { h.resize(); });
  }
})();
