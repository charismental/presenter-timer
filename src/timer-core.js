(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.TimerCore = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const DEFAULT_PRESETS = [5, 10, 15, 20, 30, 45];

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function createState(saved) {
    return Object.assign(
      {
        mode: "countdown",
        running: false,
        durationMs: 20 * 60 * 1000,
        elapsedMs: 0,
        startedAt: null,
        overtimeFlash: true,
        showProgress: true,
        showSecondaryClock: false,
        clickThrough: true,
        alwaysOnTop: true,
        opacity: 0.88,
        theme: "stage",
        presetsMin: DEFAULT_PRESETS.slice(),
      },
      saved || {}
    );
  }

  function nowElapsed(state, now) {
    now = now || Date.now();
    if (!state.running || state.startedAt == null) return state.elapsedMs;
    return state.elapsedMs + (now - state.startedAt);
  }

  function formatDuration(ms, alwaysHours) {
    const negative = ms < 0;
    const abs = Math.abs(ms);
    const totalSec = Math.floor(abs / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const body =
      h > 0 || alwaysHours
        ? h + ":" + pad(m) + ":" + pad(s)
        : pad(m) + ":" + pad(s);
    return (negative ? "+" : "") + body;
  }

  function formatClock(now) {
    now = now || new Date();
    const d = now instanceof Date ? now : new Date(now);
    let h = d.getHours();
    const m = pad(d.getMinutes());
    const s = pad(d.getSeconds());
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return h + ":" + m + ":" + s + " " + ampm;
  }

  function snapshot(state, now) {
    now = now || Date.now();
    const elapsed = nowElapsed(state, now);
    if (state.mode === "clock") {
      return {
        elapsed: 0,
        display: formatClock(now),
        overtime: false,
        progress: 0,
        label: "CLOCK",
      };
    }
    if (state.mode === "stopwatch") {
      return {
        elapsed: elapsed,
        display: formatDuration(elapsed, elapsed >= 3600000),
        overtime: false,
        progress: 0,
        label: "STOPWATCH",
      };
    }
    const remaining = state.durationMs - elapsed;
    const overtime = remaining < 0;
    const progress =
      state.durationMs > 0
        ? Math.min(1, Math.max(0, elapsed / state.durationMs))
        : 0;
    return {
      elapsed: elapsed,
      display: formatDuration(remaining, state.durationMs >= 3600000),
      overtime: overtime,
      progress: progress,
      label: overtime ? "OVERTIME" : "COUNTDOWN",
    };
  }

  function apply(state, cmd) {
    const next = Object.assign({}, state);
    if (next.presetsMin) next.presetsMin = next.presetsMin.slice();

    switch (cmd.type) {
      case "start":
        if (!next.running) {
          next.running = true;
          next.startedAt = Date.now();
        }
        break;
      case "pause":
        if (next.running) {
          next.elapsedMs = nowElapsed(next);
          next.running = false;
          next.startedAt = null;
        }
        break;
      case "toggle":
        return apply(state, { type: state.running ? "pause" : "start" });
      case "reset":
        next.running = false;
        next.elapsedMs = 0;
        next.startedAt = null;
        break;
      case "set-mode":
        next.mode = cmd.mode;
        next.running = false;
        next.elapsedMs = 0;
        next.startedAt = null;
        break;
      case "set-duration":
        next.durationMs = Math.max(1000, Math.round(cmd.ms));
        break;
      case "adjust":
        if (next.mode === "countdown") {
          next.durationMs = Math.max(1000, next.durationMs + cmd.ms);
        } else if (next.mode === "stopwatch" && !next.running) {
          next.elapsedMs = Math.max(0, next.elapsedMs + cmd.ms);
        }
        break;
      case "set-preset":
        next.mode = "countdown";
        next.durationMs = Math.max(1000, cmd.min * 60 * 1000);
        next.elapsedMs = 0;
        next.running = false;
        next.startedAt = null;
        break;
      case "patch":
        Object.keys(cmd.patch || {}).forEach(function (key) {
          next[key] = cmd.patch[key];
        });
        break;
      default:
        break;
    }
    return next;
  }

  return {
    DEFAULT_PRESETS: DEFAULT_PRESETS,
    pad: pad,
    createState: createState,
    nowElapsed: nowElapsed,
    formatDuration: formatDuration,
    formatClock: formatClock,
    snapshot: snapshot,
    apply: apply,
  };
});
