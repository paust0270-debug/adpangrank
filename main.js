const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const ConfigReader = require('./utils/config-reader');

let mainWindow;
let rankCheckerProcess = null;
let nextIpChangeAt = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'icon.png'),
    title: '쿠팡 순위 체킹기 v1.0'
  });

  mainWindow.loadFile('index.html');
  
  // 개발자 도구 열기 (개발용)
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// 순위 체킹 프로세스 시작
ipcMain.handle('start-rank-check', async () => {
  if (rankCheckerProcess) {
    return { success: false, message: '이미 실행 중입니다.' };
  }

  try {
    // Electron을 Node처럼 실행하여 백엔드 루프 실행 (배포 환경에서 node 미설치 대응)
    const appPath = app.getAppPath();
    const scriptPath = path.join(appPath, 'continuous-rank-checker.js');
    rankCheckerProcess = spawn(process.execPath, [scriptPath], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // 간단한 타이머 기준값 설정 (UI 표시에 사용)
    try {
      const cfg = new ConfigReader('./config.ini');
      const mins = parseInt(cfg.get('settings', 'ip_change_interval')) || 60;
      nextIpChangeAt = Date.now() + mins * 60 * 1000;
    } catch (_) {}

    // 실시간 로그 전송
    rankCheckerProcess.stdout.on('data', (data) => {
      const logMessage = data.toString();
      mainWindow.webContents.send('rank-check-log', logMessage);
    });

    rankCheckerProcess.stderr.on('data', (data) => {
      const errorMessage = data.toString();
      mainWindow.webContents.send('rank-check-error', errorMessage);
    });

    rankCheckerProcess.on('close', (code) => {
      rankCheckerProcess = null;
      mainWindow.webContents.send('rank-check-complete', code);
    });

    return { success: true, message: '순위 체킹을 시작했습니다.' };
  } catch (error) {
    return { success: false, message: `실행 오류: ${error.message}` };
  }
});

// 순위 체킹 프로세스 중지
ipcMain.handle('stop-rank-check', async () => {
  if (!rankCheckerProcess) {
    return { success: false, message: '실행 중인 프로세스가 없습니다.' };
  }

  try {
    rankCheckerProcess.kill('SIGTERM');
    rankCheckerProcess = null;
    return { success: true, message: '순위 체킹을 중지했습니다.' };
  } catch (error) {
    return { success: false, message: `중지 오류: ${error.message}` };
  }
});

// 프로세스 상태 확인
ipcMain.handle('get-status', async () => {
  return {
    isRunning: rankCheckerProcess !== null,
    pid: rankCheckerProcess ? rankCheckerProcess.pid : null
  };
});

// 워커 ID 조회
ipcMain.handle('get-worker-id', async () => {
  const cfg = new ConfigReader('./config.ini');
  return cfg.get('login', 'id') || 'worker-unknown';
});

// 현재 IP 조회
ipcMain.handle('get-current-ip', async () => {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    return data.ip;
  } catch (e) {
    return null;
  }
});

// 다음 IP 변경 예정 시각 조회 (ms epoch)
ipcMain.handle('get-next-ip-change', async () => {
  return nextIpChangeAt;
});
