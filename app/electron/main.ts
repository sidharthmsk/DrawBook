import { app, BrowserWindow, shell } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import net from "net";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const addr = srv.address();
      if (addr && typeof addr === "object") {
        const port = addr.port;
        srv.close(() => resolve(port));
      } else {
        reject(new Error("Could not determine port"));
      }
    });
    srv.on("error", reject);
  });
}

let mainWindow: BrowserWindow | null = null;

async function createWindow(port: number) {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: "Drawbook",
    icon: path.join(__dirname, "..", "build", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://localhost:${port}`);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  const dataDir = path.join(app.getPath("userData"), "data");
  const port = await findFreePort();

  process.env.ELECTRON = "1";
  process.env.DATA_DIR = dataDir;
  process.env.PORT = String(port);
  process.env.STORAGE_BACKEND = process.env.STORAGE_BACKEND || "local";

  try {
    const serverPath = path.join(__dirname, "..", "server", "index.js");
    const { startServer } = await import(
      /* webpackIgnore: true */ `file://${serverPath}`
    );
    await startServer({ port, dataDir });
  } catch (err) {
    console.error("Failed to start server:", err);
    const { dialog } = await import("electron");
    dialog.showErrorBox(
      "Drawbook — Server Error",
      `Could not start the local server.\n\n${err instanceof Error ? err.message : String(err)}`,
    );
    app.quit();
    return;
  }

  await createWindow(port);
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("activate", async () => {
  if (mainWindow === null) {
    // Server is already running; re-read port from env
    const port = Number(process.env.PORT) || 3000;
    await createWindow(port);
  }
});
