// Semestra — Electron shell (ícone flutuante)
//
// Three window modes:
//   bubble    — ícone redondo de 56px, arrastável, canto inferior direito
//   panel     — painel expandido (420px) por cima das janelas, sempre no topo
//   full      — janela completa com borda normal, não fica no topo

const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  globalShortcut,
  screen,
  ipcMain,
  dialog,
  shell,
  nativeImage,
  protocol,
  net,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { spawn } = require("node:child_process");
const crypto = require("node:crypto");
const { pathToFileURL } = require("node:url");

const DEV_URL = process.env.SEMESTRA_DEV_URL;
const IS_DEV = !!DEV_URL;

// Images pasted into notes are served through our own scheme so the same
// markdown works in dev (page is http://127.0.0.1) and packaged (page is
// file://), where a raw file:// <img> would be blocked in dev.
const ASSET_SCHEME = "semestra-asset";
protocol.registerSchemesAsPrivileged([
  {
    scheme: ASSET_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);

const BUBBLE_SIZE = 56;
const PANEL_WIDTH = 420;
const EDGE_GAP = 16; // px from the screen edge

// Persist a tiny bit of window state next to the user data dir.
function stateFile() {
  return path.join(app.getPath("userData"), "window-state.json");
}

function loadState() {
  let saved = {};
  try {
    saved = JSON.parse(fs.readFileSync(stateFile(), "utf8"));
  } catch {
    /* first run */
  }
  // "dock" and the left/right side are gone; anything stale lands on bubble.
  const mode = ["bubble", "panel", "full"].includes(saved.mode)
    ? saved.mode
    : "bubble";
  return {
    mode,
    bubble: isPoint(saved.bubble) ? saved.bubble : null,
    panel: isPoint(saved.panel) ? saved.panel : null,
  };
}

function isPoint(p) {
  return p && Number.isFinite(p.x) && Number.isFinite(p.y);
}

function saveState(state) {
  try {
    fs.mkdirSync(path.dirname(stateFile()), { recursive: true });
    fs.writeFileSync(stateFile(), JSON.stringify(state, null, 2));
  } catch {
    /* ignore */
  }
}

let mainWindow = null;
let tray = null;
let state = loadState();

/** Work area of whichever display currently holds the window (or the cursor). */
function activeWorkArea() {
  const point = mainWindow
    ? (() => {
        const b = mainWindow.getBounds();
        return { x: b.x + Math.floor(b.width / 2), y: b.y + Math.floor(b.height / 2) };
      })()
    : screen.getCursorScreenPoint();
  return screen.getDisplayNearestPoint(point).workArea;
}

function sizeFor(mode, area) {
  if (mode === "bubble") return { width: BUBBLE_SIZE, height: BUBBLE_SIZE };
  if (mode === "panel") {
    return { width: PANEL_WIDTH, height: Math.min(760, area.height - EDGE_GAP * 2) };
  }
  return { width: 980, height: Math.min(760, area.height - 40) };
}

function clampToArea(x, y, width, height, area) {
  return {
    x: Math.round(Math.min(Math.max(x, area.x), area.x + area.width - width)),
    y: Math.round(Math.min(Math.max(y, area.y), area.y + area.height - height)),
  };
}

/** Default bubble spot: bottom-right of the work area. */
function defaultBubblePos(area) {
  return {
    x: area.x + area.width - BUBBLE_SIZE - EDGE_GAP,
    y: area.y + area.height - BUBBLE_SIZE - EDGE_GAP,
  };
}

function computeBounds(mode) {
  const area = activeWorkArea();
  const { width, height } = sizeFor(mode, area);

  if (mode === "full") {
    return {
      width,
      height,
      x: area.x + Math.floor((area.width - width) / 2),
      y: area.y + Math.floor((area.height - height) / 2),
    };
  }

  if (mode === "bubble") {
    const pos = state.bubble ?? defaultBubblePos(area);
    return { width, height, ...clampToArea(pos.x, pos.y, width, height, area) };
  }

  // Panel: reuse where the user last left it, else open it anchored to the
  // bubble's bottom-right corner so it unfolds from the icon.
  let pos = state.panel;
  if (!pos) {
    const b = state.bubble ?? defaultBubblePos(area);
    pos = { x: b.x + BUBBLE_SIZE - width, y: b.y + BUBBLE_SIZE - height };
  }
  return { width, height, ...clampToArea(pos.x, pos.y, width, height, area) };
}

function applyMode(mode) {
  if (!mainWindow) return;
  state.mode = mode;

  const bounds = computeBounds(mode);
  // Order matters: shrink the minimum before setting a smaller bounds, or
  // Windows keeps the old floor and the bubble comes out panel-sized.
  mainWindow.setMinimumSize(
    mode === "bubble" ? BUBBLE_SIZE : mode === "full" ? 720 : 360,
    mode === "bubble" ? BUBBLE_SIZE : 300
  );
  mainWindow.setBounds(bounds);
  mainWindow.setAlwaysOnTop(mode !== "full", "floating");
  mainWindow.setResizable(mode === "full");
  mainWindow.setSkipTaskbar(mode !== "full");
  saveState(state);
  mainWindow.webContents.send("semestra:mode", mode);
}

/** Remember where the user dragged the window, per mode. */
function rememberPosition() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const [x, y] = mainWindow.getPosition();
  if (state.mode === "bubble") state.bubble = { x, y };
  else if (state.mode === "panel") state.panel = { x, y };
  else return;
  saveState(state);
}

function toggleVisibility() {
  if (!mainWindow) return;
  if (mainWindow.isVisible() && mainWindow.isFocused()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

function createWindow() {
  const initialMode = state.mode === "full" ? "panel" : state.mode;
  const bounds = computeBounds(initialMode);

  mainWindow = new BrowserWindow({
    ...bounds,
    icon: path.join(__dirname, "icon.ico"),
    frame: false,
    show: false,
    // Transparent so the bubble can be an actual circle; panel and full
    // modes paint their own opaque background from CSS.
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: "Semestra",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.setAlwaysOnTop(true, "floating");
  mainWindow.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
  });

  if (IS_DEV) {
    mainWindow.loadURL(DEV_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.webContents.send("semestra:mode", initialMode);
  });

  // External links open in the default browser instead of a new Electron window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.on("moved", rememberPosition);
  mainWindow.on("blur", stopBubbleDrag);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function buildTrayIcon() {
  const icon = nativeImage.createFromPath(path.join(__dirname, "tray.png"));
  if (icon.isEmpty()) {
    // Fallback: 16x16 white square, so the tray never ends up invisible.
    return nativeImage.createFromDataURL(
      "data:image/png;base64," +
        "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAHklEQVR4AWMY" +
        "BaNgFIyCUTAKRsEoGAWjYBSMAgIACHgAAUvA7f8AAAAASUVORK5CYII="
    );
  }
  return icon.resize({ width: 16, height: 16, quality: "best" });
}

function createTray() {
  tray = new Tray(buildTrayIcon());
  tray.setToolTip("Semestra");
  const refreshMenu = () => {
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: "Ícone flutuante",
          type: "radio",
          checked: state.mode === "bubble",
          click: () => applyMode("bubble"),
        },
        {
          label: "Modo painel",
          type: "radio",
          checked: state.mode === "panel",
          click: () => applyMode("panel"),
        },
        {
          label: "Janela completa",
          type: "radio",
          checked: state.mode === "full",
          click: () => applyMode("full"),
        },
        { type: "separator" },
        {
          label: "Recolocar no canto inferior direito",
          click: () => {
            const area = activeWorkArea();
            state.bubble = defaultBubblePos(area);
            state.panel = null;
            saveState(state);
            applyMode(state.mode);
          },
        },
        { type: "separator" },
        {
          label: "Mostrar/ocultar  (Ctrl+Shift+Space)",
          click: toggleVisibility,
        },
        { type: "separator" },
        { label: "Sair", role: "quit" },
      ])
    );
  };
  tray.on("click", toggleVisibility);
  tray.on("right-click", refreshMenu);
  refreshMenu();
}

ipcMain.handle("semestra:set-mode", (_e, mode) => {
  applyMode(mode);
});

// ---------- Bubble dragging ----------
//
// A CSS `-webkit-app-region: drag` region would be less code, but Chromium
// swallows click events inside one, and the bubble has to be both draggable
// and clickable. So the renderer reports press/release and the main process
// follows the OS cursor itself — no IPC per mouse move.

// Hard ceiling on a drag: if the renderer never reports the release (lost
// focus, window yanked out from under the cursor), the bubble must not stay
// glued to the mouse forever.
const DRAG_MAX_MS = 15_000;

let dragTimer = null;
let dragOffset = null;
let dragStartedAt = 0;

function stopBubbleDrag() {
  if (dragTimer) clearInterval(dragTimer);
  dragTimer = null;
  dragOffset = null;
  rememberPosition();
}

ipcMain.handle("semestra:bubble:drag-start", () => {
  if (!mainWindow || state.mode !== "bubble") return;
  const cursor = screen.getCursorScreenPoint();
  const [wx, wy] = mainWindow.getPosition();
  dragOffset = { x: cursor.x - wx, y: cursor.y - wy };
  dragStartedAt = Date.now();
  if (dragTimer) clearInterval(dragTimer);
  dragTimer = setInterval(() => {
    if (
      !mainWindow ||
      mainWindow.isDestroyed() ||
      !dragOffset ||
      state.mode !== "bubble" ||
      Date.now() - dragStartedAt > DRAG_MAX_MS
    ) {
      stopBubbleDrag();
      return;
    }
    const c = screen.getCursorScreenPoint();
    const area = screen.getDisplayNearestPoint(c).workArea;
    const next = clampToArea(
      c.x - dragOffset.x,
      c.y - dragOffset.y,
      BUBBLE_SIZE,
      BUBBLE_SIZE,
      area
    );
    mainWindow.setPosition(next.x, next.y);
  }, 16);
});

ipcMain.handle("semestra:bubble:drag-end", () => {
  stopBubbleDrag();
});

ipcMain.handle("semestra:hide", () => {
  if (mainWindow) mainWindow.hide();
});

ipcMain.handle("semestra:get-state", () => ({
  mode: state.mode,
  platform: process.platform,
}));

ipcMain.handle("semestra:open-external", (_e, url) => {
  if (typeof url === "string" && /^https?:\/\//i.test(url)) {
    shell.openExternal(url);
  }
});

// ---------- User data folder ----------
//
// Only a tiny pointer ({ dataFolder: "..." }) lives in ~/.semestra/config.json.
// All real app data (state) is stored as semestra-data.json inside the folder
// the user picks on first launch.

const CONFIG_DIR = path.join(os.homedir(), ".semestra");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const DATA_FILENAME = "semestra-data.json";

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeConfig(cfg) {
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error("Semestra: cannot write config", err);
    return false;
  }
}

function currentDataFolder() {
  const cfg = readConfig();
  return typeof cfg.dataFolder === "string" ? cfg.dataFolder : null;
}

function dataFileFor(folder) {
  return path.join(folder, DATA_FILENAME);
}

ipcMain.handle("semestra:data:get-location", () => {
  const folder = currentDataFolder();
  const exists = folder ? fs.existsSync(folder) : false;
  const hasData = folder ? fs.existsSync(dataFileFor(folder)) : false;
  return { folder, exists, hasData };
});

ipcMain.handle("semestra:data:pick-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Escolha onde guardar os dados do Semestra",
    properties: ["openDirectory", "createDirectory"],
  });
  if (result.canceled || !result.filePaths[0]) {
    return { ok: false, canceled: true };
  }
  const folder = result.filePaths[0];
  try {
    fs.mkdirSync(folder, { recursive: true });
    // Smoke test: write + delete a sentinel.
    const probe = path.join(folder, ".semestra-write-test");
    fs.writeFileSync(probe, "", "utf8");
    fs.unlinkSync(probe);
  } catch (err) {
    return {
      ok: false,
      error: `Sem permissão de escrita na pasta: ${err.message}`,
    };
  }
  writeConfig({ ...readConfig(), dataFolder: folder });
  const hasData = fs.existsSync(dataFileFor(folder));
  return { ok: true, folder, hasData };
});

const NOTEBOOKS_DIR = "notebooks";

function notebooksDirFor(folder) {
  return path.join(folder, NOTEBOOKS_DIR);
}

function listNotebookFiles(dir) {
  try {
    return fs.readdirSync(dir).filter((n) => n.endsWith(".json"));
  } catch {
    return [];
  }
}

function readNotebookFile(dir, name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
  } catch (err) {
    console.error("Semestra: skipping unreadable notebook", name, err.message);
    return null;
  }
}

ipcMain.handle("semestra:data:read", () => {
  const folder = currentDataFolder();
  if (!folder) return { ok: false, reason: "no-folder" };
  const file = dataFileFor(folder);
  if (!fs.existsSync(file)) return { ok: true, state: null, folder };

  let core;
  try {
    core = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    return { ok: false, reason: "parse-error", message: err.message, folder };
  }

  const nbDir = notebooksDirFor(folder);
  const files = listNotebookFiles(nbDir);
  const notebooks = files
    .map((n) => readNotebookFile(nbDir, n))
    .filter((n) => n && typeof n.id === "string");

  // Legacy support: if the folder-based notebooks are empty but the old
  // monolith has them inline, use those. On the next write they'll move.
  const legacy = Array.isArray(core.notebooks) ? core.notebooks : [];
  const combined = notebooks.length > 0 ? notebooks : legacy;

  const { notebooks: _ignored, ...rest } = core;
  return { ok: true, state: { ...rest, notebooks: combined }, folder };
});

ipcMain.handle("semestra:data:write", (_e, state) => {
  const folder = currentDataFolder();
  if (!folder) return { ok: false, reason: "no-folder" };

  const safeState = state && typeof state === "object" ? state : {};
  const notebooks = Array.isArray(safeState.notebooks) ? safeState.notebooks : [];
  const core = { ...safeState };
  delete core.notebooks;

  const file = dataFileFor(folder);
  const nbDir = notebooksDirFor(folder);
  const tmp = file + ".tmp";

  try {
    fs.mkdirSync(folder, { recursive: true });
    fs.mkdirSync(nbDir, { recursive: true });

    // Core: atomic rewrite.
    fs.writeFileSync(tmp, JSON.stringify(core, null, 2), "utf8");
    fs.renameSync(tmp, file);

    // Notebooks: one file per notebook.id. Only rewrite when contents changed.
    const keep = new Set();
    for (const nb of notebooks) {
      if (!nb || typeof nb.id !== "string") continue;
      const fname = nb.id + ".json";
      keep.add(fname);
      const dest = path.join(nbDir, fname);
      const serialized = JSON.stringify(nb, null, 2);
      let existing = null;
      try {
        existing = fs.readFileSync(dest, "utf8");
      } catch {
        /* missing */
      }
      if (existing === serialized) continue;
      const nbTmp = dest + ".tmp";
      fs.writeFileSync(nbTmp, serialized, "utf8");
      fs.renameSync(nbTmp, dest);
    }

    // Remove notebook files that are no longer present in state.
    for (const name of listNotebookFiles(nbDir)) {
      if (!keep.has(name)) {
        try {
          fs.unlinkSync(path.join(nbDir, name));
        } catch {
          /* ignore */
        }
      }
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: "write-error", message: err.message };
  }
});

ipcMain.handle("semestra:data:reveal", () => {
  const folder = currentDataFolder();
  if (folder && fs.existsSync(folder)) shell.openPath(folder);
});

// ---------- Note images (paste / drop) ----------

const ASSETS_DIR = "assets";
const ASSET_MAX_BYTES = 12 * 1024 * 1024;
const ASSET_EXT = {
  "image/png": "png",
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

function assetsDirFor(folder) {
  return path.join(folder, ASSETS_DIR);
}

// Only ever resolve plain file names inside the assets dir — never a path
// that could climb out of it.
function resolveAssetPath(name) {
  const folder = currentDataFolder();
  if (!folder) return null;
  const clean = path.basename(String(name || ""));
  if (!clean || clean.startsWith(".")) return null;
  const dir = assetsDirFor(folder);
  const full = path.join(dir, clean);
  if (path.relative(dir, full) !== clean) return null;
  return full;
}

ipcMain.handle("semestra:data:save-image", (_e, payload) => {
  const folder = currentDataFolder();
  if (!folder) return { ok: false, error: "Nenhuma pasta de dados escolhida." };

  const mime = String(payload?.mime || "");
  const ext = ASSET_EXT[mime];
  if (!ext) return { ok: false, error: `Formato não suportado: ${mime || "?"}` };

  let buf;
  try {
    buf = Buffer.from(payload.data);
  } catch {
    return { ok: false, error: "Dados da imagem inválidos." };
  }
  if (!buf.length) return { ok: false, error: "Imagem vazia." };
  if (buf.length > ASSET_MAX_BYTES) {
    return {
      ok: false,
      error: `Imagem muito grande (${(buf.length / 1024 / 1024).toFixed(1)} MB, limite 12 MB).`,
    };
  }

  try {
    const dir = assetsDirFor(folder);
    fs.mkdirSync(dir, { recursive: true });
    // Content hash: pasting the same screenshot twice reuses one file.
    const hash = crypto.createHash("sha1").update(buf).digest("hex").slice(0, 12);
    const name = `${hash}.${ext}`;
    const full = path.join(dir, name);
    if (!fs.existsSync(full)) {
      const tmp = `${full}.tmp`;
      fs.writeFileSync(tmp, buf);
      fs.renameSync(tmp, full);
    }
    return { ok: true, name, bytes: buf.length };
  } catch (err) {
    return { ok: false, error: `Não consegui gravar: ${err.message}` };
  }
});

// ---------- Code runner (C# / Java) ----------

const RUN_TIMEOUT_MS = 20_000;
const RUN_OUTPUT_LIMIT = 200_000;

function tempDirFor(prefix) {
  const dir = path.join(os.tmpdir(), "semestra-run", `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function runProcess(cmd, args, options) {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let killed = false;
    const start = Date.now();

    let child;
    try {
      child = spawn(cmd, args, {
        cwd: options.cwd,
        shell: false,
        windowsHide: true,
        env: { ...process.env, ...(options.env || {}) },
      });
    } catch (err) {
      resolve({
        stdout: "",
        stderr: "",
        exitCode: null,
        elapsedMs: Date.now() - start,
        error: `Falha ao iniciar \`${cmd}\`: ${err.message}`,
      });
      return;
    }

    const timeout = setTimeout(() => {
      killed = true;
      try {
        child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
    }, options.timeoutMs ?? RUN_TIMEOUT_MS);

    child.stdout.on("data", (buf) => {
      if (stdout.length < RUN_OUTPUT_LIMIT) stdout += buf.toString("utf8");
    });
    child.stderr.on("data", (buf) => {
      if (stderr.length < RUN_OUTPUT_LIMIT) stderr += buf.toString("utf8");
    });
    child.on("error", (err) => {
      clearTimeout(timeout);
      resolve({
        stdout,
        stderr,
        exitCode: null,
        elapsedMs: Date.now() - start,
        error:
          err.code === "ENOENT"
            ? `Executável \`${cmd}\` não foi encontrado no PATH.`
            : `Erro: ${err.message}`,
      });
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({
        stdout,
        stderr,
        exitCode: code,
        elapsedMs: Date.now() - start,
        error: killed ? `Execução interrompida após ${options.timeoutMs ?? RUN_TIMEOUT_MS} ms.` : undefined,
      });
    });

    if (options.stdin) {
      child.stdin.write(options.stdin);
      child.stdin.end();
    }
  });
}

async function runCsharp(source) {
  const dir = tempDirFor("cs");
  const file = path.join(dir, "main.csx");
  fs.writeFileSync(file, source, "utf8");
  // Prefer dotnet-script if available, then fall back to a tiny csproj + dotnet run.
  const first = await runProcess("dotnet", ["script", file], {
    cwd: dir,
    timeoutMs: RUN_TIMEOUT_MS,
  });
  cleanupLater(dir);
  if (!first.error) return first;

  // Fallback: top-level csproj
  const fbDir = tempDirFor("cs-proj");
  fs.writeFileSync(
    path.join(fbDir, "Program.cs"),
    source,
    "utf8"
  );
  fs.writeFileSync(
    path.join(fbDir, "Program.csproj"),
    `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>disable</Nullable>
  </PropertyGroup>
</Project>
`,
    "utf8"
  );
  const second = await runProcess("dotnet", ["run", "--nologo", "--no-restore", "-c", "Debug"], {
    cwd: fbDir,
    timeoutMs: 60_000,
  });
  cleanupLater(fbDir);
  if (second.error && first.error) {
    return {
      ...second,
      error:
        "Nem `dotnet script` nem `dotnet run` conseguiram rodar. Instale o .NET SDK (https://dotnet.microsoft.com/) e, para scripts rápidos, `dotnet tool install -g dotnet-script`.",
    };
  }
  return second;
}

async function runPython(source) {
  const dir = tempDirFor("py");
  const file = path.join(dir, "main.py");
  fs.writeFileSync(file, source, "utf8");
  const exe = process.platform === "win32" ? "python" : "python3";
  const result = await runProcess(exe, [file], {
    cwd: dir,
    timeoutMs: RUN_TIMEOUT_MS,
  });
  cleanupLater(dir);
  if (result.error && /not found|ENOENT/i.test(result.error)) {
    // Fall back to 'py' launcher on Windows.
    if (process.platform === "win32") {
      const fb = await runProcess("py", [file], {
        cwd: dir,
        timeoutMs: RUN_TIMEOUT_MS,
      });
      if (!fb.error) return fb;
    }
    return {
      ...result,
      error: "Python não encontrado no PATH. Instale em https://www.python.org/.",
    };
  }
  return result;
}

async function runJava(source) {
  const dir = tempDirFor("java");
  const hasMainClass = /\bclass\s+Main\b/.test(source);
  const code = hasMainClass
    ? source
    : `public class Main {
  public static void main(String[] args) throws Exception {
${source}
  }
}
`;
  fs.writeFileSync(path.join(dir, "Main.java"), code, "utf8");
  const compile = await runProcess("javac", ["Main.java"], {
    cwd: dir,
    timeoutMs: 30_000,
  });
  if (compile.exitCode !== 0 || compile.error) {
    cleanupLater(dir);
    return {
      stdout: compile.stdout,
      stderr: compile.stderr,
      exitCode: compile.exitCode,
      elapsedMs: compile.elapsedMs,
      error:
        compile.error ??
        (compile.stderr ? undefined : "Falha ao compilar — verifique se o JDK está instalado."),
    };
  }
  const run = await runProcess("java", ["-cp", ".", "Main"], {
    cwd: dir,
    timeoutMs: RUN_TIMEOUT_MS,
  });
  cleanupLater(dir);
  return {
    stdout: (compile.stdout || "") + run.stdout,
    stderr: (compile.stderr || "") + run.stderr,
    exitCode: run.exitCode,
    elapsedMs: compile.elapsedMs + run.elapsedMs,
    error: run.error,
  };
}

function cleanupLater(dir) {
  setTimeout(() => {
    fs.rm(dir, { recursive: true, force: true }, () => {});
  }, 30_000);
}

ipcMain.handle("semestra:run-code", async (_e, payload) => {
  const { language, source } = payload ?? {};
  if (typeof source !== "string" || !source.trim()) {
    return {
      stdout: "",
      stderr: "",
      exitCode: null,
      elapsedMs: 0,
      error: "Nada para executar.",
    };
  }
  try {
    if (language === "csharp") return await runCsharp(source);
    if (language === "java") return await runJava(source);
    if (language === "python") return await runPython(source);
    return {
      stdout: "",
      stderr: "",
      exitCode: null,
      elapsedMs: 0,
      error: `Linguagem não suportada: ${language}`,
    };
  } catch (err) {
    return {
      stdout: "",
      stderr: "",
      exitCode: null,
      elapsedMs: 0,
      error: `Erro inesperado: ${err.message}`,
    };
  }
});

ipcMain.handle("semestra:check-runtimes", async () => {
  const dotnet = await runProcess("dotnet", ["--version"], { timeoutMs: 5_000 });
  const dotnetScript = await runProcess("dotnet", ["script", "--version"], { timeoutMs: 5_000 });
  const javac = await runProcess("javac", ["-version"], { timeoutMs: 5_000 });
  const pyExe = process.platform === "win32" ? "python" : "python3";
  const python = await runProcess(pyExe, ["--version"], { timeoutMs: 5_000 });
  return {
    dotnet: !dotnet.error ? (dotnet.stdout + dotnet.stderr).trim() : null,
    dotnetScript: !dotnetScript.error && dotnetScript.exitCode === 0
      ? (dotnetScript.stdout + dotnetScript.stderr).trim()
      : null,
    javac: !javac.error ? (javac.stdout + javac.stderr).trim() : null,
    python: !python.error ? (python.stdout + python.stderr).trim() : null,
  };
});

// Single-instance lock so the global shortcut always toggles the same window.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // semestra-asset://img/<name> -> <data folder>/assets/<name>
    protocol.handle(ASSET_SCHEME, (request) => {
      const name = decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, "");
      const full = resolveAssetPath(name);
      if (!full || !fs.existsSync(full)) {
        return new Response("Not found", { status: 404 });
      }
      // pathToFileURL, not string concat: data folders have spaces and accents.
      return net.fetch(pathToFileURL(full).toString());
    });

    createWindow();
    createTray();
    // Delay applyMode by one tick so the window finishes creating.
    setTimeout(() => applyMode(state.mode), 100);

    const toggleAccel = "Control+Shift+Space";
    const ok = globalShortcut.register(toggleAccel, toggleVisibility);
    if (!ok) {
      // eslint-disable-next-line no-console
      console.warn("Semestra: could not register global shortcut", toggleAccel);
    }
  });

  app.on("will-quit", () => {
    globalShortcut.unregisterAll();
  });

  app.on("window-all-closed", (e) => {
    // Keep the app alive even if the window closes; tray reopens it.
    e.preventDefault();
  });

  app.on("activate", () => {
    if (mainWindow === null) createWindow();
  });
}
