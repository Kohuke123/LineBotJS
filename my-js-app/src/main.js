import './style.css';
import './syntax.css';
import { createSimulation, MAZES } from './robot.js';

function boot() {

  // ── Monaco editors ──────────────────────────────────────────
  const editorBeginner = monaco.editor.create(document.getElementById('editor'), {
    value: '',
    language: 'javascript',
    automaticLayout: true,
    theme: 'vs',
    minimap: { enabled: false }
  });

  const editorAdvanced = monaco.editor.create(document.getElementById('editor-advanced'), {
    value: '',
    language: 'javascript',
    automaticLayout: true,
    theme: 'vs',
    minimap: { enabled: false }
  });

  // Disable JS/TS diagnostics — keeps syntax colors but removes red squiggles
  if (monaco.languages?.typescript?.javascriptDefaults) {
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true
    });
  }

  // ── Canvas setup ────────────────────────────────────────────
  const canvasBeginner = document.getElementById('canvas');
  const canvasAdvanced = document.getElementById('canvas-advanced');

  // ── Simulation instances ─────────────────────────────────────
  const simBeginner = createSimulation(canvasBeginner);
  const simAdvanced = createSimulation(canvasAdvanced);

  // loggers wired after wireTab so logEl refs are available — set lazily in wireTab
  // ── Challenge Mode state (defined early so wireTab can use loadMaze) ─
  let challengeMaze      = 'baby';
  let challengeActive    = false;
  let challengeRunning   = false;
  let challengeStartTime = 0;

  const timerEl  = document.getElementById('challenge-timer');
  const resultEl = document.getElementById('challenge-result');
  const parEl    = document.getElementById('challenge-par');

  function updateParDisplay() {
    const par = MAZES[challengeMaze].par;
    parEl.innerHTML =
      `🥇 Gold: &lt;${par.gold}s &nbsp; 🥈 Silver: &lt;${par.silver}s &nbsp; 🥉 Bronze: &lt;${par.bronze}s`;
  }

  function renderHistory() {
    const history  = JSON.parse(localStorage.getItem('challengeHistory') || '[]');
    const par      = MAZES[challengeMaze].par;
    const mazeRuns = history.filter(r => r.maze === challengeMaze);
    const pb       = mazeRuns.reduce((best, r) => (!best || r.time < best.time) ? r : best, null);

    const pbCard    = document.getElementById('pb-card');
    const pbTimeEl  = document.getElementById('pb-time');
    const pbMedalEl = document.getElementById('pb-medal');
    const hintEl    = document.getElementById('next-medal-hint');
    const recentEl  = document.getElementById('recent-runs');

    function medalTier(t) {
      return t <= par.gold ? 'gold' : t <= par.silver ? 'silver' : t <= par.bronze ? 'bronze' : 'none';
    }
    function medalEmoji(t) {
      return t <= par.gold ? '🥇' : t <= par.silver ? '🥈' : t <= par.bronze ? '🥉' : '';
    }

    if (pb) {
      const tier = medalTier(pb.time);
      pbCard.dataset.medal = tier;
      pbTimeEl.textContent  = pb.time.toFixed(2) + 's';
      pbMedalEl.textContent = medalEmoji(pb.time) || '—';

      if (tier === 'gold') {
        hintEl.textContent = '🏆 Gold achieved — perfection!';
        hintEl.className   = 'next-medal-hint medal-maxed';
      } else {
        const [threshold, emoji, name] =
          tier === 'silver' ? [par.gold,   '🥇', 'Gold']   :
          tier === 'bronze' ? [par.silver, '🥈', 'Silver'] :
                              [par.bronze, '🥉', 'Bronze'];
        const diff = (pb.time - threshold).toFixed(2);
        hintEl.textContent = `${diff}s faster for ${emoji} ${name}`;
        hintEl.className   = 'next-medal-hint';
      }
    } else {
      pbCard.dataset.medal  = '';
      pbTimeEl.textContent  = '—.——s';
      pbMedalEl.textContent = '—';
      hintEl.textContent    = `Complete a run to earn 🥉 Bronze (< ${par.bronze}s)`;
      hintEl.className      = 'next-medal-hint';
    }

    const recent = mazeRuns.slice(-3).reverse();
    recentEl.innerHTML = recent.length === 0
      ? '<div class="no-runs">No runs yet</div>'
      : recent.map(r => {
          const isPB = pb && r.time === pb.time;
          return `<div class="run-row${isPB ? ' run-pb' : ''}">
            <span class="run-medal-icon">${medalEmoji(r.time)}</span>
            <span class="run-time">${r.time.toFixed(2)}s</span>
            <span class="run-date">${r.date}</span>
          </div>`;
        }).join('');
  }

  function resetChallengeState() {
    challengeActive    = false;
    challengeRunning   = false;
    challengeStartTime = 0;
    timerEl.textContent = '⏱ —';
    resultEl.hidden = true;
  }

  function loadMaze() {
    dismissFinishPopup();
    resetChallengeState();
    simAdvanced.programState(true);
    simAdvanced.setMaze(challengeMaze);
    challengeActive = true;
    timerEl.textContent = '⏱ 0.00s';
    renderHistory();
  }

  // ── Structured console renderer ─────────────────────────────
  function renderLogRow(container, entry) {
    const row   = document.createElement('div');
    const badge = document.createElement('span');
    const body  = document.createElement('span');
    row.className   = `log-row log-type-${entry.type}`;
    badge.className = 'log-badge';
    body.className  = 'log-body';

    switch (entry.type) {
      case 'parse':
        badge.textContent = 'PARSE';
        body.textContent  = entry.isIf
          ? `IF · ${entry.branches} branch(es) · ${entry.actions} action(s)`
          : `${entry.nodes} node(s) · ${entry.actions} action(s)`;
        break;
      case 'set':
        badge.textContent = `SET ${entry.side[0]}`;
        body.innerHTML    = `<strong>${entry.value > 0 ? '+' : ''}${entry.value}</strong>`;
        if (entry.dir) {
          const arrow = entry.dir === 'straight' ? '→' : entry.dir === 'left' ? '↺' : '↻';
          body.innerHTML += ` <span class="log-dir">${arrow} ${entry.dir} · ${entry.deg}°</span>`;
        }
        break;
      case 'wait':
        badge.textContent = 'WAIT';
        body.textContent  = `${entry.ms} ms`;
        break;
      case 'stop_cmd':
        badge.textContent = 'STOP';
        body.textContent  = `pos (${entry.x}, ${entry.y})`;
        break;
      case 'loop':
        badge.textContent = '↩ LOOP';
        body.textContent  = `#${entry.count}`;
        break;
      case 'pos':
        badge.textContent = 'POS';
        body.textContent  = `(${entry.x}, ${entry.y}) · ${entry.deg}° · L${entry.L} R${entry.R}`;
        break;
      case 'error':
        badge.textContent = 'ERR';
        body.textContent  = entry.message;
        break;
      case 'halted':
        badge.textContent = '■';
        body.textContent  = 'stopped';
        break;
      default:
        badge.textContent = '?';
        body.textContent  = JSON.stringify(entry);
    }

    row.appendChild(badge);
    row.appendChild(body);
    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
  }

  // ── Generic tab wiring ───────────────────────────────────────
  function countLeafActions(list) {
    let cnt = 0;
    for (const a of list) {
      if (a.type === 'if') {
        for (const br of a.branches) cnt += countLeafActions(br.actions);
        if (a.elseActions) cnt += countLeafActions(a.elseActions);
      } else { cnt++; }
    }
    return cnt;
  }

  function wireTab({ sim, editor, logId, runId, stopId, preRun }) {
    const logEl = document.getElementById(logId);
    function log(entry)  { renderLogRow(logEl, entry); }
    function clearLog()  { logEl.innerHTML = ''; }
    sim.setLogger(log);

    const copyBtn = document.createElement('button');
    copyBtn.textContent = '⧉';
    copyBtn.title = 'Copy log';
    copyBtn.className = 'log-copy-btn';
    copyBtn.addEventListener('click', () => {
      const text = Array.from(logEl.querySelectorAll('.log-row'))
        .map(r => r.textContent.trim())
        .join('\n');
      navigator.clipboard.writeText(text).then(() => {
        copyBtn.textContent = '✓';
        setTimeout(() => { copyBtn.textContent = '⧉'; }, 1500);
      });
    });
    logEl.parentElement.appendChild(copyBtn);

    // Ghost decoration: "↩ repeating from line 1…" after the last code line
    let loopDecorations = [];
    function showLoopDecoration() {
      const model = editor.getModel();
      if (!model) return;
      let lastLine = model.getLineCount();
      while (lastLine > 1 && model.getLineContent(lastLine).trim() === '') lastLine--;
      loopDecorations = editor.deltaDecorations(loopDecorations, [{
        range: new monaco.Range(lastLine, model.getLineMaxColumn(lastLine), lastLine, model.getLineMaxColumn(lastLine)),
        options: { after: { content: '  ↩ repeating from line 1…', inlineClassName: 'ghost-loop-hint' } }
      }]);
    }
    function clearLoopDecoration() {
      loopDecorations = editor.deltaDecorations(loopDecorations, []);
    }

    document.getElementById(runId).addEventListener('click', () => {
      if (preRun) preRun();
      sim.programState(true);
      sim.resetRobot();
      const rc = document.getElementById(runId).closest('.tab-panel').querySelector('canvas');
      rc.getContext('2d').clearRect(0, 0, rc.width, rc.height);
      sim.drawRobot();
      clearLog();
      try {
        const ast = sim.loadProgramFromText(editor.getValue());
        const topLevel  = ast.length;
        const leafCount = countLeafActions(ast);
        if (topLevel === 1 && ast[0]?.type === 'if') {
          log({ type: 'parse', isIf: true, branches: ast[0].branches.length, actions: leafCount });
        } else {
          log({ type: 'parse', nodes: topLevel, actions: leafCount });
        }
        sim.programState(false);
        showLoopDecoration();
      } catch(e) { log({ type: 'error', message: e.message }); clearLoopDecoration(); }
    });

    document.getElementById(stopId).addEventListener('click', () => {
      sim.programState(true);
      clearLoopDecoration();
      log({ type: 'halted' });
    });

  }

  wireTab({
    sim: simBeginner, editor: editorBeginner,
    logId: 'log', runId: 'runBtn', stopId: 'stopBtn'
  });

  wireTab({
    sim: simAdvanced, editor: editorAdvanced,
    logId: 'log-advanced', runId: 'runBtn-adv', stopId: 'stopBtn-adv',
    preRun: loadMaze
  });

  // ── Challenge Mode wiring ────────────────────────────────────

  // Maze selector buttons — auto-load on click
  document.querySelectorAll('.challenge-maze-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.challenge-maze-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      challengeMaze = btn.dataset.maze;
      updateParDisplay();
      loadMaze();
    });
  });

  // ── Finish popup ─────────────────────────────────────────────
  let popupTimer = null;

  function dismissFinishPopup() {
    if (popupTimer) { clearTimeout(popupTimer); popupTimer = null; }
    document.getElementById('finish-popup').hidden = true;
  }

  const POPUP_TAGLINES = {
    'Gold':     '✨ Flawless! UwU Kitten Sandra is SO proud of you!! 🎀',
    'Silver':   '💕 Amazing run~! Just a little faster for Gold! ⭐',
    'Bronze':   '🌸 You did it! Keep going, Silver is within reach! 💪',
    'No Medal': '🌸 Good try! Practice makes perfect~ you got this! 💕',
  };

  function showFinishPopup(medalEmoji, medalName, elapsed) {
    const popup = document.getElementById('finish-popup');
    document.getElementById('finish-popup-medal').textContent      = medalEmoji || '🏁';
    document.getElementById('finish-popup-medal-name').textContent = medalName;
    document.getElementById('finish-popup-time').textContent       = elapsed.toFixed(2) + 's';
    document.getElementById('finish-popup-tagline').textContent    = POPUP_TAGLINES[medalName] ?? '';
    popup.dataset.medal = medalName.toLowerCase();
    popup.hidden = false;

    const fill = document.getElementById('finish-popup-progress-fill');
    fill.style.transition = 'none';
    fill.style.width = '100%';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      fill.style.transition = 'width 5s linear';
      fill.style.width = '0%';
    }));

    if (popupTimer) clearTimeout(popupTimer);
    popupTimer = setTimeout(dismissFinishPopup, 5000);
  }

  document.getElementById('finish-popup').addEventListener('click', dismissFinishPopup);

  // Clear History
  document.getElementById('challenge-clear-btn').addEventListener('click', () => {
    localStorage.removeItem('challengeHistory');
    renderHistory();
  });

  // ── Sensor display helpers ───────────────────────────────────
  function updateSensorDisplay(sim, prefix) {
    const s = sim.getSensors();
    const t = sim.getStats();
    const fmtS = v => v >= 9999 ? '∞' : String(v);

    document.getElementById(`sr-${prefix}-L`).textContent = fmtS(s.left.u);
    document.getElementById(`sr-${prefix}-C`).textContent = fmtS(s.center.u);
    document.getElementById(`sr-${prefix}-R`).textContent = fmtS(s.right.u);
const wl  = document.getElementById(`sr-${prefix}-WL`);
    const wr  = document.getElementById(`sr-${prefix}-WR`);
    const sbl = document.getElementById(`sb-${prefix}-WL`);
    const sbr = document.getElementById(`sb-${prefix}-WR`);
    const lNeg = t.leftSpeed  < 0;
    const rNeg = t.rightSpeed < 0;
    wl.textContent  = Math.round(t.leftSpeed);
    wr.textContent  = Math.round(t.rightSpeed);
    wl.dataset.neg  = lNeg;
    wr.dataset.neg  = rNeg;
    sbl.style.width = Math.abs(t.leftSpeed)  + '%';
    sbr.style.width = Math.abs(t.rightSpeed) + '%';
    sbl.dataset.neg = lNeg;
    sbr.dataset.neg = rNeg;
  }

  function updateExecBar(sim, prefix) {
    const state  = sim.getExecState();
    const pill   = document.getElementById(`exec-pill-${prefix}`);
    const fill   = document.getElementById(`exec-fill-${prefix}`);
    const timeEl = document.getElementById(`exec-time-${prefix}`);
    const loopEl = document.getElementById(`loop-counter-${prefix}`);
    pill.dataset.status = state.status;
    if (state.status === 'idle') {
      pill.textContent     = 'IDLE';
      fill.style.width     = '0%';
      timeEl.textContent   = '';
      loopEl.hidden        = true;
      loopEl.dataset.count = '0';
    } else if (state.status === 'running') {
      pill.textContent   = '▶ RUNNING';
      fill.style.width   = '0%';
      timeEl.textContent = '';
    } else {
      const pct = (state.remaining / state.total) * 100;
      pill.textContent   = '▶ RUNNING';
      fill.style.width   = pct + '%';
      timeEl.textContent = (state.remaining / 1000).toFixed(1) + 's';
    }
    if (state.status !== 'idle' && state.loopCount > 0) {
      const prev = parseInt(loopEl.dataset.count || '0');
      if (state.loopCount !== prev) {
        loopEl.dataset.count = state.loopCount;
        loopEl.textContent   = `↩ Loop #${state.loopCount}`;
        loopEl.classList.remove('loop-flash');
        void loopEl.offsetWidth; // force reflow to restart animation
        loopEl.classList.add('loop-flash');
      }
      loopEl.hidden = false;
    }
  }

  simBeginner.setFrameCallback(() => {
    updateSensorDisplay(simBeginner, 'beg');
    updateExecBar(simBeginner, 'beg');
  });

  // Frame callback — sensor display + timer + goal detection
  simAdvanced.setFrameCallback(() => {
    updateSensorDisplay(simAdvanced, 'adv');
    updateExecBar(simAdvanced, 'adv');
    if (!challengeActive && !challengeRunning) return;

    if (challengeActive && !challengeRunning && simAdvanced.isMoving()) {
      challengeRunning   = true;
      challengeStartTime = performance.now();
    }

    if (challengeRunning) {
      const elapsed = (performance.now() - challengeStartTime) / 1000;
      timerEl.textContent = `⏱ ${elapsed.toFixed(2)}s`;

      if (simAdvanced.checkGoal()) {
        challengeRunning = false;
        challengeActive  = false;
        simAdvanced.programState(true);

        const par = MAZES[challengeMaze].par;
        const [medalEmoji, medalName] =
          elapsed <= par.gold   ? ['🥇', 'Gold']   :
          elapsed <= par.silver ? ['🥈', 'Silver'] :
          elapsed <= par.bronze ? ['🥉', 'Bronze'] :
                                  ['',   'No Medal'];
        const medal = medalEmoji ? `${medalEmoji} ${medalName}` : medalName;

        showFinishPopup(medalEmoji, medalName, elapsed);

        const history = JSON.parse(localStorage.getItem('challengeHistory') || '[]');
        history.push({ maze: challengeMaze, medal, time: elapsed, date: new Date().toLocaleDateString() });
        localStorage.setItem('challengeHistory', JSON.stringify(history));
        renderHistory();
      }
    }
  });

  renderHistory();

  // ── Page background floaties ─────────────────────────────────
  const FLOATIES = ['🎀','🌸','💕','⭐','🦋','🌷','💎','✨','🍓','🌺','💖','🎵','🦄','🍭','💫','🌟','🍬','🐱','🎠','🍰'];
  const bgEl = document.getElementById('bg-floaties');
  FLOATIES.forEach((emoji, i) => {
    const el = document.createElement('span');
    el.className   = 'floatie';
    el.textContent = emoji;
    el.setAttribute('aria-hidden', 'true');
    const tx  = (Math.random() * 340 - 170).toFixed(0) + 'px';
    const ty  = (Math.random() * 340 - 170).toFixed(0) + 'px';
    const rot = (Math.random() * 720 - 360).toFixed(0) + 'deg';
    el.style.left               = Math.random() * 96 + '%';
    el.style.top                = Math.random() * 96 + '%';
    el.style.fontSize           = (14 + Math.random() * 18) + 'px';
    el.style.animationDuration  = (12 + Math.random() * 16) + 's';
    el.style.animationDelay     = -(Math.random() * 28) + 's';
    el.style.setProperty('--tx', tx);
    el.style.setProperty('--ty', ty);
    el.style.setProperty('--rot', rot);
    bgEl.appendChild(el);
  });

  // ── Initial draw ─────────────────────────────────────────────
  simBeginner.drawRobot();
  simBeginner.drawObstacles();
  simAdvanced.drawRobot();
  simAdvanced.drawObstacles();

  // ── Tab switching (refresh Monaco layout on reveal) ──────────
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('.tab-panel').forEach(p => {
        p.classList.remove('active');
        p.hidden = true;
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const panel = document.getElementById('tab-' + btn.dataset.tab);
      panel.classList.add('active');
      panel.hidden = false;

      // Monaco needs a tick after the panel becomes visible to measure its container
      setTimeout(() => {
        editorBeginner.layout();
        editorAdvanced.layout();
      }, 20);

      if (btn.dataset.tab === 'advanced') loadMaze();
    });
  });
}

if (window.require) {
  window.require(['vs/editor/editor.main'], boot);
} else if (window.monaco?.editor) {
  boot();
}
