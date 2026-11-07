// Semestra — Electron shell (hotbar / dock lateral)
//
// Three window modes:
//   dock      — faixa fina (72px) encaixada na borda, sempre no topo
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
} = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { spawn } = require("node:child_process");
const crypto = require("node:crypto");

const DEV_URL = process.env.SEMESTRA_DEV_URL;
const IS_DEV = !!DEV_URL;

const DOCK_WIDTH = 72;
const PANEL_WIDTH = 420;
const EDGE_GAP = 0; // px from the screen edge

// Persist a tiny bit of window state next to the user data dir.
function stateFile() {
  return path.join(app.getPath("userData"), "window-state.json");
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile(), "utf8"));
  } catch {
    return { mode: "panel", side: "right" };
  }
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

function computeBounds(mode, side) {
  const display = screen.getPrimaryDisplay();
  const { x: wx, y: wy, width: ww, height: wh } = display.workArea;
  const w = mode === "dock" ? DOCK_WIDTH : mode === "panel" ? PANEL_WIDTH : 980;
  const h = mode === "full" ? Math.min(760, wh - 40) : wh - EDGE_GAP * 2;

  let x;
  if (mode === "full") {
    x = wx + Math.floor((ww - w) / 2);
  } else if (side === "left") {
    x = wx + EDGE_GAP;
  } else {
    x = wx + ww - w - EDGE_GAP;
  }
  const y =
    mode === "full"
      ? wy + Math.floor((wh - h) / 2)
      : wy + EDGE_GAP;

  return { x, y, width: w, height: h };
}

function applyMode(mode) {
  if (!mainWindow) return;
  state.mode = mode;
  saveState(state);

  const bounds = computeBounds(mode, state.side);
  mainWindow.setMinimumSize(mode === "full" ? 720 : DOCK_WIDTH, 300);
  mainWindow.setBounds(bounds);
  mainWindow.setAlwaysOnTop(mode !== "full", "floating");
  mainWindow.setResizable(mode === "full");
  mainWindow.setSkipTaskbar(mode !== "full");
  mainWindow.webContents.send("semestra:mode", mode);
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
  const bounds = computeBounds(initialMode, state.side);

  mainWindow = new BrowserWindow({
    ...bounds,
    frame: false,
    show: false,
    transparent: false,
    backgroundColor: "#0f172a",
    hasShadow: true,
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

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function buildTrayIcon() {
  // 16x16 square white dot on transparent as a safe default.
  const png = nativeImage.createFromDataURL(
    "data:image/png;base64," +
      "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAHklEQVR4AWMY" +
      "BaNgFIyCUTAKRsEoGAWjYBSMAgIACHgAAUvA7f8AAAAASUVORK5CYII="
  );
  return png;
}

function createTray() {
  tray = new Tray(buildTrayIcon());
  tray.setToolTip("Semestra");
  const refreshMenu = () => {
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: "Modo barra (dock)",
          type: "radio",
          checked: state.mode === "dock",
          click: () => applyMode("dock"),
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
          label: "Encaixar à direita",
          type: "radio",
          checked: state.side === "right",
          click: () => {
            state.side = "right";
            saveState(state);
            applyMode(state.mode);
          },
        },
        {
          label: "Encaixar à esquerda",
          type: "radio",
          checked: state.side === "left",
          click: () => {
            state.side = "left";
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

ipcMain.handle("semestra:toggle-side", () => {
  state.side = state.side === "right" ? "left" : "right";
  saveState(state);
  applyMode(state.mode);
  return state.side;
});

ipcMain.handle("semestra:hide", () => {
  if (mainWindow) mainWindow.hide();
});

ipcMain.handle("semestra:get-state", () => ({
  mode: state.mode,
  side: state.side,
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

ipcMain.handle("semestra:data:read", () => {
  const folder = currentDataFolder();
  if (!folder) return { ok: false, reason: "no-folder" };
  const file = dataFileFor(folder);
  if (!fs.existsSync(file)) return { ok: true, state: null, folder };
  try {
    const raw = fs.readFileSync(file, "utf8");
    return { ok: true, state: JSON.parse(raw), folder };
  } catch (err) {
    return { ok: false, reason: "parse-error", message: err.message, folder };
  }
});

ipcMain.handle("semestra:data:write", (_e, state) => {
  const folder = currentDataFolder();
  if (!folder) return { ok: false, reason: "no-folder" };
  const file = dataFileFor(folder);
  const tmp = file + ".tmp";
  try {
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), "utf8");
    fs.renameSync(tmp, file);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: "write-error", message: err.message };
  }
});

ipcMain.handle("semestra:data:reveal", () => {
  const folder = currentDataFolder();
  if (folder && fs.existsSync(folder)) shell.openPath(folder);
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
  return {
    dotnet: !dotnet.error ? (dotnet.stdout + dotnet.stderr).trim() : null,
    dotnetScript: !dotnetScript.error && dotnetScript.exitCode === 0
      ? (dotnetScript.stdout + dotnetScript.stderr).trim()
      : null,
    javac: !javac.error ? (javac.stdout + javac.stderr).trim() : null,
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
