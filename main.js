const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let rankCheckerProcess = null;

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
    // Node.js 프로세스로 최종 완성체 스크립트 실행
    rankCheckerProcess = spawn('node', ['optimized_fast_checker_gui.js'], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe']
    });

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
