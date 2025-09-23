// Bundle CSS into Vite output
import './style.css';
import './syntax.css';

// Load robot sim code (defines drawRobot, resetRobot, parseProgram, etc.)
import './robot.js';

// Put all editor/DOM wiring inside boot() so we start only after Monaco is loaded.
function boot() {
  // create editor when this script is loaded (Monaco is already available)
  var editor = monaco.editor.create(document.getElementById('editor'), {
      value: [
      ].join('\n'),
      language: 'javascript', // use JS coloring for colorful syntax
      automaticLayout: true,
      theme: 'vs',            // light theme (white background)
      minimap: { enabled: false }
  });

  // Disable JS/TS diagnostics so non-JS DSL won't show red error squiggles.
  // Keeps syntax coloring but removes red validation markers.
  if (monaco.languages && monaco.languages.typescript && monaco.languages.typescript.javascriptDefaults){
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true
    });
  }

  var canvas = document.getElementById('canvas');
  var ctx = canvas.getContext('2d');

  // give canvas a fixed size (match previous layout)
  function resizeCanvas() {
      // keep canvas at the fixed size used before adding the syntax reference
      canvas.width = 600;
      canvas.height = 300;
  }

  // When window is resized then the canvas is also resized
  window.addEventListener('resize', function(){ resizeCanvas(); });
  resizeCanvas();

  // 
  var logEl = document.getElementById('log');
  function log(msg){
      logEl.textContent += String(msg) + '\n';
      logEl.scrollTop = logEl.scrollHeight;
  }
  function clearLog(){ logEl.textContent = ''; }

  // Determines wether the code is running or not
  var running = { stop:false };
  // variable that will hold the compiled function you build from the user’s code
  //var currentRunner = null;

  document.getElementById('runBtn').addEventListener('click', () => {
    clearLog();
    running.stop = false;
    try {
      var userCode = editor.getValue();
      // parse into immutable AST, then clone into the executable program
      ast = parseProgram(userCode);
      program = clone(ast);

      // helper: count leaf actions (expand IFs) for clearer diagnostics
      function countLeafActions(list){
        let cnt = 0;
        for (const a of list){
          if (a.type === 'if'){
            for (const br of a.branches) cnt += countLeafActions(br.actions);
            if (a.elseActions) cnt += countLeafActions(a.elseActions);
          } else {
            cnt++;
          }
        }
        return cnt;
      }

      // Log both top-level node count and flattened executable action count
      const topLevel = ast.length;
      const leafCount = countLeafActions(ast);
      if (topLevel === 1 && ast[0] && ast[0].type === 'if'){
        log(`Parsed 1 top-level IF node (${ast[0].branches.length} branch(es)), ${leafCount} executable action(s) total.`);
      } else {
        log(`Parsed ${topLevel} top-level node(s), ${leafCount} executable action(s) total.`);
      }

       programState(false); // start
    } catch (e){
      log('ERROR: ' + e.message);
    }
  });

  document.getElementById('stopBtn').addEventListener('click', function(){
      // signal stop; user code must check stopObj.stop to exit loops
      running.stop = true;
      programState(running.stop);
      log('Stop requested.');
  });

  document.getElementById('saveBtn').addEventListener('click', function(){
      try {
      localStorage.setItem('userCode', editor.getValue());
      log('Saved to localStorage.');
      } catch (e) {
      log('Save failed: ' + e.message);
      }
  });

  document.getElementById('loadBtn').addEventListener('click', function(){
      try {
      var txt = localStorage.getItem('userCode');
      if (txt) {
          editor.setValue(txt);
          log('Loaded code from localStorage.');
      } else {
          log('No saved code found.');
      }
      } catch (e) {
      log('Load failed: ' + e.message);
      }
  });

  document.getElementById('resetBtn').addEventListener('click', () => {
    stopping = true;
    resetRobot();
    ctx.clearRect(0,0,canvas.width,canvas.height);
    drawRobot();
    clearLog();
    log('Reset.');
  });

  drawRobot();
  drawObstacles();

  // initial load if any code saved
  (function(){
      // var saved = localStorage.getItem('userCode');
      // if (saved) editor.setValue(saved);
  })();
}

// If AMD loader (require) is present, use it to load editor.main then boot.
// Otherwise if monaco is already present, just boot.
if (window.require) {
  window.require(['vs/editor/editor.main'], boot);
} else if (window.monaco && monaco.editor) {
  boot();
}
