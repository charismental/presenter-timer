const {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  screen,
} = require("electron");
const path = require("path");
const fs = require("fs");
const TimerCore = require("./src/timer-core");

let overlayWindow = null;
let controlsWindow = null;
let tray = null;
let state = TimerCore.createState();

const STATE_FILE = () => path.join(app.getPath("userData"), "presenter-state.json");

function loadState() {
  try {
    const raw = fs.readFileSync(STATE_FILE(), "utf8");
    const saved = JSON.parse(raw);
    state = TimerCore.createState(saved);
    state.running = false;
    state.startedAt = null;
  } catch (_err) {
    state = TimerCore.createState();
  }
}

function saveState() {
  try {
    const toSave = Object.assign({}, state, {
      running: false,
      startedAt: null,
    });
    fs.writeFileSync(STATE_FILE(), JSON.stringify(toSave, null, 2));
  } catch (_err) {
    // Ignore persistence failures; the timer still works in-memory.
  }
}

function broadcast() {
  const payload = Object.assign({}, state);
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send("state", payload);
  }
  if (controlsWindow && !controlsWindow.isDestroyed()) {
    controlsWindow.webContents.send("state", payload);
  }
  updateTrayMenu();
}

function applyClickThrough() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  if (state.clickThrough) {
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  } else {
    overlayWindow.setIgnoreMouseEvents(false);
  }
}

function applyAlwaysOnTop() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  overlayWindow.setAlwaysOnTop(!!state.alwaysOnTop, "screen-saver");
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
}

function trayIcon() {
  const iconPath = path.join(__dirname, "assets", "tray.png");
  return nativeImage.createFromPath(iconPath);
}

function createOverlay() {
  const display = screen.getPrimaryDisplay();
  const work = display.workArea;
  const width = 360;
  const height = 200;

  overlayWindow = new BrowserWindow({
    width,
    height,
    icon: path.join(__dirname, "assets", "icon.png"),
    x: work.x + work.width - width - 28,
    y: work.y + 28,
    minWidth: 180,
    minHeight: 88,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    resizable: true,
    fullscreenable: false,
    minimizable: false,
    maximizable: false,
    acceptFirstMouse: true,
    roundedCorners: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  overlayWindow.loadFile(path.join(__dirname, "src", "overlay.html"));
  overlayWindow.once("ready-to-show", () => {
    applyAlwaysOnTop();
    applyClickThrough();
    overlayWindow.showInactive();
  });
  overlayWindow.on("closed", () => {
    overlayWindow = null;
    if (!controlsWindow) app.quit();
  });
}

function createControls() {
  if (controlsWindow && !controlsWindow.isDestroyed()) {
    controlsWindow.show();
    controlsWindow.focus();
    return;
  }

  controlsWindow = new BrowserWindow({
    width: 400,
    height: 680,
    icon: path.join(__dirname, "assets", "icon.png"),
    minWidth: 360,
    minHeight: 560,
    title: "Presenter Timer",
    backgroundColor: "#14110f",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  controlsWindow.loadFile(path.join(__dirname, "src", "controls.html"));
  controlsWindow.once("ready-to-show", () => controlsWindow.show());
  controlsWindow.on("closed", () => {
    controlsWindow = null;
    if (!overlayWindow) app.quit();
  });
}

function updateTrayMenu() {
  if (!tray) return;
  const snap = TimerCore.snapshot(state);
  const label = state.mode === "clock" ? snap.display : snap.display;
  const template = [
    { label: label, enabled: false },
    { type: "separator" },
    {
      label: state.running ? "Pause" : "Start",
      click: () => {
        state = TimerCore.apply(state, { type: "toggle" });
        broadcast();
      },
    },
    {
      label: "Reset",
      click: () => {
        state = TimerCore.apply(state, { type: "reset" });
        saveState();
        broadcast();
      },
    },
    { type: "separator" },
    {
      label: "Click-through (keep clicker on slides)",
      type: "checkbox",
      checked: !!state.clickThrough,
      click: (item) => {
        state = TimerCore.apply(state, {
          type: "patch",
          patch: { clickThrough: item.checked },
        });
        applyClickThrough();
        saveState();
        broadcast();
      },
    },
    {
      label: "Always on top",
      type: "checkbox",
      checked: !!state.alwaysOnTop,
      click: (item) => {
        state = TimerCore.apply(state, {
          type: "patch",
          patch: { alwaysOnTop: item.checked },
        });
        applyAlwaysOnTop();
        saveState();
        broadcast();
      },
    },
    { type: "separator" },
    { label: "Show overlay", click: () => overlayWindow && overlayWindow.showInactive() },
    { label: "Open controls", click: () => createControls() },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ];
  tray.setContextMenu(Menu.buildFromTemplate(template));
  tray.setToolTip("Presenter Timer · " + label);
}

function createTray() {
  tray = new Tray(trayIcon());
  updateTrayMenu();
  tray.on("click", () => createControls());
}

ipcMain.handle("get-state", () => Object.assign({}, state));

ipcMain.handle("timer-command", (_event, cmd) => {
  state = TimerCore.apply(state, cmd);
  if (cmd.type === "patch") {
    if (Object.prototype.hasOwnProperty.call(cmd.patch || {}, "clickThrough")) {
      applyClickThrough();
    }
    if (Object.prototype.hasOwnProperty.call(cmd.patch || {}, "alwaysOnTop")) {
      applyAlwaysOnTop();
    }
  }
  if (cmd.type !== "start" && cmd.type !== "toggle") {
    saveState();
  } else {
    saveState();
  }
  broadcast();
  return Object.assign({}, state);
});

ipcMain.on("set-ignore-mouse", (_event, ignore) => {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  if (state.clickThrough) {
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    return;
  }
  overlayWindow.setIgnoreMouseEvents(!!ignore, ignore ? { forward: true } : {});
});

ipcMain.handle("overlay-get-bounds", () => {
  if (!overlayWindow || overlayWindow.isDestroyed()) return null;
  return overlayWindow.getBounds();
});

ipcMain.on("overlay-set-bounds", (_event, bounds) => {
  if (!overlayWindow || overlayWindow.isDestroyed() || !bounds) return;
  overlayWindow.setBounds(
    {
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.max(180, Math.round(bounds.width)),
      height: Math.max(88, Math.round(bounds.height)),
    },
    false
  );
});

ipcMain.on("open-controls", () => createControls());
ipcMain.on("hide-overlay", () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.hide();
});

app.whenReady().then(() => {
  loadState();
  createOverlay();
  createControls();
  createTray();
  app.on("activate", () => {
    if (!overlayWindow) createOverlay();
    createControls();
  });
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", saveState);
