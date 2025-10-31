const { chromium } = require('playwright');
const SupabaseClient = require('./supabase/client');
const PlatformManager = require('./platform/index');
const ADBController = require('./adb/controller');
const ConfigReader = require('./utils/config-reader');

/**
 * 24시간 연속 순위 체킹기
 * Supabase DB에서 작업 목록을 지속적으로 처리하는 시스템
 */
class ContinuousRankChecker {
  constructor() {
    this.configReader = new ConfigReader('./config.ini');
    this.workerId = this.configReader.get('login', 'id') || 'worker-unknown';
    this.supabase = new SupabaseClient();
    this.platformManager = new PlatformManager();
    this.adbController = new ADBController(this.configReader.get('adb', 'adb_path') || 'adb');
    this.browser = null;
    this.isRunning = false;
    this.processedCount = 0;
    this.errorCount = 0;
    this.startTime = null;
    this.currentIp = null;
    this.ipChangeIntervalMs = (parseInt(this.configReader.get('settings', 'ip_change_interval')) || 60) * 60 * 1000;
    this.airplaneEnabled = (this.configReader.get('settings', 'airplane_mode_enabled') || 'false') === 'true';
    this.ipChangeTimer = null;
    this.useRpc = (this.configReader.get('settings', 'use_rpc') || 'true') === 'true';
  }

  normalizePlatform(slotType) {
    const s = String(slotType || '').trim().toLowerCase();
    // 쿠팡 계열은 모두 웹 쿠팡 처리로 통일
    if (s === '쿠팡' || s === 'coupang' || s === 'coupang-web') return 'coupang';
    if (s === '쿠팡vip' || s === 'coupangvip' || s === '쿠팡app' || s === 'coupangapp' || s === '쿠팡순위체크' || s === 'coupangrank') return 'coupang';
    if (s === 'naver' || s === '네이버') return 'naver';
    if (s === '11st' || s === '11번가') return '11st';
    return s;
  }

  /**
   * 시스템을 초기화합니다.
   */
  async initialize() {
    console.log(`🎯 워커 ID: ${this.workerId}`);
    console.log('🎯 24시간 연속 순위 체킹기 초기화...');
    
    try {
      // 브라우저 초기화
      this.browser = await chromium.launch({
        headless: false,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-extensions',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows',
          '--disable-client-side-phishing-detection',
          '--disable-sync',
          '--disable-default-apps',
          '--disable-translate',
          '--disable-gpu',
          '--disable-http2',
          '--enable-http1',
          '--force-http1',
          '--disable-quic',
          '--ignore-certificate-errors',
          '--ignore-ssl-errors',
          '--allow-running-insecure-content',
          '--disable-logging',
          '--disable-notifications',
          '--no-first-run',
          '--mute-audio',
          '--disable-speech-api',
          '--disable-background-networking',
          '--disable-background-sync'
        ],
        ignoreHTTPSErrors: true
      });

      // 플랫폼 매니저에 브라우저 설정
      this.platformManager.setBrowser(this.browser);

      console.log('✅ 브라우저 초기화 완료');
      console.log(`✅ 지원 플랫폼: ${this.platformManager.getSupportedPlatforms().join(', ')}`);

      // 현재 IP 확인 및 타이머 시작
      this.currentIp = await this.adbController.getCurrentIp();
      console.log(`📍 현재 IP: ${this.currentIp}`);
      if (this.airplaneEnabled) {
        this.startIpChangeTimer();
      }
      
    } catch (error) {
      console.error('❌ 초기화 실패:', error.message);
      throw error;
    }
  }

  startIpChangeTimer() {
    console.log(`⏰ IP 변경 타이머 시작 (${Math.floor(this.ipChangeIntervalMs / 60000)}분마다)`);
    if (this.ipChangeTimer) clearInterval(this.ipChangeTimer);
    this.ipChangeTimer = setInterval(async () => {
      try {
        console.log('\n🔄 IP 변경 시간입니다...');
        this.currentIp = await this.adbController.changeIp();
      } catch (e) {
        console.error('❌ IP 변경 실패:', e.message);
      }
    }, this.ipChangeIntervalMs);
  }

  /**
   * 24시간 연속 처리를 시작합니다.
   */
  async startContinuousProcess() {
    this.isRunning = true;
    this.startTime = Date.now();
    
    console.log('🚀 24시간 연속 순위 체킹을 시작합니다...');
    console.log('💡 Ctrl+C를 눌러 안전하게 종료할 수 있습니다.');
    
    while (this.isRunning) {
      try {
        await this.processAvailableTasks();
        
        // 작업 목록이 비어있을 경우 10초 대기
        console.log('⏰ 작업 목록이 비어있습니다. 10초 후 다시 확인합니다...');
        await this.sleep(10000);
        
      } catch (error) {
        this.errorCount++;
        console.error('💥 처리 중 오류 발생:', error.message);
        console.log('⏰ 30초 후 재시도합니다...');
        await this.sleep(30000);
      }
    }
  }

  /**
   * 대기 중인 작업들을 처리합니다.
   */
  async processAvailableTasks() {
    // 워커별 할당 작업 조회
    const allTasks = await this.supabase.getAllPendingTasks(this.workerId);
    
    if (allTasks.length === 0) {
      return; // 작업 목록이 비어있음
    }

    console.log(`\n📋 총 ${allTasks.length}개의 작업을 처리합니다.`);

    // 플랫폼별로 그룹화 (정규화된 키 사용)
    const normalizedTasks = allTasks.map(t => ({ ...t, slot_type: this.normalizePlatform(t.slot_type) }));
    const tasksByPlatform = this.groupTasksByPlatform(normalizedTasks);

    for (const [platform, tasks] of tasksByPlatform) {
      console.log(`\n🔍 ${platform} 플랫폼 작업 시작 (${tasks.length}개)`);
      
      for (const task of tasks) {
        await this.processTask(task);
        
        // 작업 간 대기 (서버 부하 방지)
        await this.sleep(2000);
      }
    }
  }

  /**
   * 작업을 플랫폼별로 그룹화합니다.
   * @param {Array} tasks - 작업 목록
   * @returns {Map} 플랫폼별 그룹화된 작업
   */
  groupTasksByPlatform(tasks) {
    const grouped = new Map();
    
    tasks.forEach(task => {
      const key = task.slot_type;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(task);
    });
    
    return grouped;
  }

  /**
   * 개별 작업을 처리합니다.
   * @param {Object} task - 처리할 작업
   */
  async processTask(task) {
    const normalized = this.normalizePlatform(task.slot_type);
    const taskForPlatform = { ...task, slot_type: normalized };
    console.log(`\n🔍 처리 시작: "${task.keyword}" (ID: ${task.id}, 플랫폼: ${task.slot_type} -> ${normalized})`);
    
    try {
      // 플랫폼별 핸들러로 처리
      const result = await this.platformManager.processSlot(taskForPlatform);
      
      const currentRank = result.found ? result.rank : null;

      // 대상 테이블 매핑
      const table = (slotType => {
        switch (slotType) {
          case '쿠팡': return 'slot_status';
          case '쿠팡VIP': return 'slot_copangvip';
          case '쿠팡APP': return 'slot_copangapp';
          case '쿠팡순위체크': return 'slot_copangrank';
          default: return 'slot_status';
        }
      })(task.slot_type);

      if (this.useRpc) {
        // RPC로 순위 갱신 + keywords 삭제(트랜잭션)
        await this.supabase.updateRankAndDeleteKeyword({
          table,
          slot_sequence: task.slot_sequence,
          keyword: task.keyword,
          link_url: task.link_url,
          current_rank: currentRank,
          keyword_id: task.id
        });
      } else {
        // 비-RPC fallback (이전 방식): 저장 후 삭제
        if (currentRank !== null) {
          await this.supabase.saveRankStatus(
            task.keyword,
            task.link_url,
            task.slot_type,
            result.targetProductId,
            currentRank,
            currentRank,
            task.slot_sequence  // slot_sequence 추가 (1:1 매칭을 위해)
          );
        }
        await this.supabase.deleteProcessedKeyword(task.id);
      }

      if (result.found) {
        console.log(`✅ 순위 저장 완료: ${result.rank}위`);
      } else {
        console.log(`❌ 상품을 찾지 못했습니다. (${result.totalProducts}개 상품 확인)`);
      }

      console.log(`📊 처리 시간: ${result.processingTime}ms`);
      this.processedCount++;
      
      console.log(`🗑️ 트랜잭션 완료 및 키워드 삭제: ${task.id}`);
      console.log(`📈 처리 완료: ${this.processedCount}개, 오류: ${this.errorCount}개`);

    } catch (error) {
      this.errorCount++;
      console.error(`❌ 처리 실패 (${task.keyword}):`, error.message);
      
      // 오류 발생 시에도 키워드를 삭제할지 결정 (선택사항)
      // await this.supabase.deleteProcessedKeyword(task.id);
    }
  }

  /**
   * 시스템을 중지합니다.
   */
  async stop() {
    console.log('\n🛑 시스템 중지 중...');
    this.isRunning = false;
    if (this.ipChangeTimer) {
      clearInterval(this.ipChangeTimer);
      this.ipChangeTimer = null;
    }
    
    if (this.browser) {
      await this.browser.close();
      console.log('🔒 브라우저 종료');
    }
    
    // 통계 출력
    this.printStatistics();
  }

  /**
   * 통계 정보를 출력합니다.
   */
  printStatistics() {
    const runtime = Date.now() - this.startTime;
    const hours = Math.floor(runtime / (1000 * 60 * 60));
    const minutes = Math.floor((runtime % (1000 * 60 * 60)) / (1000 * 60));
    
    console.log('\n📊 실행 통계:');
    console.log(`   실행 시간: ${hours}시간 ${minutes}분`);
    console.log(`   처리 완료: ${this.processedCount}개`);
    console.log(`   오류 발생: ${this.errorCount}개`);
    console.log(`   성공률: ${this.processedCount > 0 ? Math.round((this.processedCount / (this.processedCount + this.errorCount)) * 100) : 0}%`);
  }

  /**
   * 지정된 시간만큼 대기합니다.
   * @param {number} ms - 대기 시간 (밀리초)
   * @returns {Promise} 대기 완료 Promise
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 시스템 상태를 확인합니다.
   * @returns {Object} 시스템 상태 정보
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      processedCount: this.processedCount,
      errorCount: this.errorCount,
      runtime: this.startTime ? Date.now() - this.startTime : 0,
      browserConnected: this.browser !== null,
      supportedPlatforms: this.platformManager.getSupportedPlatforms()
    };
  }
}

// 실행
(async () => {
  const checker = new ContinuousRankChecker();
  
  // 종료 시그널 처리
  process.on('SIGINT', async () => {
    console.log('\n🛑 종료 신호를 받았습니다...');
    await checker.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 종료 신호를 받았습니다...');
    await checker.stop();
    process.exit(0);
  });

  // 예상치 못한 오류 처리
  process.on('uncaughtException', async (error) => {
    console.error('💥 예상치 못한 오류:', error);
    await checker.stop();
    process.exit(1);
  });

  process.on('unhandledRejection', async (reason, promise) => {
    console.error('💥 처리되지 않은 Promise 거부:', reason);
    await checker.stop();
    process.exit(1);
  });

  try {
    await checker.initialize();
    await checker.startContinuousProcess();
  } catch (error) {
    console.error('💥 시스템 실행 실패:', error);
    await checker.stop();
    process.exit(1);
  }
})();

