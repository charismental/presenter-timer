(function () {
  const api = window.presenter;
  const isElectron = !!(api && api.isElectron);
  const widget = document.getElementById("widget");
  const digits = document.getElementById("digits");
  const ampm = document.getElementById("ampm");
  const secondary = document.getElementById("secondary");
  const progress = document.getElementById("progress");
  const bar = document.getElementById("bar");
  const presetsEl = document.getElementById("presets");
  const toggleBtn = document.getElementById("btn-toggle");
  const resetBtn = document.getElementById("btn-reset");
  const minusBtn = document.getElementById("btn-minus");
  const plusBtn = document.getElementById("btn-plus");
  const controlsBtn = document.getElementById("btn-controls");

  let state = TimerCore.createState();
  if (!isElectron) state.clickThrough = false;

  function blurToSlides() {
    if (isElectron) return;
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
    try {
      window.parent.focus();
    } catch (_err) {}
  }

  function send(cmd) {
    const result = isElectron ? api.command(cmd) : Promise.resolve((state = TimerCore.apply(state, cmd)));
    if (!isElectron) renderChrome();
    blurToSlides();
    return result;
  }

  function renderChrome() {
    widget.classList.toggle("theme-stage", state.theme === "stage");
    widget.classList.toggle("theme-light", state.theme === "light");
    widget.classList.toggle("theme-high", state.theme === "high");
    widget.dataset.clickThrough = state.clickThrough ? "true" : "false";
    widget.style.setProperty("--bg", overlayBg());
    toggleBtn.textContent = state.running ? "Pause" : "Start";
    presetsEl.innerHTML = "";
    (state.presetsMin || []).forEach(function (min) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = min + "m";
      btn.addEventListener("click", function (event) {
        event.stopPropagation();
        send({ type: "set-preset", min: min });
      });
      presetsEl.appendChild(btn);
    });
  }

  function overlayBg() {
    const a = Math.max(0.25, Math.min(1, Number(state.opacity) || 0.88));
    if (state.theme === "light") return "rgba(250, 246, 239, " + a + ")";
    if (state.theme === "high") return "rgba(0, 0, 0, " + Math.max(a, 0.85) + ")";
    return "rgba(16, 13, 11, " + a + ")";
  }

  function paint() {
    const snap = TimerCore.snapshot(state);
    if (state.mode === "clock") {
      const parts = TimerCore.formatClockParts();
      digits.textContent = parts.time;
      ampm.hidden = false;
      ampm.textContent = parts.ampm;
    } else {
      digits.textContent = snap.display;
      ampm.hidden = true;
    }
    widget.classList.toggle("overtime", !!(snap.overtime && state.overtimeFlash));
    progress.hidden = !(state.showProgress && state.mode === "countdown");
    bar.style.width = Math.round(snap.progress * 100) + "%";
    if (state.showSecondaryClock && state.mode !== "clock") {
      secondary.hidden = false;
      secondary.textContent = TimerCore.formatClock();
    } else {
      secondary.hidden = true;
    }
    requestAnimationFrame(paint);
  }

  toggleBtn.addEventListener("click", function () {
    send({ type: "toggle" });
  });
  resetBtn.addEventListener("click", function () {
    send({ type: "reset" });
  });
  minusBtn.addEventListener("click", function () {
    send({ type: "adjust", ms: -60000 });
  });
  plusBtn.addEventListener("click", function () {
    send({ type: "adjust", ms: 60000 });
  });
  controlsBtn.addEventListener("click", function () {
    if (isElectron) api.openControls();
  });

  if (isElectron) {
    api.getState().then(function (next) {
      state = next;
      renderChrome();
    });
    api.onState(function (next) {
      state = next;
      renderChrome();
    });
  } else {
    controlsBtn.hidden = true;
    renderChrome();
  }

  paint();
})();
