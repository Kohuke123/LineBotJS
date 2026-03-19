//--------------------------------------
// Module-level pure helpers & constants
// (no canvas dependency — safe to share)
//--------------------------------------
const ROBOT_SIZE      = 16;
const ROBOT_RADIUS    = 12;
const SENSOR_OFFSET_PX = 10;
const UNITS_PER_PX    = 1;
const SENSOR_ANGLE    = (30 * Math.PI) / 180;
const SENSOR_MAX_PX   = 500;
const EPS             = 0.001;
const SWAP_SIDES      = false;
const WALL_THICKNESS  = 8;

function rectToTriangles(x, y, w, h) {
  const v0 = { x: x,     y: y     };
  const v1 = { x: x + w, y: y     };
  const v2 = { x: x + w, y: y + h };
  const v3 = { x: x,     y: y + h };
  return [ { verts: [v0, v1, v2] }, { verts: [v0, v2, v3] } ];
}

// Arc obstacle: { type:'arc', cx, cy, R, r, startAngle, endAngle, segments }
// Decomposes the annular arc into N trapezoids (2 triangles each).
function arcToTriangles(o) {
  const tris = [];
  const N    = o.segments || 16;
  const span = o.endAngle - o.startAngle;
  for (let i = 0; i < N; i++) {
    const a0 = o.startAngle + (i     / N) * span;
    const a1 = o.startAngle + ((i+1) / N) * span;
    const o0 = { x: o.cx + o.R * Math.cos(a0), y: o.cy + o.R * Math.sin(a0) };
    const o1 = { x: o.cx + o.R * Math.cos(a1), y: o.cy + o.R * Math.sin(a1) };
    const i0 = { x: o.cx + o.r * Math.cos(a0), y: o.cy + o.r * Math.sin(a0) };
    const i1 = { x: o.cx + o.r * Math.cos(a1), y: o.cy + o.r * Math.sin(a1) };
    tris.push({ verts: [o0, o1, i1] });
    tris.push({ verts: [o0, i1, i0] });
  }
  return tris;
}

function obstacleToTriangles(o) {
  return o.type === 'arc' ? arcToTriangles(o) : rectToTriangles(o.x, o.y, o.w, o.h);
}

function pointInTriangle(p, a, b, c) {
  function sign(p1, p2, p3) {
    return (p1.x - p3.x)*(p2.y - p3.y) - (p2.x - p3.x)*(p1.y - p3.y);
  }
  const d1 = sign(p,a,b), d2 = sign(p,b,c), d3 = sign(p,c,a);
  return !((d1<0||d2<0||d3<0) && (d1>0||d2>0||d3>0));
}

function circleTriangleOverlap(c, r, verts) {
  if (pointInTriangle(c, verts[0], verts[1], verts[2])) return true;
  for (let i = 0; i < 3; i++) {
    const a = verts[i], b = verts[(i+1)%3];
    if (pointSegDist(c, a, b) <= r) return true;
  }
  return false;
}

function pointSegDist(p, a, b) {
  const vx = b.x-a.x, vy = b.y-a.y;
  const wx = p.x-a.x, wy = p.y-a.y;
  const L2 = vx*vx + vy*vy;
  const t  = L2 ? Math.max(0, Math.min(1, (wx*vx + wy*vy)/L2)) : 0;
  return Math.hypot(p.x - (a.x + t*vx), p.y - (a.y + t*vy));
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

export const clone = (o) =>
  typeof structuredClone === 'function'
    ? structuredClone(o)
    : JSON.parse(JSON.stringify(o));

//--------------------------------------
// Maze definitions
//--------------------------------------
export const MAZES = {
  baby: {
    label: 'Baby',
    start: { x: 440, y: 150, heading: Math.PI },
    goal:  { x: 500, y: 8, w: 184, h: 284 },
    obstacles: [],
    par: { bronze: 5, silver: 3, gold: 2 }
  },
  easy: {
    label: 'Easy',
    start: { x: 50, y: 150, heading: 0 },
    goal:  { x: 500, y: 8, w: 184, h: 284 },
    obstacles: [
      { x: 220, y:   8, w: 12, h: 145 },   // hangs from top  — go below
      { x: 440, y: 147, w: 12, h: 145 },   // hangs from bottom — go above
    ],
    par: { bronze: 15, silver: 10, gold: 7 }
  },
  medium: {
    label: 'Medium',
    start: { x: 50, y: 30, heading: Math.PI },
    goal:  { x: 500, y: 8, w: 184, h: 284 },
    obstacles: [
      { x:   8, y:  60, w: 100, h: 12 },   // horizontal bar below start — forces reverse + turn
      { x: 180, y:   8, w:  12, h: 220 },  // hangs from top — gap at bottom (64px)
      { x: 320, y:  72, w:  12, h: 220 },  // hangs from bottom — gap at top (64px)
      { x: 450, y:   8, w:  12, h: 220 },  // hangs from top — gap at bottom (64px)
    ],
    par: { bronze: 25, silver: 17, gold: 12 }
  },
  hard: {
    label: 'Hard',
    start: { x: 300, y: 150, heading: 0 },
    goal:  { x: 8, y: 8, w: 100, h: 284 },
    obstacles: [
      // inner U — open to the right
      { x: 230, y: 100, w:  12, h: 100 },  // left wall
      { x: 230, y: 100, w: 228, h:  12 },  // top wall — extends to outer right, seals top exit
      { x: 230, y: 188, w: 150, h:  12 },  // bottom wall
      // outer C — open to the left
      { x: 160, y:  50, w: 310, h:  12 },  // top wall
      { x: 160, y: 238, w: 310, h:  12 },  // bottom wall
      { x: 458, y:  50, w:  12, h: 200 },  // right wall
    ],
    par: { bronze: 40, silver: 28, gold: 20 }
  }
};

//--------------------------------------
// Factory — creates one independent simulation
// bound to a given <canvas> element.
//--------------------------------------
export function createSimulation(canvas) {
  const ctx = canvas.getContext('2d');

  //-------- Obstacles & walls --------
  const obstacles = [];

  const wallTriangles = [
    ...rectToTriangles(0, 0, canvas.width, WALL_THICKNESS),
    ...rectToTriangles(0, canvas.height - WALL_THICKNESS, canvas.width, WALL_THICKNESS),
    ...rectToTriangles(0, 0, WALL_THICKNESS, canvas.height),
    ...rectToTriangles(canvas.width - WALL_THICKNESS, 0, WALL_THICKNESS, canvas.height),
  ];

  //-------- Robot state --------
  const robot = {
    x: canvas.width  * 0.5,
    y: canvas.height * 0.5,
    heading: 0,
    leftSpeed: 0,
    rightSpeed: 0,
    wheelBase: 40
  };

  //-------- Sensor state --------
  let sensorLeftUnits   = Infinity;
  let sensorCenterUnits = Infinity;
  let sensorRightUnits  = Infinity;

  //-------- Maze / goal state --------
  let goalRect      = null;
  let startPos      = null;
  let frameCallback = null;
  let simLogger     = null;
  let logFrameCount = 0;

  function simLog(type, data) { if (simLogger) simLogger({ type, ...data }); }

  //-------- Program state --------
  let rafId        = null;
  let ast          = [];
  let program      = [];
  let pc           = 0;
  let waitLeftMs   = 0;
  let waitTotalMs  = 0;
  let lastTime     = 0;
  let stopping     = false;
  let loopCount    = 0;

  //-------- Draw --------
  function drawRobot() {
    ctx.save();
    ctx.translate(robot.x, robot.y);
    ctx.rotate(robot.heading);

    // front = +x, left/right = ±y
    const L = 20, W = 9; // half-length, half-width

    // --- wheels ---
    ctx.fillStyle = '#2a2a2a';
    for (const [ex, ey] of [[L - 6, W + 2], [L - 6, -W - 2], [-L + 6, W + 2], [-L + 6, -W - 2]]) {
      ctx.beginPath();
      ctx.roundRect(ex - 5, ey - 2.5, 10, 5, 3);
      ctx.fill();
    }

    // --- body ---
    ctx.fillStyle = '#ff79b0';
    ctx.strokeStyle = '#e0457a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-L, -W, L * 2, W * 2, W);
    ctx.fill();
    ctx.stroke();

    // --- white stripe ---
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.roundRect(-L * 0.5, -W + 2, L, W * 2 - 4, 3);
    ctx.fill();

    // --- bow (rear) ---
    const bx = -L + 5;
    ctx.fillStyle = '#ff1a5e';
    ctx.beginPath();
    ctx.ellipse(bx - 3, 0, 3.5, 2, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(bx + 3, 0, 3.5, 2, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff85b3';
    ctx.beginPath();
    ctx.arc(bx, 0, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawObstacles() {
    ctx.save();
    ctx.fillStyle = '#444';
    for (const o of obstacles) {
      if (o.type === 'arc') {
        ctx.beginPath();
        ctx.arc(o.cx, o.cy, o.R, o.startAngle, o.endAngle);
        ctx.arc(o.cx, o.cy, o.r, o.endAngle, o.startAngle, true);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(o.x, o.y, o.w, o.h);
      }
    }
    for (const wt of wallTriangles) {
      const v = wt.verts;
      ctx.beginPath();
      ctx.moveTo(v[0].x, v[0].y);
      ctx.lineTo(v[1].x, v[1].y);
      ctx.lineTo(v[2].x, v[2].y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawGoal() {
    if (!goalRect) return;
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#00dd55';
    ctx.fillRect(goalRect.x, goalRect.y, goalRect.w, goalRect.h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#00aa33';
    ctx.lineWidth = 2;
    ctx.strokeRect(goalRect.x, goalRect.y, goalRect.w, goalRect.h);
    ctx.fillStyle = '#004d22';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('GOAL', goalRect.x + 4, goalRect.y + 14);
    ctx.restore();
  }

  function drawStart() {
    if (!startPos) return;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#0044cc';
    ctx.beginPath();
    ctx.arc(startPos.x, startPos.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#0033aa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(startPos.x, startPos.y, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  //-------- Sensors --------
  function sensorOrigin() {
    const fx  = Math.cos(robot.heading) * SENSOR_OFFSET_PX;
    const fy  = Math.sin(robot.heading) * SENSOR_OFFSET_PX;
    const sox = Math.min(canvas.width  - EPS, Math.max(EPS, robot.x + fx));
    const soy = Math.min(canvas.height - EPS, Math.max(EPS, robot.y + fy));
    return { sox, soy };
  }

  function updateSensors() {
    const { sox, soy } = sensorOrigin();
    const leftAng  = SWAP_SIDES ? robot.heading + SENSOR_ANGLE : robot.heading - SENSOR_ANGLE;
    const rightAng = SWAP_SIDES ? robot.heading - SENSOR_ANGLE : robot.heading + SENSOR_ANGLE;
    sensorLeftUnits   = castSensor(sox, soy, leftAng)       * UNITS_PER_PX;
    sensorCenterUnits = castSensor(sox, soy, robot.heading) * UNITS_PER_PX;
    sensorRightUnits  = castSensor(sox, soy, rightAng)      * UNITS_PER_PX;
  }

  function drawSensors() {
    ctx.save();
    ctx.strokeStyle = '#0f0';
    ctx.globalAlpha = 0.5;

    const { sox, soy } = sensorOrigin();
    const leftAng  = SWAP_SIDES ? robot.heading + SENSOR_ANGLE : robot.heading - SENSOR_ANGLE;
    const rightAng = SWAP_SIDES ? robot.heading - SENSOR_ANGLE : robot.heading + SENSOR_ANGLE;

    const ls_px = Math.min(sensorLeftUnits   / UNITS_PER_PX, SENSOR_MAX_PX);
    const cs_px = Math.min(sensorCenterUnits / UNITS_PER_PX, SENSOR_MAX_PX);
    const rs_px = Math.min(sensorRightUnits  / UNITS_PER_PX, SENSOR_MAX_PX);

    const lx = sox + Math.cos(leftAng)    * ls_px;
    const ly = soy + Math.sin(leftAng)    * ls_px;
    const cx = sox + Math.cos(robot.heading) * cs_px;
    const cy = soy + Math.sin(robot.heading) * cs_px;
    const rx = sox + Math.cos(rightAng)   * rs_px;
    const ry = soy + Math.sin(rightAng)   * rs_px;

    [[sox,soy,lx,ly],[sox,soy,cx,cy],[sox,soy,rx,ry]].forEach(([x1,y1,x2,y2]) => {
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    });

    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0f0';
    const labels = [['L',lx,ly],['C',cx,cy],['R',rx,ry]];
    ctx.font = '12px monospace';
    labels.forEach(([lbl,ex,ey]) => {
      ctx.beginPath(); ctx.arc(ex, ey, 4, 0, Math.PI*2); ctx.fill();
      ctx.fillText(lbl, ex + 6, ey + 4);
    });
    ctx.restore();
  }

//-------- Raycasting --------
  function castSensor(x, y, ang) {
    let minDist = SENSOR_MAX_PX;
    const dx = Math.cos(ang), dy = Math.sin(ang);

    const allTris = [
      ...obstacles.flatMap(obstacleToTriangles),
      ...wallTriangles
    ];

    for (const { verts } of allTris) {
      if (pointInTriangle({ x, y }, verts[0], verts[1], verts[2])) { minDist = 0; continue; }
      for (let e = 0; e < 3; e++) {
        const A = verts[e], B = verts[(e+1)%3];
        const sx = B.x-A.x, sy = B.y-A.y;
        const rx = A.x-x,   ry = A.y-y;
        const denom = sx*dy - dx*sy;
        if (Math.abs(denom) < 1e-9) continue;
        const t = (sx*ry - rx*sy) / denom;
        const u = (dx*ry - dy*rx) / denom;
        if (t >= 0 && u >= 0 && u <= 1 && t < minDist) minDist = t;
      }
    }

    const ts = [];
    const EPS_RAY = 1e-9;
    if (Math.abs(dx) > EPS_RAY) {
      const tL = (0 - x) / dx, tR = (canvas.width - x) / dx;
      if (tL >= 0) ts.push(tL); if (tR >= 0) ts.push(tR);
    }
    if (Math.abs(dy) > EPS_RAY) {
      const tT = (0 - y) / dy, tB = (canvas.height - y) / dy;
      if (tT >= 0) ts.push(tT); if (tB >= 0) ts.push(tB);
    }
    if (ts.length) minDist = Math.min(minDist, Math.min(...ts));
    return Math.min(minDist, SENSOR_MAX_PX);
  }

  //-------- Physics --------
  function stepPhysics(dt) {
    const v     = (robot.rightSpeed + robot.leftSpeed) / 2;
    const omega = (robot.leftSpeed - robot.rightSpeed) / robot.wheelBase;
    const prevX = robot.x, prevY = robot.y;

    robot.heading += omega * dt;
    robot.x += v * Math.cos(robot.heading) * dt;
    robot.y += v * Math.sin(robot.heading) * dt;

    let hit = false;
    if (robot.x < 0)               { robot.x = 0;               hit = true; }
    if (robot.x > canvas.width)    { robot.x = canvas.width;     hit = true; }
    if (robot.y < 0)               { robot.y = 0;               hit = true; }
    if (robot.y > canvas.height)   { robot.y = canvas.height;    hit = true; }

    if (!hit) {
      for (const { verts } of wallTriangles) {
        if (circleTriangleOverlap({ x: robot.x, y: robot.y }, ROBOT_RADIUS, verts)) {
          robot.x = prevX; robot.y = prevY; hit = true; break;
        }
      }
    }
    if (!hit) {
      for (const o of obstacles) {
        for (const { verts } of obstacleToTriangles(o)) {
          if (circleTriangleOverlap({ x: robot.x, y: robot.y }, ROBOT_RADIUS, verts)) {
            robot.x = prevX; robot.y = prevY; hit = true; break;
          }
        }
        if (hit) break;
      }
    }
    if (hit) { robot.leftSpeed = 0; robot.rightSpeed = 0; }
  }

  //-------- DSL Parser --------
  function parseProgram(text) {
    const lines    = text.split(/\r?\n/);
    let i          = 0;
    const reSetLeft  = /^\s*SET\s+LEFT\s+(-?\d+)\s*$/i;
    const reSetRight = /^\s*SET\s+RIGHT\s+(-?\d+)\s*$/i;
    const reWait     = /^\s*WAIT\s+(\d+)\s*$/i;
    const reStop     = /^\s*STOP\s*$/i;
    const reComment  = /^\s*#.*$/;
    const reIf     = /^\s*IF\s+(SENSOR_LEFT|SENSOR_RIGHT|SENSOR_CENTER)\s*(<|<=|>|>=|==|!=)\s*(\d+)\s*(PX)?\s*$/i;
    const reElseIf = /^\s*ELSE\s+IF\s+(SENSOR_LEFT|SENSOR_RIGHT|SENSOR_CENTER)\s*(<|<=|>|>=|==|!=)\s*(\d+)\s*(PX)?\s*$/i;
    const reElse   = /^\s*ELSE\s*$/i;
    const reEnd    = /^\s*END\s*$/i;

    function parseBlock(endTokens) {
      const out = [];
      while (i < lines.length) {
        const line = lines[i];
        if (!line.trim() || reComment.test(line)) { i++; continue; }
        if (endTokens && endTokens.some(rx => rx.test(line))) return out;
        let m;
        if (m = line.match(reSetLeft))  { out.push({ type:'setLeft',  value: clamp(parseInt(m[1],10),-100,100) }); i++; continue; }
        if (m = line.match(reSetRight)) { out.push({ type:'setRight', value: clamp(parseInt(m[1],10),-100,100) }); i++; continue; }
        if (m = line.match(reWait))     { out.push({ type:'wait', ms: parseInt(m[1],10) }); i++; continue; }
        if (reStop.test(line))          { out.push({ type:'stop' }); i++; continue; }
        if (m = line.match(reIf))       { i++; out.push(parseIf(m)); continue; }
        if (!endTokens && reEnd.test(line)) { i++; continue; }
        throw new Error(`Syntax error on line ${i+1}: "${line}"`);
      }
      return out;
    }

    function parseIf(firstMatch) {
      const node = {
        type: 'if',
        branches: [{ cond: { sensor: firstMatch[1].toUpperCase(), op: firstMatch[2], value: Math.round(parseInt(firstMatch[3],10) * UNITS_PER_PX) }, actions: [] }],
        elseActions: null
      };
      node.branches[0].actions = parseBlock([reElseIf, reElse, reEnd]);
      while (i < lines.length) {
        const line = lines[i];
        if (!line.trim() || reComment.test(line)) { i++; continue; }
        let m;
        if (m = line.match(reElseIf)) {
          i++;
          node.branches.push({ cond: { sensor: m[1].toUpperCase(), op: m[2], value: Math.round(parseInt(m[3],10) * UNITS_PER_PX) }, actions: parseBlock([reElseIf, reElse, reEnd]) });
          continue;
        }
        if (reElse.test(line)) {
          i++;
          node.elseActions = parseBlock([reEnd]);
          if (i >= lines.length || !reEnd.test(lines[i])) throw new Error(`Missing END after ELSE (near line ${i+1}).`);
          i++; break;
        }
        if (reEnd.test(line)) { i++; break; }
        throw new Error(`Unexpected token in IF at line ${i+1}: "${line}"`);
      }
      return node;
    }

    return parseBlock(null);
  }

  //-------- Public API --------
  function loadProgramFromText(text) {
    const parsed = parseProgram(text);
    ast     = parsed;
    program = clone(parsed);
    return parsed;
  }

  function resetRobot() {
    if (startPos) {
      robot.x       = startPos.x;
      robot.y       = startPos.y;
      robot.heading = startPos.heading ?? 0;
    } else {
      robot.x       = canvas.width  * 0.5;
      robot.y       = canvas.height * 0.5;
      robot.heading = 0;
    }
    robot.leftSpeed  = 0;
    robot.rightSpeed = 0;
  }

  function programState(state) {
    if (state === false) {
      stopping   = false;
      pc         = 0;
      waitLeftMs = 0;
      loopCount  = 0;
      lastTime   = performance.now();
      loop();
    } else {
      stopping = true;
    }
  }

  function setMaze(mazeKey) {
    const maze = MAZES[mazeKey];
    if (!maze) return;
    obstacles.length = 0;
    for (const o of maze.obstacles) obstacles.push(o);
    robot.x          = maze.start.x;
    robot.y          = maze.start.y;
    robot.heading    = maze.start.heading;
    robot.leftSpeed  = 0;
    robot.rightSpeed = 0;
    goalRect = { ...maze.goal };
    startPos = { x: maze.start.x, y: maze.start.y, heading: maze.start.heading };
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawObstacles();
    drawGoal();
    drawStart();
    drawRobot();
  }

  function clearMaze() {
    obstacles.length = 0;
    goalRect = null;
    startPos = null;
    robot.x          = canvas.width  * 0.5;
    robot.y          = canvas.height * 0.5;
    robot.heading    = 0;
    robot.leftSpeed  = 0;
    robot.rightSpeed = 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawRobot();
    drawObstacles();
  }

  function checkGoal() {
    if (!goalRect) return false;
    return robot.x >= goalRect.x && robot.x <= goalRect.x + goalRect.w &&
           robot.y >= goalRect.y && robot.y <= goalRect.y + goalRect.h;
  }

  function getGoalRect() { return goalRect; }

  function isMoving() {
    return robot.leftSpeed !== 0 || robot.rightSpeed !== 0;
  }

  function setFrameCallback(fn) {
    frameCallback = fn;
  }

  //-------- Animation loop --------
  function loop() {
    if (stopping) { cancelAnimationFrame(rafId); return; }
    rafId = requestAnimationFrame(loop);

    const t    = performance.now();
    const dtMs = t - lastTime;
    lastTime   = t;

    updateSensors();

    let advanced = true;
    let stepsBudget = 500;
    while (advanced && !stopping) {
      if (--stepsBudget <= 0) break;
      advanced = false;

      if (pc >= program.length) {
        if (ast.length === 0) break;
        program = clone(ast);
        pc = 0;
        loopCount++;
        simLog('loop', { count: loopCount });
        advanced = false;
        continue;
      }

      const action = program[pc];

      if (action.type === 'if') {
        function evalCond(cond) {
          const sv = cond.sensor === 'SENSOR_LEFT'  ? sensorLeftUnits
                   : cond.sensor === 'SENSOR_RIGHT' ? sensorRightUnits
                   : sensorCenterUnits;
          const v = cond.value;
          switch(cond.op) {
            case '<':  return sv <  v;
            case '<=': return sv <= v;
            case '>':  return sv >  v;
            case '>=': return sv >= v;
            case '==': return sv == v;
            case '!=': return sv != v;
          }
          return false;
        }
        let chosen = null;
        for (const br of action.branches) { if (evalCond(br.cond)) { chosen = br.actions; break; } }
        const toInsert = chosen || action.elseActions || [];
        program.splice(pc, 1, ...toInsert);
        if (toInsert.length === 0) advanced = true;
        continue;
      }

      if (action.type === 'setLeft') {
        robot.leftSpeed = action.value; advanced = true; pc++;
        simLog('set', { side: 'LEFT', value: action.value });
      } else if (action.type === 'setRight') {
        robot.rightSpeed = action.value; advanced = true; pc++;
        const L = robot.leftSpeed, R = robot.rightSpeed;
        const deg = Math.round(robot.heading * 180 / Math.PI);
        const dir = L === R ? 'straight' : L > R ? 'right' : 'left';
        simLog('set', { side: 'RIGHT', value: action.value, dir, L, R, deg });
      } else if (action.type === 'stop') {
        robot.leftSpeed = robot.rightSpeed = 0; advanced = true; pc++;
        simLog('stop_cmd', { x: Math.round(robot.x), y: Math.round(robot.y) });
      } else if (action.type === 'wait') {
        if (waitLeftMs <= 0) {
          waitLeftMs  = action.ms;
          waitTotalMs = action.ms;
          simLog('wait', { ms: action.ms });
        }
        waitLeftMs -= dtMs;
        if (waitLeftMs <= 0) { waitLeftMs = 0; advanced = true; pc++; }
        else break;
      } else { pc++; }
    }

    stepPhysics(dtMs / 1000);
    logFrameCount++;
    if (logFrameCount % 60 === 0) {
      simLog('pos', {
        x: Math.round(robot.x), y: Math.round(robot.y),
        deg: Math.round(robot.heading * 180 / Math.PI),
        L: robot.leftSpeed, R: robot.rightSpeed
      });
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawObstacles();
    drawGoal();
    drawStart();
    drawRobot();
    drawSensors();
    if (frameCallback) frameCallback();
  }

  function getSensors() {
    return {
      left:   { px: Math.round(sensorLeftUnits   / UNITS_PER_PX), u: Math.round(sensorLeftUnits)   },
      center: { px: Math.round(sensorCenterUnits / UNITS_PER_PX), u: Math.round(sensorCenterUnits) },
      right:  { px: Math.round(sensorRightUnits  / UNITS_PER_PX), u: Math.round(sensorRightUnits)  },
    };
  }

  function getStats() {
    return { leftSpeed: robot.leftSpeed, rightSpeed: robot.rightSpeed };
  }

  function setLogger(fn) { simLogger = fn; logFrameCount = 0; }

  function getExecState() {
    if (stopping || ast.length === 0) return { status: 'idle', loopCount: 0 };
    if (waitLeftMs > 0) return { status: 'waiting', remaining: waitLeftMs, total: waitTotalMs, loopCount };
    return { status: 'running', loopCount };
  }

  return {
    loadProgramFromText, programState, resetRobot, drawRobot, drawObstacles,
    setMaze, clearMaze, checkGoal, getGoalRect, isMoving, setFrameCallback, getSensors, getStats, setLogger, getExecState
  };
}
