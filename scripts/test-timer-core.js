const assert = require("assert");
const TimerCore = require("../src/timer-core");

function test(name, fn) {
  fn();
  console.log("ok  " + name);
}

test("formats countdown without hours", () => {
  assert.strictEqual(TimerCore.formatDuration(20 * 60 * 1000), "20:00");
  assert.strictEqual(TimerCore.formatDuration(5 * 1000), "00:05");
});

test("overtime is shown with a plus", () => {
  assert.strictEqual(TimerCore.formatDuration(-1500), "+00:01");
});

test("start then pause freezes elapsed", () => {
  let state = TimerCore.createState();
  const t0 = Date.now();
  state = TimerCore.apply(state, { type: "start" });
  assert.strictEqual(state.running, true);
  const elapsed = TimerCore.nowElapsed(state, t0 + 2500);
  assert.ok(elapsed >= 2400 && elapsed <= 2600, "elapsed " + elapsed);
  state.elapsedMs = elapsed;
  state.running = false;
  state.startedAt = null;
  assert.strictEqual(TimerCore.nowElapsed(state, t0 + 9000), elapsed);
});

test("preset switches to countdown and resets", () => {
  let state = TimerCore.createState({ mode: "stopwatch", elapsedMs: 9999, running: true });
  state = TimerCore.apply(state, { type: "set-preset", min: 15 });
  assert.strictEqual(state.mode, "countdown");
  assert.strictEqual(state.durationMs, 15 * 60 * 1000);
  assert.strictEqual(state.running, false);
  assert.strictEqual(state.elapsedMs, 0);
});

test("snapshot marks overtime after duration", () => {
  const state = TimerCore.createState({
    mode: "countdown",
    durationMs: 10000,
    elapsedMs: 12500,
    running: false,
    startedAt: null,
  });
  const snap = TimerCore.snapshot(state);
  assert.strictEqual(snap.overtime, true);
  assert.strictEqual(snap.display, "+00:02");
  assert.strictEqual(snap.progress, 1);
});

test("clock snapshot is a wall-clock string", () => {
  const snap = TimerCore.snapshot(TimerCore.createState({ mode: "clock" }));
  assert.match(snap.display, /\d{1,2}:\d{2}:\d{2} (AM|PM)/);
});

console.log("All timer-core tests passed.");
