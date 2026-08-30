(function () {
  const api = window.presenter;
  const isElectron = !!(api && api.isElectron);

  const liveLabel = document.getElementById("live-label");
  const liveDigits = document.getElementById("live-digits");
  const liveStatus = document.getElementById("live-status");
  const previewCard = document.querySelector(".preview-card");
  const toggleBtn = document.getElementById("btn-toggle");
  const hoursEl = document.getElementById("hours");
  const minutesEl = document.getElementById("minutes");
  const secondsEl = document.getElementById("seconds");
  const presetsEl = document.getElementById("presets");

  let state = TimerCore.createState();

  function send(cmd) {
    if (isElectron) return api.command(cmd);
    state = TimerCore.apply(state, cmd);
    syncForm();
    return Promise.resolve(state);
  }

  function durationFromInputs() {
    const h = Math.max(0, Number(hoursEl.value) || 0);
    const m = Math.max(0, Number(minutesEl.value) || 0);
    const s = Math.max(0, Number(secondsEl.value) || 0);
    return ((h * 3600 + m * 60 + s) * 1000) || 1000;
  }

  function fillDurationInputs(ms) {
    const total = Math.max(0, Math.round(ms / 1000));
    hoursEl.value = String(Math.floor(total / 3600));
    minutesEl.value = String(Math.floor((total % 3600) / 60));
    secondsEl.value = String(total % 60);
  }

  function syncForm() {
    document.querySelectorAll("[data-mode]").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.mode === state.mode);
    });
    document.querySelectorAll("[data-theme]").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.theme === state.theme);
    });
    toggleBtn.textContent = state.running ? "Pause" : "Start";
    document.getElementById("click-through").checked = !!state.clickThrough;
    document.getElementById("always-on-top").checked = !!state.alwaysOnTop;
    document.getElementById("overtime-flash").checked = !!state.overtimeFlash;
    document.getElementById("show-progress").checked = !!state.showProgress;
    document.getElementById("show-clock").checked = !!state.showSecondaryClock;
    document.getElementById("opacity").value = String(
      Math.round((Number(state.opacity) || 0.88) * 100)
    );
    fillDurationInputs(state.durationMs);

    presetsEl.innerHTML = "";
    (state.presetsMin || []).forEach(function (min) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = min + " min";
      btn.addEventListener("click", function () {
        send({ type: "set-preset", min: min });
      });
      presetsEl.appendChild(btn);
    });
  }

  function paint() {
    const snap = TimerCore.snapshot(state);
    liveDigits.textContent = snap.display;
    liveLabel.textContent = snap.label;
    previewCard.classList.toggle("overtime", !!(snap.overtime && state.overtimeFlash));
    if (state.mode === "clock") {
      liveStatus.textContent = "Wall clock · clicker still goes to your slides";
    } else if (state.running) {
      liveStatus.textContent = snap.overtime ? "Over time" : "Running";
    } else if (state.elapsedMs > 0) {
      liveStatus.textContent = "Paused";
    } else {
      liveStatus.textContent = "Ready";
    }
    requestAnimationFrame(paint);
  }

  document.querySelectorAll("[data-mode]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      send({ type: "set-mode", mode: btn.dataset.mode });
    });
  });
  document.querySelectorAll("[data-theme]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      send({ type: "patch", patch: { theme: btn.dataset.theme } });
    });
  });

  toggleBtn.addEventListener("click", function () {
    send({ type: "toggle" });
  });
  document.getElementById("btn-reset").addEventListener("click", function () {
    send({ type: "reset" });
  });
  document.getElementById("btn-minus").addEventListener("click", function () {
    send({ type: "adjust", ms: -60000 });
  });
  document.getElementById("btn-plus").addEventListener("click", function () {
    send({ type: "adjust", ms: 60000 });
  });
  document.getElementById("btn-apply").addEventListener("click", function () {
    send({ type: "set-duration", ms: durationFromInputs() });
  });

  ["click-through", "always-on-top", "overtime-flash", "show-progress", "show-clock"].forEach(
    function (id) {
      document.getElementById(id).addEventListener("change", function (event) {
        const map = {
          "click-through": "clickThrough",
          "always-on-top": "alwaysOnTop",
          "overtime-flash": "overtimeFlash",
          "show-progress": "showProgress",
          "show-clock": "showSecondaryClock",
        };
        const patch = {};
        patch[map[id]] = event.target.checked;
        send({ type: "patch", patch: patch });
      });
    }
  );

  document.getElementById("opacity").addEventListener("input", function (event) {
    send({ type: "patch", patch: { opacity: Number(event.target.value) / 100 } });
  });

  document.addEventListener("keydown", function (event) {
    if (event.target.matches("input")) return;
    if (event.code === "Space") {
      event.preventDefault();
      send({ type: "toggle" });
    } else if (event.key.toLowerCase() === "r") {
      send({ type: "reset" });
    }
  });

  if (isElectron) {
    api.getState().then(function (next) {
      state = next;
      syncForm();
    });
    api.onState(function (next) {
      state = next;
      syncForm();
    });
  } else {
    syncForm();
  }

  paint();
})();
