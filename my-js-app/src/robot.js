//--------------------------------------
// Canvas & 2D context (declare ONCE)
//--------------------------------------
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

//--------------------------------------
// Constants
//--------------------------------------
const ROBOT_SIZE = 16;          // draw size (px)
const ROBOT_RADIUS = 12;        // collision radius (px) ~ ROBOT_SIZE
const SENSOR_OFFSET_PX = 10;    // sensor origin offset from robot center (px)
// changed: use 1 so internal "units" == pixels; DSL numbers (PX) will match screen px
const UNITS_PER_PX = 1;         // 1 unit = 1 px
const SENSOR_ANGLE  = (30 * Math.PI) / 180; // ±30°
const SENSOR_MAX_PX = 500;      // max ray length in px
const EPS = 0.001;              // small epsilon for clamping

// OPTIONAL: flip left/right sensors if you prefer opposite convention (default false)
const SWAP_SIDES = false;

//--------------------------------------
// Robot state
//--------------------------------------
const robot = {
  x: canvas.width  * 0.5,
  y: canvas.height * 0.5,
  heading: 0,       // radians; 0 toward +X
  leftSpeed: 0,     // px/s
  rightSpeed: 0,    // px/s
  wheelBase: 40     // px
};

//--------------------------------------
// Obstacles (squares) — COMMENTED OUT
//--------------------------------------
// original squares kept here commented for easy restoration
/* const SQUARE_SIZE = 60;
const obstacles = [
  // left of center (~100px)
  { x: (canvas.width * 0.5) - 100 - (SQUARE_SIZE / 2), y: (canvas.height * 0.5) - (SQUARE_SIZE / 2), w: SQUARE_SIZE, h: SQUARE_SIZE },
  // right of center (~100px)
  { x: (canvas.width * 0.5) + 100 - (SQUARE_SIZE / 2), y: (canvas.height * 0.5) - (SQUARE_SIZE / 2), w: SQUARE_SIZE, h: SQUARE_SIZE }
]; */

// keep the size constant in case you re-enable later
const SQUARE_SIZE = 60;
// disabled obstacles
const obstacles = [];

// --- add rectangular walls (as two triangles each) and a small center square ---
const WALL_THICKNESS = 8;

function rectToTriangles(x, y, w, h){
  const v0 = { x: x,     y: y     };
  const v1 = { x: x + w, y: y     };
  const v2 = { x: x + w, y: y + h };
  const v3 = { x: x,     y: y + h };
  return [ { verts: [v0, v1, v2] }, { verts: [v0, v2, v3] } ];
}

const wallTriangles = [
  // top
  ...rectToTriangles(0, 0, canvas.width, WALL_THICKNESS),
  // bottom
  ...rectToTriangles(0, canvas.height - WALL_THICKNESS, canvas.width, WALL_THICKNESS),
  // left
  ...rectToTriangles(0, 0, WALL_THICKNESS, canvas.height),
  // right
  ...rectToTriangles(canvas.width - WALL_THICKNESS, 0, WALL_THICKNESS, canvas.height),
  // small centered square (40x40)
  //...rectToTriangles((canvas.width / 2) - 20, (canvas.height / 2) - 20, 40, 40)
];

//--------------------------------------
// Drawing helpers
//--------------------------------------
export function drawRobot(){
  const s = ROBOT_SIZE;
  ctx.save();
  ctx.translate(robot.x, robot.y);
  ctx.rotate(robot.heading);
  ctx.beginPath();
  ctx.moveTo(s, 0);
  ctx.lineTo(-s*0.6,  s*0.6);
  ctx.lineTo(-s*0.6, -s*0.6);
  ctx.closePath();
  ctx.fillStyle = '#0077cc';
  ctx.fill();
  ctx.restore();
}

export function drawObstacles(){
  ctx.save();
  ctx.fillStyle = '#444';

  // draw square obstacles
  for (const o of obstacles){
    ctx.fillRect(o.x, o.y, o.w, o.h);
  }

  // draw wall triangles (rectangles broken into two triangles)
  for (const wt of wallTriangles){
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

//--------------------------------------
// Sensors (Left / Center / Right)
//--------------------------------------
let sensorLeftUnits   = Infinity;
let sensorCenterUnits = Infinity;
let sensorRightUnits  = Infinity;

// sensor origin clamped inside canvas to avoid “outside → no hit” glitch
function sensorOrigin() {
  const fx = Math.cos(robot.heading) * SENSOR_OFFSET_PX;
  const fy = Math.sin(robot.heading) * SENSOR_OFFSET_PX;
  const sox = Math.min(canvas.width  - EPS, Math.max(EPS, robot.x + fx));
  const soy = Math.min(canvas.height - EPS, Math.max(EPS, robot.y + fy));
  return { sox, soy };
}

function updateSensors(){
  const { sox, soy } = sensorOrigin();
  // compute distances in UNITS (we multiply px by UNITS_PER_PX)
  const leftAng  = SWAP_SIDES ? robot.heading + SENSOR_ANGLE : robot.heading - SENSOR_ANGLE;
  const rightAng = SWAP_SIDES ? robot.heading - SENSOR_ANGLE : robot.heading + SENSOR_ANGLE;
  sensorLeftUnits   = castSensor(sox, soy, leftAng) * UNITS_PER_PX;
  sensorCenterUnits = castSensor(sox, soy, robot.heading   ) * UNITS_PER_PX;
  sensorRightUnits  = castSensor(sox, soy, rightAng) * UNITS_PER_PX;
}

function drawSensors(){
  ctx.save();
  ctx.strokeStyle = '#0f0';
  ctx.globalAlpha = 0.5;

  const { sox, soy } = sensorOrigin();
  // use same angle mapping as updateSensors
  const leftAng  = SWAP_SIDES ? robot.heading + SENSOR_ANGLE : robot.heading - SENSOR_ANGLE;
  const rightAng = SWAP_SIDES ? robot.heading - SENSOR_ANGLE : robot.heading + SENSOR_ANGLE;

  const ls_px = Math.min(sensorLeftUnits   / UNITS_PER_PX, SENSOR_MAX_PX);
  const cs_px = Math.min(sensorCenterUnits / UNITS_PER_PX, SENSOR_MAX_PX);
  const rs_px = Math.min(sensorRightUnits  / UNITS_PER_PX, SENSOR_MAX_PX);

  // Left ray
  const lx = sox + Math.cos(leftAng) * ls_px;
  const ly = soy + Math.sin(leftAng) * ls_px;
  ctx.beginPath();
  ctx.moveTo(sox, soy);
  ctx.lineTo(lx, ly);
  ctx.stroke();

  // Center ray
  const cx = sox + Math.cos(robot.heading) * cs_px;
  const cy = soy + Math.sin(robot.heading) * cs_px;
  ctx.beginPath();
  ctx.moveTo(sox, soy);
  ctx.lineTo(cx, cy);
  ctx.stroke();

  // Right ray
  const rx = sox + Math.cos(rightAng) * rs_px;
  const ry = soy + Math.sin(rightAng) * rs_px;
  ctx.beginPath();
  ctx.moveTo(sox, soy);
  ctx.lineTo(rx, ry);
  ctx.stroke();

  // Draw small endpoint markers and labels so you can visually verify which is L/R
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#0f0';
  const markRadius = 4;
  // left marker + label
  ctx.beginPath(); ctx.arc(lx, ly, markRadius, 0, Math.PI*2); ctx.fill();
  ctx.font = '12px monospace';
  ctx.fillText('L', lx + 6, ly + 4);
  // center marker + label
  ctx.beginPath(); ctx.arc(cx, cy, markRadius, 0, Math.PI*2); ctx.fill();
  ctx.fillText('C', cx + 6, cy + 4);
  // right marker + label
  ctx.beginPath(); ctx.arc(rx, ry, markRadius, 0, Math.PI*2); ctx.fill();
  ctx.fillText('R', rx + 6, ry + 4);

  ctx.restore();
}

// Heads-up display for quick debugging
function drawHUD(){
  const lineH = 16;
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#000';
  ctx.fillRect(6, 6, 180, 4 + 3*lineH + 8);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#0f0';
  ctx.font = '12px monospace';
  const Lpx = Math.round(sensorLeftUnits   / UNITS_PER_PX);
  const Cpx = Math.round(sensorCenterUnits / UNITS_PER_PX);
  const Rpx = Math.round(sensorRightUnits  / UNITS_PER_PX);
  ctx.fillText(`L: ${Lpx}px / ${Math.round(sensorLeftUnits)}u`,   12, 24);
  ctx.fillText(`C: ${Cpx}px / ${Math.round(sensorCenterUnits)}u`, 12, 24 + lineH);
  ctx.fillText(`R: ${Rpx}px / ${Math.round(sensorRightUnits)}u`,  12, 24 + 2*lineH);
  ctx.restore();
}

//--------------------------------------
// Ray casting (triangles + canvas edges)
//--------------------------------------
function castSensor(x, y, ang){
  // Ray-triangle intersections; return nearest distance in px, or large number
  let minDist = SENSOR_MAX_PX;

  // Ray parametric form: P(t) = (x, y) + t*(dx, dy), t >= 0
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);

  // treat each square obstacle as two triangles (use rectToTriangles)
  for (const o of obstacles){
    const tris = rectToTriangles(o.x, o.y, o.w, o.h);
    for (const tri of tris){
      const verts = tri.verts;

      if (pointInTriangle({ x, y }, verts[0], verts[1], verts[2])){
        minDist = 0;
        continue;
      }

      for (let e = 0; e < 3; e++){
        const A = verts[e];
        const B = verts[(e + 1) % 3];
        const sx = B.x - A.x;
        const sy = B.y - A.y;

        const rx = A.x - x;
        const ry = A.y - y;

        const denom = sx * dy - dx * sy;
        if (Math.abs(denom) < 1e-9) continue;

        const t = (sx * ry - rx * sy) / denom;
        const u = (dx * ry - dy * rx) / denom;

        if (t >= 0 && u >= 0 && u <= 1){
          if (t < minDist) minDist = t;
        }
      }
    }
  }

  // also check wallTriangles (pre-computed triangle verts)
  for (const wt of wallTriangles){
    const verts = wt.verts;

    if (pointInTriangle({ x, y }, verts[0], verts[1], verts[2])){
      minDist = 0;
      continue;
    }

    for (let e = 0; e < 3; e++){
      const A = verts[e];
      const B = verts[(e + 1) % 3];
      const sx = B.x - A.x;
      const sy = B.y - A.y;

      const rx = A.x - x;
      const ry = A.y - y;

      const denom = sx * dy - dx * sy;
      if (Math.abs(denom) < 1e-9) continue;

      const t = (sx * ry - rx * sy) / denom;
      const u = (dx * ry - dy * rx) / denom;

      if (t >= 0 && u >= 0 && u <= 1){
        if (t < minDist) minDist = t;
      }
    }
  }

  const edgeDist = distanceToCanvasEdgeRay(x, y, ang);
  minDist = Math.min(minDist, edgeDist);
  return Math.min(minDist, SENSOR_MAX_PX);
  // Also consider the canvas edges as obstacles

}

function distanceToCanvasEdgeRay(x, y, ang){
  const dx = Math.cos(ang), dy = Math.sin(ang);
  const EPS_RAY = 1e-9;
  const ts = [];

  if (Math.abs(dx) > EPS_RAY){
    const tL = (0 - x) / dx;
    const tR = (canvas.width - x) / dx;
    if (tL >= 0) ts.push(tL);
    if (tR >= 0) ts.push(tR);
  }
  if (Math.abs(dy) > EPS_RAY){
    const tT = (0 - y) / dy;
    const tB = (canvas.height - y) / dy;
    if (tT >= 0) ts.push(tT);
    if (tB >= 0) ts.push(tB);
  }
  return ts.length ? Math.min(...ts) : SENSOR_MAX_PX;
}

// barycentric sign test
function pointInTriangle(p, a, b, c){
  function sign(p1, p2, p3){
    return (p1.x - p3.x)*(p2.y - p3.y) - (p2.x - p3.x)*(p1.y - p3.y);
  }
  const d1 = sign(p,a,b), d2 = sign(p,b,c), d3 = sign(p,c,a);
  const hasNeg = (d1<0)||(d2<0)||(d3<0);
  const hasPos = (d1>0)||(d2>0)||(d3>0);
  return !(hasNeg && hasPos);
}

//--------------------------------------
// Physics with hard collisions
//--------------------------------------
function stepPhysics(dt){
  const vl = robot.leftSpeed;
  const vr = robot.rightSpeed;
  const wb = robot.wheelBase;

  const v = (vr + vl) / 2;
  const omega = (vr - vl) / wb;

  const prevX = robot.x;
  const prevY = robot.y;

  robot.heading += omega * dt;
  robot.x += v * Math.cos(robot.heading) * dt;
  robot.y += v * Math.sin(robot.heading) * dt;

  // walls: clamp + mark hit
  let hit = false;
  if (robot.x < 0)                 { robot.x = 0;                 hit = true; }
  if (robot.x > canvas.width)      { robot.x = canvas.width;      hit = true; }
  if (robot.y < 0)                 { robot.y = 0;                 hit = true; }
  if (robot.y > canvas.height)     { robot.y = canvas.height;     hit = true; }

  // triangles: circle-vs-triangle overlap
  if (!hit && collidesWithAnyTriangle(robot.x, robot.y, ROBOT_RADIUS)){
    robot.x = prevX;
    robot.y = prevY;
    hit = true;
  }

  if (hit){
    robot.leftSpeed = 0;
    robot.rightSpeed = 0;
  }
}

function collidesWithAnyTriangle(x, y, R){
  // test square obstacles (convert each rectangle to two triangles)
  for (const o of obstacles){
    const tris = rectToTriangles(o.x, o.y, o.w, o.h);
    for (const tri of tris){
      if (circleTriangleOverlap({x,y}, R, tri.verts)) return true;
    }
  }

  // test wall triangles and center square (already in triangle form)
  for (const wt of wallTriangles){
    if (circleTriangleOverlap({x,y}, R, wt.verts)) return true;
  }

  return false;
}

function circleTriangleOverlap(c, r, verts){
  if (pointInTriangle(c, verts[0], verts[1], verts[2])) return true;
  for (let i=0;i<3;i++){
    const a = verts[i], b = verts[(i+1)%3];
    if (pointSegDist(c, a, b) <= r) return true;
  }
  return false;
}

function pointSegDist(p, a, b){
  const vx = b.x - a.x, vy = b.y - a.y;
  const wx = p.x - a.x, wy = p.y - a.y;
  const L2 = vx*vx + vy*vy;
  const t = L2 ? Math.max(0, Math.min(1, (wx*vx + wy*vy)/L2)) : 0;
  const px = a.x + t*vx, py = a.y + t*vy;
  const dx = p.x - px, dy = p.y - py;
  return Math.hypot(dx, dy);
}

// --------------------------------------
// DSL Parser  (numbers are PIXELS by default → converted to UNITS)
// --------------------------------------
function parseProgram(text){
  const lines = text.split(/\r?\n/);
  let i = 0;

  const reSetLeft   = /^\s*SET\s+LEFT\s+(-?\d+)\s*$/i;
  const reSetRight  = /^\s*SET\s+RIGHT\s+(-?\d+)\s*$/i;
  const reWait      = /^\s*WAIT\s+(\d+)\s*$/i;
  const reStop      = /^\s*STOP\s*$/i;
  const reComment   = /^\s*#.*$/;

  // optional " PX" suffix captured in group 4 (not required; we still treat numbers as px by default)
  const reIf     = /^\s*IF\s+(SENSOR_LEFT|SENSOR_RIGHT|SENSOR_CENTER)\s*(<|<=|>|>=|==|!=)\s*(\d+)\s*(PX)?\s*$/i;
  const reElseIf = /^\s*ELSE\s+IF\s+(SENSOR_LEFT|SENSOR_RIGHT|SENSOR_CENTER)\s*(<|<=|>|>=|==|!=)\s*(\d+)\s*(PX)?\s*$/i;
  const reElse   = /^\s*ELSE\s*$/i;
  const reEnd    = /^\s*END\s*$/i;

  function parseBlock(endTokens){
    const out = [];
    while (i < lines.length){
      const line = lines[i];

      if (!line.trim() || reComment.test(line)) { i++; continue; }

      if (endTokens && endTokens.some(rx => rx.test(line))){
        return out; // stop before consuming the terminator
      }

      let m;
      if (m = line.match(reSetLeft)){
        out.push({ type:'setLeft', value: clamp(parseInt(m[1],10), -100, 100) }); i++; continue;
      }
      if (m = line.match(reSetRight)){
        out.push({ type:'setRight', value: clamp(parseInt(m[1],10), -100, 100) }); i++; continue;
      }
      if (m = line.match(reWait)){
        out.push({ type:'wait', ms: parseInt(m[1],10) }); i++; continue;
      }
      if (reStop.test(line)){
        out.push({ type:'stop' }); i++; continue;
      }
      if (m = line.match(reIf)){
        i++; out.push(parseIf(m)); continue;
      }

      // Allow top-level END as no-op
      if (!endTokens && reEnd.test(line)) { i++; continue; }

      throw new Error(`Syntax error on line ${i+1}: "${line}"`);
    }
    return out;
  }

  function parseIf(firstMatch){
    const node = {
      type: 'if',
      branches: [{
        cond: {
          sensor: firstMatch[1].toUpperCase(),
          op: firstMatch[2],
          // treat the number as PIXELS by default → convert to UNITS
          value: Math.round(parseInt(firstMatch[3],10) * UNITS_PER_PX)
        },
        actions: []
      }],
      elseActions: null
    };

    // THEN block
    node.branches[0].actions = parseBlock([reElseIf, reElse, reEnd]);

    // zero or more ELSE IF, optional ELSE, then END
    while (i < lines.length){
      const line = lines[i];
      if (!line.trim() || reComment.test(line)) { i++; continue; }

      let m;
      if (m = line.match(reElseIf)){
        i++;
        node.branches.push({
          cond: {
            sensor: m[1].toUpperCase(),
            op: m[2],
            value: Math.round(parseInt(m[3],10) * UNITS_PER_PX)
          },
          actions: parseBlock([reElseIf, reElse, reEnd])
        });
        continue;
      }

      if (reElse.test(line)){
        i++;
        node.elseActions = parseBlock([reEnd]);
        if (i >= lines.length || !reEnd.test(lines[i])){
          throw new Error(`Missing END after ELSE block (near line ${i+1}).`);
        }
        i++; // consume END
        break;
      }

      if (reEnd.test(line)){ i++; break; }

      throw new Error(`Unexpected token inside IF at line ${i+1}: "${line}"`);
    }
    return node;
  }

  return parseBlock(null);
}

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

// cheap deep clone helper (use structuredClone if available)
export const clone = (o) => (typeof structuredClone === 'function'
  ? structuredClone(o)
  : JSON.parse(JSON.stringify(o)));

// Add a loader that parses user text and installs ast/program inside this module.
// Returns the parsed AST for callers that want to inspect it.
export function loadProgramFromText(text){
  const parsed = parseProgram(text);
  ast = parsed;
  program = clone(parsed);
  return parsed;
}

//--------------------------------------
// Runner (auto-looping program + step budget)
//--------------------------------------
let rafId = null;
// immutable AST (parsed once on Run)
let ast = [];
// mutable executable list (we may splice this during execution)
let program = [];
let pc = 0;
let waitLeftMs = 0;
let lastTime = 0;
let stopping = false;

// export simulation control / draw helpers so main.js can call them
export function resetRobot(){
  robot.x = canvas.width  * 0.5;
  robot.y = canvas.height * 0.5;
  robot.heading = 0;
  robot.leftSpeed = 0;
  robot.rightSpeed = 0;
}

export function programState(state){
  if (state === false){
    stopping = false;
    pc = 0;
    waitLeftMs = 0;
    lastTime = performance.now();
    loop();
  } else {
    stopping = true;
  }
}

function loop(now){
  if (stopping){ cancelAnimationFrame(rafId); return; }
  rafId = requestAnimationFrame(loop);

  // timing
  const t = performance.now();
  const dtMs = t - lastTime;
  lastTime = t;

  updateSensors();

  // execute actions
  let advanced = true;
  let stepsBudget = 500;
  while (advanced && !stopping){
    if (--stepsBudget <= 0) break;
    advanced = false;

    if (pc >= program.length){
      // when we wrap, restore the program from the immutable ast so IFs re-evaluate
      if (ast.length === 0) break;
      program = clone(ast);   // << restore IF nodes for fresh evaluation
      pc = 0;                 // reset program counter
      advanced = true;
      continue;
    }

    const action = program[pc];

    if (action.type === 'if'){
      function evalCond(cond){
        let sv;
        if (cond.sensor === 'SENSOR_LEFT')   sv = sensorLeftUnits;
        else if (cond.sensor === 'SENSOR_RIGHT') sv = sensorRightUnits;
        else                                   sv = sensorCenterUnits; // center

        const v = cond.value;
        switch(cond.op){
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
      for (const br of action.branches){
        if (evalCond(br.cond)){ chosen = br.actions; break; }
      }
      const toInsert = chosen || action.elseActions || [];
      program.splice(pc, 1, ...toInsert);
      if (toInsert.length === 0) { advanced = true; }
      continue;
    }

    if (action.type === 'setLeft'){
      robot.leftSpeed = action.value; advanced = true; pc++;
    } else if (action.type === 'setRight'){
      robot.rightSpeed = action.value; advanced = true; pc++;
    } else if (action.type === 'stop'){
      robot.leftSpeed = 0; robot.rightSpeed = 0; advanced = true; pc++;
    } else if (action.type === 'wait'){
      if (waitLeftMs <= 0) waitLeftMs = action.ms;
      waitLeftMs -= dtMs;
      if (waitLeftMs <= 0){ waitLeftMs = 0; advanced = true; pc++; }
      else break; // continue waiting next frame
    } else {
      pc++; // unknown action: skip
    }
  }

  // physics & draw
  stepPhysics(dtMs / 1000);
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawRobot();
  drawObstacles();
  drawSensors();
  drawHUD();
}

//--------------------------------------
// (Optional) Example of running a program
//--------------------------------------
// Example usage if you have an editor:
// const userCode = editor.getValue();
// program = parseProgram(userCode);
// programState(false); // start
// programState(true);  // stop


//--------------------------------------
// (Optional) Example of running a program
//--------------------------------------
// Example usage if you have an editor:
// const userCode = editor.getValue();
// program = parseProgram(userCode);
// programState(false); // start
// programState(true);  // stop


