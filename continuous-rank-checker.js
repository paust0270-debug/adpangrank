const { chromium } = require('playwright');
const SupabaseClient = require('./supabase/client');
const PlatformManager = require('./platform/index');

/**
 * 24시간 연속 순위 체킹기
 * Supabase DB에서 작업 목록을 지속적으로 처리하는 시스템
 */
class ContinuousRankChecker {
  constructor() {
    this.supabase = new SupabaseClient();
    this.platformManager = new PlatformManager();
    this.browser = null;
    this.isRunning = false;
    this.processedCount = 0;
    this.errorCount = 0;
    this.startTime = null;
  }

  /**
   * 시스템을 초기화합니다.
   */
  async initialize() {
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
      
    } catch (error) {
      console.error('❌ 초기화 실패:', error.message);
      throw error;
    }
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
    // 모든 플랫폼의 작업 목록 조회
    const allTasks = await this.supabase.getAllPendingTasks();
    
    if (allTasks.length === 0) {
      return; // 작업 목록이 비어있음
    }

    console.log(`\n📋 총 ${allTasks.length}개의 작업을 처리합니다.`);

    // 플랫폼별로 그룹화
    const tasksByPlatform = this.groupTasksByPlatform(allTasks);

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
      if (!grouped.has(task.slot_type)) {
        grouped.set(task.slot_type, []);
      }
      grouped.get(task.slot_type).push(task);
    });
    
    return grouped;
  }

  /**
   * 개별 작업을 처리합니다.
   * @param {Object} task - 처리할 작업
   */
  async processTask(task) {
    console.log(`\n🔍 처리 시작: "${task.keyword}" (ID: ${task.id}, 플랫폼: ${task.slot_type})`);
    
    try {
      // 플랫폼별 핸들러로 처리
      const result = await this.platformManager.processSlot(task);
      
      if (result.found) {
        // 순위 정보를 Supabase에 저장
        await this.supabase.saveRankStatus(
          task.keyword,
          task.link_url, // url → link_url로 수정
          task.slot_type,
          result.targetProductId,
          result.rank,
          result.rank // start_rank도 동일하게 설정 (처음 기록)
        );
        
        console.log(`✅ 순위 저장 완료: ${result.rank}위`);
        console.log(`📊 처리 시간: ${result.processingTime}ms`);
      } else {
        console.log(`❌ 상품을 찾지 못했습니다. (${result.totalProducts}개 상품 확인)`);
        
        // 상품을 찾지 못한 경우에도 기록 (선택사항)
        if (result.totalProducts > 0) {
          await this.supabase.saveRankStatus(
            task.keyword,
            task.link_url, // url → link_url로 수정
            task.slot_type,
            result.targetProductId,
            null, // 순위 없음
            null  // 시작 순위도 없음
          );
        }
      }

      // 처리 완료된 키워드 삭제
      await this.supabase.deleteProcessedKeyword(task.id);
      this.processedCount++;
      
      console.log(`🗑️ 키워드 삭제 완료: ${task.id}`);
      console.log(`📈 처리 완료: ${this.processedCount}개, 오류: ${this.errorCount}개`);

    } catch (error) {
      this.errorCount++;
      console.error(`❌ 처리 실패 (${task.keyword}):`, error.message);
      
      // 오류 발생 시에도 키워드를 삭제할지 결정 (선택사항)
      // await this.supabase.deleteProcessedKeyword(task.id);
    } finally {
      // 작업 완료 후 브라우저 닫기
      if (this.browser) {
        try {
          await this.browser.close();
          console.log('🔒 브라우저 종료');
        } catch (browserError) {
          console.error('❌ 브라우저 종료 오류:', browserError.message);
        }
      }
    }
  }

  /**
   * 시스템을 중지합니다.
   */
  async stop() {
    console.log('\n🛑 시스템 중지 중...');
    this.isRunning = false;
    
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

