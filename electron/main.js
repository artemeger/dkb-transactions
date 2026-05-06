const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');

// Detect if running in packaged (production) mode
const isPackaged = app.isPackaged || !app.isDev;

// Check if no-sandbox mode is requested
const noSandbox = process.argv.includes('--no-sandbox');

// Check for development flag or environment variable
function detectDevMode() {
  // Check command line arguments
  if (process.argv.includes('--dev') || process.env.ELECTRON_DEV === '1') {
    return true;
  }
  
  // If not packaged and no dev flag, default to dev in development scenarios
  return !isPackaged;
}

app.isDev = detectDevMode();

// Apply no-sandbox if requested
if (noSandbox) {
  app.disableHardwareAcceleration();
}

let mainWindow = null;
let expressServer = null;
const SERVER_PORT = 3001;

// Get the path to data directory for file operations
function getDataDir() {
  if (isPackaged) {
    // In production, use user's home Documents folder
    return path.join(os.homedir(), 'Documents', 'DKB Transaction Manager');
  } else {
    // In development, use local data folder
    return path.resolve(__dirname, '..', 'data');
  }
}

// Ensure data directory exists and initialize default files
function ensureDataDir() {
  const dir = getDataDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Initialize transactions.json if it doesn't exist
  const transactionsPath = path.join(dir, 'transactions.json');
  if (!fs.existsSync(transactionsPath)) {
    fs.writeFileSync(transactionsPath, JSON.stringify({ transactions: [] }, null, 2), 'utf-8');
  }
  
  // Initialize categories.json if it doesn't exist
  const categoriesPath = path.join(dir, 'categories.json');
  if (!fs.existsSync(categoriesPath)) {
    fs.writeFileSync(categoriesPath, JSON.stringify({ rules: [] }, null, 2), 'utf-8');
  }
  
  return dir;
}

// Start the Express server as a child process
function startExpressServer() {
  // Kill any existing server on this port first (for dev hot-reload scenarios)
  killProcessOnPort(SERVER_PORT);

  let serverCommand;
  let serverArgs;
  
  if (app.isDev) {
    // In development, run via tsx for TypeScript support
    serverCommand = 'npx';
    serverArgs = ['tsx', 'watch', path.join(__dirname, '..', 'server', 'src', 'index.ts')];
  } else {
    // In production, run bundled server
    let serverDistPath = null;

    if (isPackaged) {
      // Try bundled version first, then fallback to unbundled dist
      const candidates = [
        path.join(process.resourcesPath, 'server', 'index.js'),  // Bundled
        path.join(process.resourcesPath, 'server', 'dist', 'index.js'),  // Unbundled
        path.join(__dirname, '..', 'resources', 'server', 'index.js'),
        path.join(__dirname, '..', 'resources', 'server', 'dist', 'index.js'),
      ];

      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          serverDistPath = candidate;
          break;
        }
      }
    } else {
      serverDistPath = path.join(__dirname, '..', 'server-bundled', 'index.js');
      if (!fs.existsSync(serverDistPath)) {
        serverDistPath = path.join(__dirname, '..', 'server', 'dist', 'index.js');
      }
    }

    if (!fs.existsSync(serverDistPath)) {
      console.error('Server dist not found. Run `npm run build` in server/ first.');
      return null;
    }

    serverCommand = process.platform === 'win32' ? 'node.cmd' : 'node';
    serverArgs = ['--experimental-vm-modules', serverDistPath];
  }

  console.log(`Starting Express server on port ${SERVER_PORT}...`);
  
  const env = { ...process.env };
  // Pass the data directory path to the server
  env.DKB_DATA_DIR = getDataDir();
  if (app.isDev) {
    env.DKV_DEV_MODE = '1';
  }

  expressServer = spawn(serverCommand, serverArgs, {
    cwd: isPackaged ? path.join(process.resourcesPath, 'server') : path.join(__dirname, '..', 'server-bundled'),
    env,
    stdio: ['inherit', 'pipe', 'pipe'],
    detached: false,
  });

  // Log server output for debugging
  if (expressServer.stdout) {
    expressServer.stdout.on('data', (data) => {
      console.log(`[Server]: ${data.toString().trim()}`);
    });
  }
  
  if (expressServer.stderr) {
    expressServer.stderr.on('data', (data) => {
      console.error(`[Server Error]: ${data.toString().trim()}`);
    });
  }

  expressServer.on('error', (err) => {
    console.error('Failed to start Express server:', err.message);
  });

  expressServer.on('exit', (code, signal) => {
    if (signal !== 'SIGTERM') {
      console.log(`Express server exited with code ${code} and signal ${signal}`);
      expressServer = null;
    }
  });

  return expressServer;
}

// Kill any process running on the specified port
function killProcessOnPort(port) {
  try {
    if (process.platform === 'win32') {
      const child = require('child_process').spawnSync(
        'netstat', ['-ano'], { encoding: 'utf8' }
      );
      const output = child.stdout || '';
      const lines = output.split('\n');
      
      for (const line of lines) {
        if (line.includes(`:${port}`)) {
          const parts = line.trim().split(/\s+/);
          const pidIndex = parts.length - 1;
          if (parts[pidIndex]) {
            require('child_process').spawnSync(
              'taskkill', ['/F', '/PID', parts[pidIndex]],
              { shell: true }
            );
            console.log(`Killed process ${parts[pidIndex]} on port ${port}`);
          }
        }
      }
    } else {
      const child = require('child_process').spawnSync(
        'lsof', ['-ti', `:${port}`, '-sTCP:LISTEN'],
        { encoding: 'utf8' }
      );
      const pid = child.stdout?.trim();
      if (pid) {
        process.kill(Number(pid), 'SIGKILL');
        console.log(`Killed process ${pid} on port ${port}`);
      }
    }
  } catch (e) {
    // Ignore errors - no process to kill
  }
}

// Static file server for client assets (needed because Vite uses absolute paths)
let httpServer = null;
const CLIENT_PORT = 5174;
const BACKEND_PORT = 3001;

function startClientServer() {
  const http = require('http');
  const fs = require('fs');
  const path = require('path');
  
  // Determine client directory location in production
  let clientDir;
  if (isPackaged) {
    clientDir = path.join(process.resourcesPath, 'client', 'dist');
  } else {
    clientDir = path.join(__dirname, '..', 'client', 'dist');
  }

  // MIME types mapping
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
  };

  const server = http.createServer((req, res) => {
    // Set CORS headers to allow API calls to localhost:3001
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

      // Proxy API requests to Express backend
      if (req.url.startsWith('/api/')) {
        const options = {
          hostname: '127.0.0.1',
          port: BACKEND_PORT,
          path: req.url,
          method: req.method,
          headers: req.headers,
        };

        // Remove hop-by-hop headers that shouldn't be forwarded
        delete options.headers['connection'];
        delete options.headers['keep-alive'];

        if (req.method === 'POST' || req.method === 'PUT') {
          // Handle both JSON and multipart/form-data by collecting all chunks
          const chunks = [];
          req.on('data', chunk => chunks.push(chunk));
          req.on('end', () => {
            const body = Buffer.concat(chunks);
            options.headers['content-length'] = body.length.toString();
            const proxyReq = http.request(options, (proxyRes) => {
              res.writeHead(proxyRes.statusCode, proxyRes.headers);
              proxyRes.pipe(res);
            });
            proxyReq.on('error', () => {
              res.writeHead(502, 'Bad Gateway');
              res.end('API backend unavailable');
            });
            proxyReq.write(body);
            proxyReq.end();
          });
        } else {
          const proxyReq = http.request(options, (proxyRes) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res);
          });
          proxyReq.on('error', () => {
            res.writeHead(502, 'Bad Gateway');
            res.end('API backend unavailable');
          });
          proxyReq.end();
        }
        return;
      }

    // Handle the root path - serve index.html
    let urlPath = req.url.split('?')[0];
    if (urlPath === '/' || urlPath.endsWith('/')) {
      urlPath += 'index.html';
    }

    const filePath = path.join(clientDir, urlPath);
    
    // Security: prevent directory traversal attacks
    try {
      const resolvedPath = path.resolve(filePath);
      if (!resolvedPath.startsWith(path.resolve(clientDir))) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
    } catch (e) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    // Read and serve the file
    fs.readFile(filePath, (err, content) => {
      if (err) {
        if (err.code === 'ENOENT') {
          // Try to serve as SPA fallback - always load index.html for client-side routing
          fs.readFile(path.join(clientDir, 'index.html'), (err2, htmlContent) => {
            if (err2) {
              res.writeHead(404);
              res.end('Not Found');
            } else {
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(htmlContent);
            }
          });
        } else {
          res.writeHead(500);
          res.end('Internal Server Error');
        }
      } else {
        const contentType = mimeTypes[path.extname(filePath)] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });
  });

  server.listen(CLIENT_PORT, '127.0.0.1', () => {
    console.log(`Client static server running on http://localhost:${CLIENT_PORT}`);
  });

  return server;
}

// Gracefully shutdown the Express server and client HTTP server
function shutdownExpressServer() {
  if (expressServer) {
    console.log('Shutting down Express server...');
    expressServer.kill('SIGTERM');
    
    // Force kill after 5 seconds if still running
    setTimeout(() => {
      if (expressServer && !expressServer.killed) {
        expressServer.kill('SIGKILL');
      }
    }, 5000);
  }
  
  stopClientServer();
}

// Gracefully shutdown the client HTTP server only
function stopClientServer() {
  if (httpServer) {
    httpServer.close();
    httpServer = null;
  }
}

// Create the main browser window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'DKB Transaction Manager',
    frame: false,
    icon: isPackaged 
      ? path.join(process.resourcesPath, 'app.asar.unpacked', 'build', 'icon.png')
      : path.join(__dirname, '..', 'public', 'favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: !noSandbox,
      devTools: app.isDev || process.env.NODE_ENV === 'development',
    },
  });

  // Load the application - use Vite dev server in development mode
  if (app.isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    // In production, serve client files via HTTP to handle absolute asset paths
    httpServer = startClientServer();
    
    // Wait for server to be ready before loading the URL
    setTimeout(() => {
      mainWindow.loadURL(`http://localhost:${CLIENT_PORT}`);
    }, 500);
  }

  // Open DevTools in development mode
  if (app.isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC handlers for renderer process communication
function setupIPC() {
  // Get data directory path
  ipcMain.handle('get-data-dir', () => getDataDir());

  // List CSV files in data directory
  ipcMain.handle('list-csv-files', async () => {
    const dataDir = ensureDataDir();
    try {
      const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.csv'));
      return files.map(f => ({ name: f, path: path.join(dataDir, f) }));
    } catch (error) {
      console.error('Error listing CSV files:', error);
      return [];
    }
  });

  // Read file contents
  ipcMain.handle('read-file', async (_event, filePath) => {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return { success: true, content };
    } catch (error) {
      console.error('Error reading file:', error);
      return { success: false, error: error.message };
    }
  });

  // Save file contents
  ipcMain.handle('save-file', async (_event, filePath, content) => {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    try {
      fs.writeFileSync(filePath, content, 'utf-8');
      return { success: true };
    } catch (error) {
      console.error('Error saving file:', error);
      return { success: false, error: error.message };
    }
  });

  // Show save dialog
  ipcMain.handle('show-save-dialog', async (_event, options = {}) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save File',
      defaultPath: options.defaultPath || '',
      filters: [
        { name: 'Text Files', extensions: ['csv', 'txt'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      ...options,
    });
    return result;
  });

  // Show open dialog
  ipcMain.handle('show-open-dialog', async (_event, options = {}) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Open File',
      properties: ['openFile'],
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
      ...options,
    });
    return result;
  });

  // Get application info
  ipcMain.handle('get-app-info', () => ({
    isPackaged,
    appPath: process.resourcesPath || __dirname,
    platform: process.platform,
    version: app.getVersion(),
  }));

  // Window management
  ipcMain.handle('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });
  ipcMain.handle('window-maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });
  ipcMain.handle('window-close', () => {
    if (mainWindow) mainWindow.close();
  });
  ipcMain.handle('window-is-maximized', () => {
    return mainWindow ? mainWindow.isMaximized() : false;
  });
}

// App lifecycle handlers
app.whenReady().then(() => {
  // Ensure data directory exists
  ensureDataDir();
  
  // Start the Express server
  startExpressServer();
  
  // Wait a moment for server to start
  setTimeout(() => {
    createWindow();
    setupIPC();
  }, 1000);
});

app.on('window-all-closed', () => {
  shutdownExpressServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', (event) => {
  // Prevent default quit to allow graceful server shutdown
  event.preventDefault();
  
  console.log('App quitting, shutting down Express server...');
  shutdownExpressServer();
  
  // Allow time for server shutdown before exiting
  setTimeout(() => {
    app.quit();
  }, 1000);
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
