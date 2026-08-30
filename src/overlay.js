(function () {
  const api = window.presenter;
  const isElectron = !!(api && api.isElectron);
  const widget = document.getElementById("widget");
  const display = document.getElementById("display");
  const digits = document.getElementById("digits");
  const ampm = document.getElementById("ampm");
  const secondary = document.getElementById("secondary");
  const progress = document.getElementById("progress");
  const bar = document.getElementById("bar");
  const toggleBtn = document.getElementById("btn-toggle");
  const resetBtn = document.getElementById("btn-reset");
  const minusBtn = document.getElementById("btn-minus");
  const plusBtn = document.getElementById("btn-plus");
  const controlsBtn = document.getElementById("btn-controls");
  const hideBtn = document.getElementById("btn-hide");
  const chromeEl = document.getElementById("chrome");
  const hotspot = document.getElementById("chrome-hotspot");

  const MIN_W = 180;
  const MIN_H = 88;

  let state = TimerCore.createState();
  if (!isElectron) state.clickThrough = false;

  let lastBounds = null;
  let interact = null;
  let hideChromeTimer = null;
  let chromeLocked = false;

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
    if (state.clickThrough) hideChrome(false);
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
      const parts = TimerCore.formatClockParts
        ? TimerCore.formatClockParts()
        : { time: snap.display.replace(/ (AM|PM)$/, ""), ampm: /PM$/.test(snap.display) ? "PM" : "AM" };
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
  }

  function canInteract() {
    return !state.clickThrough;
  }

  function requestShowChrome() {
    clearTimeout(hideChromeTimer);
    if (!canInteract() || chromeLocked) return;
    widget.classList.add("show-chrome");
  }

  function hideChrome(lock) {
    clearTimeout(hideChromeTimer);
    widget.classList.remove("show-chrome");
    chromeLocked = !!lock;
  }

  function scheduleHideChrome() {
    clearTimeout(hideChromeTimer);
    hideChromeTimer = setTimeout(function () {
      if (!interact) widget.classList.remove("show-chrome");
    }, 220);
  }

  function postParent(kind, extra) {
    try {
      const payload = Object.assign({ type: "presenter-overlay", kind: kind }, extra || {});
      window.parent.postMessage(payload, "*");
    } catch (_err) {}
  }

  function prefetchBounds() {
    if (isElectron && api.getBounds) {
      api.getBounds().then(function (bounds) {
        if (bounds) lastBounds = bounds;
      });
      return;
    }
    lastBounds = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
  }

  function clampSize(edge, start, dx, dy) {
    let x = start.x;
    let y = start.y;
    let width = start.width;
    let height = start.height;
    if (edge.indexOf("e") !== -1) width = start.width + dx;
    if (edge.indexOf("s") !== -1) height = start.height + dy;
    if (edge.indexOf("w") !== -1) {
      width = start.width - dx;
      x = start.x + dx;
    }
    if (edge.indexOf("n") !== -1) {
      height = start.height - dy;
      y = start.y + dy;
    }
    if (width < MIN_W) {
      if (edge.indexOf("w") !== -1) x = start.x + start.width - MIN_W;
      width = MIN_W;
    }
    if (height < MIN_H) {
      if (edge.indexOf("n") !== -1) y = start.y + start.height - MIN_H;
      height = MIN_H;
    }
    return { x: x, y: y, width: width, height: height };
  }

  function beginInteract(mode, event, edge) {
    event.preventDefault();
    event.stopPropagation();
    widget.classList.add("interacting");
    try {
      display.setPointerCapture(event.pointerId);
    } catch (_err) {}
    interact = {
      mode: mode,
      edge: edge,
      startX: event.screenX,
      startY: event.screenY,
      start: lastBounds,
      pointerId: event.pointerId,
    };
    postParent("start", { mode: mode, edge: edge });
    const ready =
      isElectron && api.getBounds
        ? api.getBounds()
        : Promise.resolve({ x: 0, y: 0, width: window.innerWidth, height: window.innerHeight });
    ready.then(function (bounds) {
      if (!interact || interact.pointerId !== event.pointerId) return;
      if (bounds) {
        lastBounds = bounds;
        interact.start = bounds;
      }
    });
  }

  function onPointerMove(event) {
    if (!interact || !interact.start) return;
    const dx = event.screenX - interact.startX;
    const dy = event.screenY - interact.startY;
    if (interact.mode === "drag") {
      if (isElectron && api.setBounds) {
        const next = {
          x: interact.start.x + dx,
          y: interact.start.y + dy,
          width: interact.start.width,
          height: interact.start.height,
        };
        lastBounds = next;
        api.setBounds(next);
      } else {
        postParent("move", { mode: "drag", dx: dx, dy: dy });
      }
      return;
    }
    if (isElectron && api.setBounds) {
      const next = clampSize(interact.edge, interact.start, dx, dy);
      lastBounds = next;
      api.setBounds(next);
    } else {
      postParent("move", { mode: "resize", edge: interact.edge, dx: dx, dy: dy });
    }
  }

  function endInteract(event) {
    if (!interact) return;
    if (event && event.pointerId !== interact.pointerId) return;
    interact = null;
    widget.classList.remove("interacting");
    postParent("end", {});
    try {
      if (event) display.releasePointerCapture(event.pointerId);
    } catch (_err) {}
    if (!display.matches(":hover")) scheduleHideChrome();
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
  hideBtn.addEventListener("click", function (event) {
    event.stopPropagation();
    hideChrome(true);
  });

  function chromeZoneContains(node) {
    return !!(node && (chromeEl.contains(node) || hotspot.contains(node)));
  }

  hotspot.addEventListener("mouseenter", function () {
    requestShowChrome();
  });
  chromeEl.addEventListener("mouseenter", function () {
    requestShowChrome();
  });
  hotspot.addEventListener("mouseleave", function (event) {
    if (chromeZoneContains(event.relatedTarget)) return;
    scheduleHideChrome();
  });
  chromeEl.addEventListener("mouseleave", function (event) {
    if (chromeZoneContains(event.relatedTarget)) return;
    scheduleHideChrome();
  });

  display.addEventListener("mouseenter", function () {
    prefetchBounds();
  });
  display.addEventListener("mouseleave", function () {
    chromeLocked = false;
    if (interact) return;
    scheduleHideChrome();
  });

  window.addEventListener("keydown", function (event) {
    if (event.key === "Escape") hideChrome(true);
  });

  display.addEventListener("pointerdown", function (event) {
    if (event.button !== 0 || !canInteract()) return;
    const grip = event.target.closest("[data-resize]");
    if (grip) {
      beginInteract("resize", event, grip.getAttribute("data-resize"));
      return;
    }
    if (event.target.closest("button") || event.target.closest(".chrome")) return;
    beginInteract("drag", event, null);
  });
  display.addEventListener("pointermove", onPointerMove);
  display.addEventListener("pointerup", endInteract);
  display.addEventListener("pointercancel", endInteract);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", endInteract);
  window.addEventListener("blur", function () {
    interact = null;
    widget.classList.remove("interacting");
  });

  if (isElectron) {
    api.getState().then(function (next) {
      state = next;
      renderChrome();
      paint();
    });
    api.onState(function (next) {
      state = next;
      renderChrome();
      paint();
    });
  } else {
    controlsBtn.hidden = true;
    renderChrome();
  }

  paint();
  setInterval(paint, 100);
})();
