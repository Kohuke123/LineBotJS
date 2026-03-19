# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from `my-js-app/`:

```bash
npm run dev      # Start dev server (hot reload)
npm run build    # Production build → dist/
npm run preview  # Preview production build locally
```

## Architecture

**LineBotJS** is a browser-based robot simulator with a custom DSL interpreter. Users write programs in a simple robot-control language and watch a 2D robot navigate in real time on an HTML5 Canvas.

### Entry Points

- `index.html` — Loads Monaco Editor from CDN, defines the 2-column UI layout (controls + editor on right, canvas on left).
- `src/main.js` — Initializes Monaco Editor, sets up the canvas context, and wires all button events (Run, Stop) to functions in `robot.js`. Also manages Challenge Mode state, sensor readout display, execution status bar, and run history.
- `src/robot.js` — The entire simulation engine.

### robot.js Structure

The file is organized into sequential sections:

1. **Robot state & constants** — position `(x, y)`, heading `angle`, `leftSpeed`/`rightSpeed`, wheelbase, robot dimensions.
2. **Obstacle & wall geometry** — rectangles decomposed into triangle pairs for collision math; boundary walls around the canvas.
3. **Sensor system** — three ray sensors (left ±30°, center, right ±30°) with HUD overlay showing distances in pixels and normalized units.
4. **Raycasting engine** — ray–triangle intersection using closed-form math and barycentric tests.
5. **Physics & collision** — differential drive kinematics; hard collision clamping against walls and obstacle triangles; friction stops wheels on impact.
6. **DSL parser** — produces an immutable AST from the user's text program. Supported commands:
   - `SET LEFT N` / `SET RIGHT N` (speed −100…100)
   - `WAIT T` (milliseconds)
   - `STOP`
   - `SENSOR_LEFT` / `SENSOR_CENTER` / `SENSOR_RIGHT` (read distance)
   - `IF <expr> … ELSE IF … ELSE … END` (comparators: `<` `<=` `>` `>=` `==` `!=`)
   - `#` line comments
7. **Execution engine** — `requestAnimationFrame` loop with a program counter; budget of 500 steps/frame prevents infinite loops; programs loop automatically.
8. **Maze system** — `setMaze(key)` loads obstacle geometry, goal rect, and a start position `{ x, y, heading }` stored in `startPos`. `resetRobot()` returns the robot to `startPos` when a maze is active, or canvas centre for the beginner tab. `clearMaze()` removes all maze state.
9. **Exported API** — `loadProgramFromText`, `programState`, `resetRobot`, `drawRobot`, `drawObstacles`, `setMaze`, `clearMaze`, `checkGoal`, `getGoalRect`, `isMoving`, `setFrameCallback`, `getSensors`, `getStats`, `setLogger`, `getExecState`.

### Data Flow

```
User types DSL code in Monaco Editor
  → Run button → parseProgram() → AST
  → startProgram(ast) → animation loop
      → stepPhysics() (kinematics + collision)
      → updateSensors() (raycasting)
      → executeStep() (program counter + DSL dispatch)
      → drawFrame() (canvas render)
```

### CSS

- `src/style.css` — main layout (two-column grid, controls, console)
- `src/syntax.css` — syntax quick-reference card styles

Both are imported by `src/main.js` and bundled by Vite.

### Monaco Editor

Loaded from CDN (v0.45.0) via AMD `require`. `main.js` wraps all DOM/editor setup in `boot()`, which is called only after Monaco's AMD loader fires. The editor uses JS syntax highlighting but with all diagnostics disabled so DSL code doesn't show red squiggles.

### Tabs

There are two simulation tabs sharing the same `wireTab()` wiring helper in `main.js`:

- **Beginner** — free-form sandbox, no maze, robot starts at canvas centre.
- **Advanced** — Challenge Mode with selectable mazes. The Run button calls `loadMaze()` as `preRun`, which resets the maze and starts the challenge timer. The timer starts when the robot first moves; reaching the goal stops the timer and records a result (Gold/Silver/Bronze) against par times defined per maze in `MAZES`.

Run history is persisted to `localStorage` (`challengeHistory`). The Reset button has been removed; the Run button now automatically resets the robot and clears the canvas before starting.

### Persistence

Code is saved/loaded via `localStorage` (key: `userCode` for beginner, `userCode-advanced` for advanced). Run history stored under `challengeHistory`. No backend or server state.

### Robot Visual

The robot is drawn as a cute pink kitty car (`drawRobot()` in `robot.js`): rounded pink body, cat ears on the front edge, dot eyes with shine, a pink nose, and a red bow on the rear. Front of the car = direction of travel (positive x in local space). The visual is purely cosmetic — collision and sensor logic use `ROBOT_RADIUS` / `ROBOT_SIZE` constants, not the drawn shape.

### IF Node Execution

`IF` nodes are not branched via a program counter jump. Instead, when the executor encounters an `if` node it **splices** the chosen branch's actions in-place into the mutable `program` array, replacing the `if` node. The immutable `ast` is cloned fresh into `program` on every loop iteration so `IF` conditions re-evaluate each pass.

### Build Output

`vite build` emits `dist/` with a relative base path (`./`) so the app can be served from any subdirectory or opened as a local file.
