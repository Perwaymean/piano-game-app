/* prototypes.js — interactive PRD prototypes + page UI */
(function () {
  /* ===== shared audio ===== */
  var actx = null;
  function ac() { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); return actx; }
  function freq(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function playNote(midi, type, dur) {
    try {
      var c = ac(); var o = c.createOscillator(); var g = c.createGain();
      o.type = type || 'sine'; o.frequency.value = freq(midi); o.connect(g); g.connect(c.destination);
      var t = c.currentTime; var d = dur || 0.6;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.28, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.start(t); o.stop(t + d + 0.05);
    } catch (e) {}
  }

  /* ===== toast ===== */
  var toastEl = document.getElementById('toast'); var toastT;
  function showToast(msg) { if (!toastEl) return; toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 1900); }

  /* ===== page UI: progress bar + active TOC ===== */
  var bar = document.getElementById('progress');
  function onScroll() { var h = document.documentElement; var max = h.scrollHeight - h.clientHeight; bar.style.width = (max > 0 ? h.scrollTop / max * 100 : 0) + '%'; }
  window.addEventListener('scroll', onScroll); onScroll();
  var links = Array.prototype.slice.call(document.querySelectorAll('nav.toc a'));
  var secs = links.map(function (a) { return document.querySelector(a.getAttribute('href')); }).filter(Boolean);
  function activeToc() { var pos = window.scrollY + 90; var cur = secs[0]; secs.forEach(function (s) { if (s && s.offsetTop <= pos) cur = s; }); links.forEach(function (a) { a.classList.toggle('active', cur && a.getAttribute('href') === '#' + cur.id); }); }
  window.addEventListener('scroll', activeToc); activeToc();

  /* ===== piano builder ===== */
  function buildPiano(container, opts) {
    opts = opts || {};
    var oct = opts.octave || 4;
    var whites = [['C', 60, 'A'], ['D', 62, 'S'], ['E', 64, 'D'], ['F', 65, 'F'], ['G', 67, 'G'], ['A', 69, 'H'], ['B', 71, 'J']];
    var blacks = [['C#', 61, 0], ['D#', 63, 1], ['F#', 66, 3], ['G#', 68, 4], ['A#', 70, 5]];
    var blkPos = { 0: 10.79, 1: 25.07, 3: 53.64, 4: 67.93, 5: 82.21 };
    container.className = 'minipiano'; container.innerHTML = '';
    var all = [];
    whites.forEach(function (w) {
      var el = document.createElement('div'); el.className = 'wk';
      el.dataset.base = w[1]; el.dataset.note = w[0]; el.dataset.key = w[2];
      el.innerHTML = '<span>' + w[0] + (opts.showKey !== false ? '<br><b style="color:#6d28d9">' + w[2] + '</b>' : '') + '</span>';
      bind(el); container.appendChild(el); all.push(el);
    });
    blacks.forEach(function (b) {
      var el = document.createElement('div'); el.className = 'bk';
      el.style.left = blkPos[b[2]] + '%';
      el.dataset.base = b[1]; el.dataset.note = b[0];
      bind(el); container.appendChild(el); all.push(el);
    });
    function midiOf(el) { return parseInt(el.dataset.base) + (oct - 4) * 12; }
    function bind(el) {
      el.addEventListener('pointerdown', function (e) { e.preventDefault(); el.classList.add('down'); opts.onNote && opts.onNote(midiOf(el), el.dataset.note + oct, el); });
      el.addEventListener('pointerup', function () { el.classList.remove('down'); });
      el.addEventListener('pointerleave', function () { el.classList.remove('down'); });
    }
    return {
      all: all, getOct: function () { return oct; }, setOct: function (o) { oct = o; }, midiOf: midiOf,
      highlight: function (midi, on) { all.forEach(function (el) { if (midiOf(el) === midi) el.classList.toggle('down', on); }); }
    };
  }

  /* ===== M01 音源引擎 ===== */
  var p1El = document.getElementById('proto-piano');
  if (p1El) {
    buildPiano(p1El, { onNote: function (midi, name) { var t = document.getElementById('piano-timbre').value; playNote(midi, t, 0.7); document.getElementById('piano-notename').textContent = name + ' · MIDI ' + midi; } });
  }

  /* ===== M02 自由弹奏 ===== */
  var fsEl = document.getElementById('proto-freestyle');
  if (fsEl) {
    fsEl.innerHTML = '<div style="display:flex;gap:.6rem;align-items:center;margin-bottom:.5rem;flex-wrap:wrap"><button class="btn sm" id="fs-dn">Z 八度−</button><span class="pill" id="fs-oct">C4</span><button class="btn sm" id="fs-up">X 八度+</button><button class="btn sm ghost" id="fs-rec">● 录音</button></div><div id="fs-piano"></div>';
    var fsOct = 4, recording = false, recEvents = [], recStart = 0;
    var fsP = buildPiano(document.getElementById('fs-piano'), { octave: fsOct, onNote: function (midi) { playNote(midi, 'sine', 0.7); if (recording) recEvents.push({ midi: midi, t: Date.now() - recStart }); } });
    function updFo() { document.getElementById('fs-oct').textContent = 'C' + fsOct; fsP.setOct(fsOct); }
    document.getElementById('fs-dn').onclick = function () { if (fsOct > 1) { fsOct--; updFo(); } };
    document.getElementById('fs-up').onclick = function () { if (fsOct < 7) { fsOct++; updFo(); } };
    document.getElementById('fs-rec').onclick = function () {
      recording = !recording; this.textContent = recording ? '■ 停止' : '● 录音'; this.classList.toggle('solid', recording);
      if (recording) { recEvents = []; recStart = Date.now(); showToast('开始录音，弹奏吧'); } else { showToast('已记录 ' + recEvents.length + ' 个音符'); }
    };
    updFo();
  }

  /* ===== M03 跟弹打分 ===== */
  var fEl = document.getElementById('proto-falling');
  if (fEl) {
    fEl.innerHTML = '<div style="display:flex;gap:.6rem;margin-bottom:.5rem;flex-wrap:wrap"><button class="btn sm solid" id="f-start">开始</button><button class="btn sm" id="f-auto">自动演示</button><button class="btn sm ghost" id="f-reset">重置</button></div><div class="hud"><span>分数：<span class="score" id="f-score">0</span></span><span class="combo" id="f-combo">连击 0</span><span id="f-judge" style="min-width:80px;font-weight:700"></span></div><div id="f-lanes" style="position:relative;height:240px;background:linear-gradient(#1b1730,#2a2348);border-radius:10px;overflow:hidden;margin-top:.6rem;border:1px solid #3a3358;touch-action:none"></div>';
    var lanesEl = document.getElementById('f-lanes');
    var laneLabels = ['A', 'S', 'D'];
    var judgeLine = document.createElement('div'); judgeLine.style.cssText = 'position:absolute;left:0;right:0;bottom:46px;height:3px;background:linear-gradient(90deg,#6d28d9,#db2777);box-shadow:0 0 12px #db2777';
    lanesEl.appendChild(judgeLine);
    laneLabels.forEach(function (lab, i) {
      var lab2 = document.createElement('div'); lab2.style.cssText = 'position:absolute;left:' + (i * 33.33) + '%;width:33.33%;bottom:12px;text-align:center;color:#7a7b9a;font-family:monospace;font-weight:700';
      lab2.textContent = lab; lanesEl.appendChild(lab2);
    });
    var notes = [], running = false, auto = false, score = 0, combo = 0, lastSpawn = 0, raf = 0;
    function spawn() { var lane = Math.floor(Math.random() * 3); var el = document.createElement('div'); el.className = 'note'; el.textContent = laneLabels[lane]; el.style.left = (lane * 33.33 + 16.66) + '%'; el.style.top = '-8%'; lanesEl.appendChild(el); notes.push({ el: el, lane: lane, t0: performance.now(), dur: 2600, hit: false }); }
    function setHUD() { document.getElementById('f-score').textContent = score; document.getElementById('f-combo').textContent = '连击 ' + combo; }
    function hit(n, g) { n.hit = true; n.el.remove(); score += g === 'Perfect' ? 100 : g === 'Great' ? 80 : 50; combo++; setHUD(); document.getElementById('f-judge').textContent = g; document.getElementById('f-judge').style.color = g === 'Perfect' ? '#22c55e' : g === 'Great' ? '#eab308' : '#3b82f6'; }
    function miss(n) { n.hit = true; n.el.remove(); combo = 0; setHUD(); var j = document.getElementById('f-judge'); j.textContent = 'Miss'; j.style.color = '#ef4444'; }
    function loop(now) {
      if (!running) return;
      if (now - lastSpawn > 900) { spawn(); lastSpawn = now; }
      for (var i = notes.length - 1; i >= 0; i--) {
        var n = notes[i]; if (n.hit) continue;
        var p = (now - n.t0) / n.dur * 100; n.el.style.top = p + '%';
        if (auto && p >= 81 && p <= 84) { hit(n, 'Perfect'); continue; }
        if (p > 96) { miss(n); }
      }
      raf = requestAnimationFrame(loop);
    }
    document.getElementById('f-start').onclick = function () {
      running = !running; this.textContent = running ? '暂停' : '开始'; this.classList.toggle('solid', running);
      if (running) { lastSpawn = performance.now() - 900; raf = requestAnimationFrame(loop); } else { cancelAnimationFrame(raf); }
    };
    document.getElementById('f-auto').onclick = function () { auto = !auto; this.classList.toggle('solid', auto); showToast(auto ? '自动演示：开' : '自动演示：关'); };
    document.getElementById('f-reset').onclick = function () { notes.forEach(function (n) { n.el.remove(); }); notes = []; score = 0; combo = 0; setHUD(); document.getElementById('f-judge').textContent = ''; };
    document.addEventListener('keydown', function (e) {
      if (!running) return; var i = ['a', 's', 'd'].indexOf(e.key.toLowerCase()); if (i < 0) return;
      var cand = null, minD = 99;
      notes.forEach(function (n) { if (n.hit || n.lane !== i) return; var p = (performance.now() - n.t0) / n.dur * 100; if (p >= 70 && p <= 96) { var d = Math.abs(p - 82); if (d < minD) { minD = d; cand = n; } } });
      if (cand) { hit(cand, minD < 4 ? 'Perfect' : minD < 8 ? 'Great' : 'Good'); }
    });
    setHUD();
  }

  /* ===== M04 AI 转谱（模拟） ===== */
  var aiEl = document.getElementById('proto-ai');
  if (aiEl) {
    aiEl.innerHTML = '<div style="display:flex;gap:.6rem;align-items:center;flex-wrap:wrap"><button class="btn sm solid" id="ai-go">⬆ 上传并开始转谱</button><span class="pill gray" id="ai-file">未选择文件</span></div><div class="prog" style="margin:.8rem 0"><i id="ai-bar"></i></div><div id="ai-result"></div>';
    document.getElementById('ai-go').onclick = function () {
      var bar2 = document.getElementById('ai-bar'), res = document.getElementById('ai-result');
      document.getElementById('ai-file').textContent = 'piano_sample.wav · 32s'; res.innerHTML = ''; bar2.style.width = '0%';
      var p = 0; var iv = setInterval(function () {
        p += Math.random() * 12 + 4; if (p >= 100) { p = 100; clearInterval(iv); bar2.style.width = '100%'; setTimeout(showAi, 200); } bar2.style.width = p + '%';
      }, 180);
    };
    function showAi() {
      var res = document.getElementById('ai-result');
      res.innerHTML = '<div class="grid-cards" style="grid-template-columns:1fr 1fr"><div class="card"><h4>五线谱（OSMD 缩略）</h4><svg viewBox="0 0 200 70" style="width:100%"><g stroke="#16182d" stroke-width="1"><line x1="10" y1="20" x2="190" y2="20"/><line x1="10" y1="30" x2="190" y2="30"/><line x1="10" y1="40" x2="190" y2="40"/><line x1="10" y1="50" x2="190" y2="50"/><line x1="10" y1="60" x2="190" y2="60"/></g><text x="12" y="52" font-size="34" fill="#16182d">𝄞</text><g fill="#16182d"><ellipse cx="50" cy="40" rx="5" ry="4"/><ellipse cx="75" cy="35" rx="5" ry="4"/><ellipse cx="100" cy="30" rx="5" ry="4"/><ellipse cx="130" cy="40" rx="5" ry="4"/><ellipse cx="160" cy="35" rx="5" ry="4"/></g><g stroke="#16182d" stroke-width="1.5"><line x1="50" y1="40" x2="50" y2="15"/><line x1="75" y1="35" x2="75" y2="10"/><line x1="100" y1="30" x2="100" y2="8"/></g></svg></div><div class="card"><h4>下落音符预览</h4><svg viewBox="0 0 200 70" style="width:100%"><rect x="0" y="0" width="200" height="70" rx="6" fill="#2a2348"/><rect x="35" y="6" width="30" height="12" rx="4" fill="#6d28d9"/><rect x="95" y="26" width="30" height="12" rx="4" fill="#db2777"/><rect x="140" y="44" width="30" height="12" rx="4" fill="#6d28d9"/><line x1="0" y1="60" x2="200" y2="60" stroke="#db2777" stroke-width="2"/></svg></div></div><p style="margin-top:.6rem">识别 <b>218</b> 个音符 · 时长 32s · 估算 BPM 96 · <span class="pill pink">AI 识别结果仅供参考</span> <button class="btn sm" style="margin-left:.4rem" onclick="window.__toast&&window.__toast(\'已进入跟弹模式\')">▶ 进入跟弹</button></p>';
    }
    window.__toast = showToast;
  }

  /* ===== M05 按键映射 ===== */
  var mpEl = document.getElementById('proto-mapping');
  if (mpEl) {
    mpEl.innerHTML = '<div id="mp-piano"></div><div class="table-wrap" style="max-height:200px;margin-top:.6rem"><table id="mp-tbl"><thead><tr><th>键</th><th>音名</th><th>MIDI</th></tr></thead><tbody></tbody></table></div>';
    var mpP = buildPiano(document.getElementById('mp-piano'), { onNote: function (midi) { playNote(midi, 'triangle', 0.5); } });
    var rows = [['A', 'C4', 60], ['W', 'C#4', 61], ['S', 'D4', 62], ['E', 'D#4', 63], ['D', 'E4', 64], ['F', 'F4', 65], ['T', 'F#4', 66], ['G', 'G4', 67], ['Y', 'G#4', 68], ['H', 'A4', 69], ['U', 'A#4', 70], ['J', 'B4', 71]];
    var tb = mpEl.querySelector('#mp-tbl tbody');
    rows.forEach(function (r) { var tr = document.createElement('tr'); tr.innerHTML = '<td><kbd>' + r[0] + '</kbd></td><td>' + r[1] + '</td><td>' + r[2] + '</td>'; tr.style.cursor = 'pointer'; tr.onmouseenter = function () { mpP.highlight(r[2], true); playNote(r[2], 'triangle', 0.4); }; tr.onmouseleave = function () { mpP.highlight(r[2], false); }; tb.appendChild(tr); });
  }

  /* ===== M06 乐谱展示 ===== */
  var scEl = document.getElementById('proto-score');
  if (scEl) {
    scEl.innerHTML = '<div style="display:flex;gap:.5rem;margin-bottom:.5rem"><button class="btn sm" id="sc-zin">＋ 放大</button><button class="btn sm" id="sc-zout">－ 缩小</button><button class="btn sm ghost" id="sc-toggle">隐藏</button></div><div id="sc-wrap" style="overflow:auto;border:1px solid var(--rule);border-radius:8px;padding:.6rem;background:#fff"><svg id="sc-svg" viewBox="0 0 400 90" style="width:100%;height:100px"><g stroke="#16182d" stroke-width="1"><line x1="10" y1="30" x2="390" y2="30"/><line x1="10" y1="40" x2="390" y2="40"/><line x1="10" y1="50" x2="390" y2="50"/><line x1="10" y1="60" x2="390" y2="60"/><line x1="10" y1="70" x2="390" y2="70"/></g><text x="12" y="64" font-size="40" fill="#16182d">𝄞</text><g fill="#16182d" id="sc-notes"><ellipse cx="60" cy="50" rx="6" ry="4.5"/><line x1="66" y1="50" x2="66" y2="24" stroke="#16182d" stroke-width="1.5"/><ellipse cx="110" cy="45" rx="6" ry="4.5"/><line x1="116" y1="45" x2="116" y2="19" stroke="#16182d" stroke-width="1.5"/><ellipse cx="160" cy="55" rx="6" ry="4.5"/><line x1="166" y1="55" x2="166" y2="29" stroke="#16182d" stroke-width="1.5"/><ellipse cx="210" cy="50" rx="6" ry="4.5"/><line x1="216" y1="50" x2="216" y2="24" stroke="#16182d" stroke-width="1.5"/><ellipse cx="260" cy="60" rx="6" ry="4.5"/><line x1="266" y1="60" x2="266" y2="34" stroke="#16182d" stroke-width="1.5"/><ellipse cx="310" cy="45" rx="6" ry="4.5"/><line x1="316" y1="45" x2="316" y2="19" stroke="#16182d" stroke-width="1.5"/></g><line id="sc-play" x1="60" y1="20" x2="60" y2="80" stroke="#db2777" stroke-width="2"/></svg></div>';
    var svgW = 100, ph = 60, dir = 1;
    setInterval(function () { ph += dir * 25; if (ph > 360) dir = -1; if (ph < 60) dir = 1; var pl = document.getElementById('sc-play'); if (pl) pl.setAttribute('x1', ph), pl.setAttribute('x2', ph); }, 120);
    document.getElementById('sc-zin').onclick = function () { svgW = Math.min(svgW + 20, 160); document.getElementById('sc-svg').style.width = svgW + '%'; };
    document.getElementById('sc-zout').onclick = function () { svgW = Math.max(svgW - 20, 60); document.getElementById('sc-svg').style.width = svgW + '%'; };
    document.getElementById('sc-toggle').onclick = function () { var w = document.getElementById('sc-wrap'); w.style.display = w.style.display === 'none' ? 'block' : 'none'; };
  }

  /* ===== M07 历史记录 ===== */
  var histEl = document.getElementById('proto-history');
  if (histEl) {
    var hist = [{ song: '小星星', score: 910, combo: 48, date: '07-12' }, { song: '欢乐颂', score: 850, combo: 40, date: '07-11' }, { song: '卡农片段', score: 760, combo: 30, date: '07-10' }];
    histEl.innerHTML = '<div class="grid-cards">' + hist.map(function (h) { return '<div class="sc"><h5>' + h.song + '</h5><p style="font-size:.8rem;color:var(--muted)">分数 <b style="color:var(--accent)">' + h.score + '</b> · 连击 ' + h.combo + ' · ' + h.date + '</p></div>'; }).join('') + '</div><p style="font-size:.8rem;color:var(--muted);margin-top:.5rem">下方折线图为近 10 次跟弹得分进步曲线。</p>';
  }

  /* ===== M08 沉浸视觉（canvas 透视钢琴 + 粒子） ===== */
  var vEl = document.getElementById('proto-visual');
  if (vEl) {
    vEl.innerHTML = '<canvas id="v-cv" width="520" height="200" style="width:100%;border-radius:10px;cursor:pointer;display:block"></canvas><div style="display:flex;gap:.5rem;margin-top:.5rem;flex-wrap:wrap"><button class="btn sm solid" data-st="star">星空</button><button class="btn sm" data-st="sakura">樱花</button><button class="btn sm" data-st="cyber">赛博</button></div>';
    var cv = document.getElementById('v-cv'), cx = cv.getContext('2d');
    var styles = {
      star: { bg1: '#0b1026', bg2: '#1a2150', key: '#eef', edge: '#aab', blk: '#1c1d2b', p: ['#fff', '#7dd3fc'] },
      sakura: { bg1: '#2b1422', bg2: '#5a2840', key: '#ffeef5', edge: '#e8a0c0', blk: '#3a1c2b', p: ['#fbcfe8', '#f9a8d4'] },
      cyber: { bg1: '#0a0a18', bg2: '#1a0a2e', key: '#eef2ff', edge: '#a78bfa', blk: '#0a0a18', p: ['#22d3ee', '#a3e635'] }
    };
    var st = 'star', particles = [], flashKey = -1, flashT = 0;
    var keyX = []; for (var i = 0; i < 7; i++) keyX.push(60 + i * 65);
    function draw() {
      var s = styles[st];
      var g = cx.createLinearGradient(0, 0, 0, 200); g.addColorStop(0, s.bg1); g.addColorStop(1, s.bg2);
      cx.fillStyle = g; cx.fillRect(0, 0, 520, 200);
      // perspective keys
      keyX.forEach(function (kx, i) {
        var isFlash = (i === flashKey && flashT > 0);
        cx.beginPath(); cx.moveTo(kx - 22, 80); cx.lineTo(kx + 22, 80); cx.lineTo(kx + 32, 188); cx.lineTo(kx - 32, 188); cx.closePath();
        cx.fillStyle = isFlash ? '#c4b5fd' : s.key; cx.fill(); cx.strokeStyle = s.edge; cx.lineWidth = 1; cx.stroke();
      });
      // black keys
      [[0], [1], [3], [4], [5]].forEach(function (b) { var kx = keyX[b[0]] + 32; cx.fillStyle = s.blk; cx.fillRect(kx - 12, 80, 24, 60); });
      if (flashT > 0) flashT--;
      // particles
      for (var j = particles.length - 1; j >= 0; j--) {
        var p = particles[j]; p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.life--;
        cx.globalAlpha = Math.max(p.life / 40, 0); cx.fillStyle = p.c; cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 7); cx.fill(); cx.globalAlpha = 1;
        if (p.life <= 0) particles.splice(j, 1);
      }
      requestAnimationFrame(draw);
    }
    cv.addEventListener('pointerdown', function (e) {
      var rect = cv.getBoundingClientRect(); var x = (e.clientX - rect.left) / rect.width * 520; var y = (e.clientY - rect.top) / rect.height * 200;
      if (y < 80 || y > 188) return;
      var idx = 0, best = 999; keyX.forEach(function (kx, i) { var d = Math.abs(kx - x); if (d < best) { best = d; idx = i; } });
      flashKey = idx; flashT = 8; playNote([60, 62, 64, 65, 67, 69, 71][idx], 'sine', 0.6);
      for (var k = 0; k < 18; k++) { var ang = Math.random() * 6.28; var sp = 1 + Math.random() * 3; particles.push({ x: keyX[idx], y: 150, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 2, r: 1 + Math.random() * 2.5, life: 40, c: styles[st].p[Math.floor(Math.random() * 2)] }); }
    });
    vEl.querySelectorAll('[data-st]').forEach(function (b) { b.onclick = function () { st = b.dataset.st; vEl.querySelectorAll('[data-st]').forEach(function (x) { x.classList.remove('solid'); }); b.classList.add('solid'); }; });
    draw();
  }

  /* ===== M08a 摄像头画中画 ===== */
  var camEl = document.getElementById('proto-camera');
  if (camEl) {
    camEl.innerHTML = '<div style="display:flex;gap:.7rem;align-items:center;flex-wrap:wrap"><button class="btn sm" id="cam-btn">开启摄像头画中画</button><div id="cam-pip" style="width:120px;height:80px;border:2px dashed var(--rule);border-radius:8px;display:none;align-items:center;justify-content:center;color:var(--muted);font-size:.72rem;background:rgba(255,255,255,.5)">画中画预览（本地）</div></div>';
    var camOn = false;
    function enableCam() { camOn = true; document.getElementById('cam-btn').textContent = '关闭摄像头'; document.getElementById('cam-btn').classList.add('solid'); document.getElementById('cam-pip').style.display = 'flex'; showToast('摄像头已开启（仅本地显示）'); }
    function disableCam() { camOn = false; document.getElementById('cam-btn').textContent = '开启摄像头画中画'; document.getElementById('cam-btn').classList.remove('solid'); document.getElementById('cam-pip').style.display = 'none'; }
    document.getElementById('cam-btn').onclick = function () {
      if (camOn) { disableCam(); return; }
      if (!sessionStorage.getItem('cam_priv')) {
        var m = document.createElement('div'); m.style.cssText = 'position:fixed;inset:0;background:rgba(20,15,40,.55);display:flex;align-items:center;justify-content:center;z-index:400';
        m.innerHTML = '<div class="card" style="max-width:360px"><h3 style="margin-top:0">摄像头隐私说明</h3><p style="font-size:.88rem;color:var(--muted)">摄像头画面<b>仅在本机本地显示</b>作为画中画，不会上传到任何服务器，关闭即停止并释放。是否同意开启？</p><div style="display:flex;gap:.5rem;margin-top:.8rem;justify-content:flex-end"><button class="btn sm ghost" id="cam-no">取消</button><button class="btn sm solid" id="cam-yes">同意并开启</button></div></div>';
        document.body.appendChild(m);
        document.getElementById('cam-no').onclick = function () { m.remove(); };
        document.getElementById('cam-yes').onclick = function () { sessionStorage.setItem('cam_priv', '1'); m.remove(); enableCam(); };
      } else { enableCam(); }
    };
  }

  /* ===== M09 内置曲库 ===== */
  var libEl = document.getElementById('proto-library');
  if (libEl) {
    var lib = [{ t: '小星星', d: '入门', b: 80, m: '0:30' }, { t: '欢乐颂', d: '入门', b: 120, m: '0:45' }, { t: '生日快乐', d: '入门', b: 100, m: '0:25' }, { t: '天空之城', d: '进阶', b: 72, m: '1:10' }, { t: '卡农片段', d: '进阶', b: 88, m: '1:00' }, { t: '野蜂飞舞', d: '挑战', b: 160, m: '0:55' }];
    libEl.innerHTML = '<div class="grid-cards">' + lib.map(function (s) { return '<div class="sc" data-t="' + s.t + '"><h5>' + s.t + '</h5><p style="font-size:.78rem;color:var(--muted)"><span class="pill ' + (s.d === '入门' ? 'cyan' : s.d === '进阶' ? '' : 'pink') + '">' + s.d + '</span> BPM ' + s.b + ' · ' + s.m + '</p></div>'; }).join('') + '</div>';
    libEl.querySelectorAll('.sc').forEach(function (c) { c.onclick = function () { showToast('已选择：' + c.dataset.t); }; });
  }

  /* ===== M10 歌单推荐 ===== */
  var recEl = document.getElementById('proto-recommend');
  if (recEl) {
    var rec = [{ t: '放松时刻', tag: '放松', songs: '天空之城 · 月光', c: 'cyan' }, { t: '欢快节奏', tag: '欢快', songs: '欢乐颂 · 野蜂飞舞', c: 'pink' }, { t: '经典入门', tag: '经典', songs: '小星星 · 生日快乐', c: '' }];
    recEl.innerHTML = '<div class="grid-cards">' + rec.map(function (r) { return '<div class="sc"><h5>' + r.t + '</h5><p style="font-size:.78rem;color:var(--muted)"><span class="pill ' + r.c + '">' + r.tag + '</span></p><p style="font-size:.8rem;margin-top:.3rem">' + r.songs + '</p></div>'; }).join('') + '</div>';
  }

  /* ===== M11 新手引导 ===== */
  var gEl = document.getElementById('proto-guide');
  if (gEl) {
    var steps = [{ t: '第一步 · 点琴键发声', d: '点击或按键盘琴键即可发声，键面显示对应音名与按键。' }, { t: '第二步 · 看下落音符', d: '跟弹模式下，音符下落到判定线时按对应键，命中得分。' }, { t: '第三步 · Z/X 切八度', d: '键位不够？用 Z/X 上下切换可弹音区。' }, { t: '第四步 · 上传 AI 转谱', d: '上传任意音频，AI 自动生成乐谱与按键提示，立刻可弹。' }];
    var si = 0;
    function renderGuide() { gEl.innerHTML = '<div class="card" style="text-align:center"><h4 id="g-t">' + steps[si].t + '</h4><p style="color:var(--muted);margin:.6rem 0">' + steps[si].d + '</p><div style="font-size:.8rem;color:var(--accent2);margin-bottom:.7rem">' + (si + 1) + ' / ' + steps.length + '</div><div style="display:flex;gap:.5rem;justify-content:center"><button class="btn sm ghost" id="g-prev">上一步</button><button class="btn sm solid" id="g-next">' + (si === steps.length - 1 ? '完成' : '下一步') + '</button><button class="btn sm ghost" id="g-start">重新引导</button></div></div>'; bindG(); }
    function bindG() { document.getElementById('g-prev').onclick = function () { if (si > 0) { si--; renderGuide(); } }; document.getElementById('g-next').onclick = function () { if (si < steps.length - 1) { si++; renderGuide(); } else { showToast('引导完成，开始弹奏吧！'); } }; document.getElementById('g-start').onclick = function () { si = 0; renderGuide(); }; }
    renderGuide();
  }

  /* ===== M12 无障碍/错误 ===== */
  var aEl = document.getElementById('proto-a11y');
  if (aEl) {
    aEl.innerHTML = '<div style="display:flex;gap:.6rem;flex-wrap:wrap"><button class="btn sm" id="a-hc">切换高对比度</button><button class="btn sm ghost" id="a-err">触发错误 Toast</button><button class="btn sm ghost" id="a-vib">触发振动反馈</button></div>';
    document.getElementById('a-hc').onclick = function () { document.body.classList.toggle('hc'); showToast(document.body.classList.contains('hc') ? '高对比度：开' : '高对比度：关'); };
    document.getElementById('a-err').onclick = function () { showToast('⚠ AI 模型加载失败，已切换至无 AI 基础体验'); };
    document.getElementById('a-vib').onclick = function () { if (navigator.vibrate) navigator.vibrate(60); showToast('已触发振动反馈（移动端）'); };
  }

  /* ===== M13 全平台适配 ===== */
  var adEl = document.getElementById('proto-adapt');
  if (adEl) {
    adEl.innerHTML = '<div style="display:flex;gap:.5rem;margin-bottom:.6rem"><button class="btn sm solid" id="ad-d">桌面</button><button class="btn sm" id="ad-m">移动</button></div><div id="ad-view" style="border:1px solid var(--rule);border-radius:10px;padding:1rem;background:rgba(255,255,255,.5);min-height:90px"></div>';
    function desk() { document.getElementById('ad-view').innerHTML = '<p style="font-size:.8rem;color:var(--muted);margin-bottom:.4rem">键盘映射（物理键盘）</p><div class="kbd-row"><span class="keycap">A</span><span class="keycap dark">W</span><span class="keycap">S</span><span class="keycap dark">E</span><span class="keycap">D</span><span class="keycap">F</span><span class="keycap dark">T</span><span class="keycap">G</span></div>'; }
    function mob() { document.getElementById('ad-view').innerHTML = '<p style="font-size:.8rem;color:var(--muted);margin-bottom:.4rem">触屏琴键（≥44px，横屏优先）</p><div style="display:flex;gap:4px"><div style="flex:1;height:70px;background:#fff;border:1px solid var(--rule);border-radius:7px"></div><div style="flex:1;height:70px;background:#fff;border:1px solid var(--rule);border-radius:7px"></div><div style="flex:1;height:70px;background:#fff;border:1px solid var(--rule);border-radius:7px"></div><div style="flex:1;height:70px;background:#fff;border:1px solid var(--rule);border-radius:7px"></div><div style="flex:1;height:70px;background:#fff;border:1px solid var(--rule);border-radius:7px"></div></div>'; }
    document.getElementById('ad-d').onclick = function () { this.classList.add('solid'); document.getElementById('ad-m').classList.remove('solid'); desk(); };
    document.getElementById('ad-m').onclick = function () { this.classList.add('solid'); document.getElementById('ad-d').classList.remove('solid'); mob(); };
    desk();
  }

  /* ===== M14 录音回放 ===== */
  var rEl = document.getElementById('proto-record');
  if (rEl) {
    rEl.innerHTML = '<div style="display:flex;gap:.5rem;flex-wrap:wrap"><button class="btn sm" id="r-rec">● 录音</button><button class="btn sm ghost" id="r-play" disabled>▶ 回放</button><button class="btn sm ghost" id="r-exp" disabled>⬇ 导出 MIDI</button></div><p id="r-status" style="font-size:.8rem;color:var(--muted);margin-top:.5rem">空闲</p>';
    var rState = 'idle';
    document.getElementById('r-rec').onclick = function () { var b = this, st = document.getElementById('r-status'); if (rState === 'idle') { rState = 'rec'; b.textContent = '■ 停止'; b.classList.add('solid'); st.textContent = '录音中…'; } else { rState = 'idle'; b.textContent = '● 录音'; b.classList.remove('solid'); st.textContent = '已录制片段，可回放或导出'; document.getElementById('r-play').disabled = false; document.getElementById('r-exp').disabled = false; } };
    document.getElementById('r-play').onclick = function () { if (this.disabled) return; showToast('回放中…'); document.getElementById('r-status').textContent = '回放中…'; };
    document.getElementById('r-exp').onclick = function () { if (this.disabled) return; showToast('已导出 my_song.mid'); };
  }
})();
