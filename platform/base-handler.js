const { chromium } = require('playwright');

/**
 * 베이스 핸들러 클래스
 * 모든 플랫폼 핸들러의 공통 기능을 제공합니다.
 */
class BaseHandler {
  constructor() {
    this.browser = null;
  }

  /**
   * 브라우저 인스턴스를 설정합니다.
   * @param {Browser} browser - Playwright 브라우저 인스턴스
   */
  setBrowser(browser) {
    this.browser = browser;
  }

  /**
   * 공통 브라우저 컨텍스트 설정을 생성합니다.
   * @returns {Object} 브라우저 컨텍스트 설정
   */
  getCommonContextOptions() {
    return {
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
      locale: "ko-KR",
      timezoneId: "Asia/Seoul",
      extraHTTPHeaders: {
        'accept-language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-encoding': 'gzip, deflate',
        'cache-control': 'max-age=0',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1'
      },
      javaScriptEnabled: true
    };
  }

  /**
   * 공통 브라우저 런치 옵션을 반환합니다.
   * @returns {Object} 브라우저 런치 옵션
   */
  getCommonLaunchOptions() {
    return {
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
    };
  }

  /**
   * 네트워크 최적화를 위한 라우트 설정을 적용합니다.
   * @param {Page} page - Playwright 페이지 인스턴스
   */
  async setupNetworkOptimization(page) {
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      const url = route.request().url();
      
      // 불필요한 리소스 차단
      if (resourceType === 'image' && 
          (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || url.includes('.webp'))) {
        route.abort(); // 대용량 이미지 차단
      } else if (resourceType === 'font' || 
                 url.includes('analytics') ||
                 url.includes('tracking') ||
                 url.includes('ads') ||
                 url.includes('facebook') ||
                 url.includes('google-analytics') ||
                 url.includes('googletagmanager')) {
        route.abort(); // 추적/광고 관련 차단
      } else {
        route.continue();
      }
    });
  }

  /**
   * 웹드라이버 감지를 우회하는 스크립트를 추가합니다.
   * @param {BrowserContext} context - 브라우저 컨텍스트
   */
  async addAntiDetectionScript(context) {
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['ko-KR', 'ko', 'en'] });
      
      // Chrome 객체 추가
      window.chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {}
      };
    });
  }

  /**
   * 페이지 로딩 대기 시간을 계산합니다.
   * @param {number} baseDelay - 기본 대기 시간 (ms)
   * @param {number} pageNumber - 현재 페이지 번호
   * @returns {number} 계산된 대기 시간
   */
  calculateDelay(baseDelay = 600, pageNumber = 1) {
    // 첫 페이지는 빠르게, 이후 페이지는 점진적으로 증가
    return Math.min(baseDelay + (pageNumber - 1) * 100, 1500);
  }

  /**
   * 에러 발생 시 재시도 로직을 처리합니다.
   * @param {Function} operation - 실행할 작업
   * @param {number} maxRetries - 최대 재시도 횟수
   * @param {number} delay - 재시도 간격 (ms)
   * @returns {Promise} 작업 결과
   */
  async retryOperation(operation, maxRetries = 3, delay = 1000) {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        console.warn(`재시도 ${i + 1}/${maxRetries} 실패: ${error.message}`);
        
        if (i < maxRetries - 1) {
          await this.sleep(delay * (i + 1)); // 지수적 백오프
        }
      }
    }
    
    throw lastError;
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
   * 처리 시간을 측정합니다.
   * @param {Function} operation - 측정할 작업
   * @returns {Promise<Object>} {result, processingTime} 객체
   */
  async measureTime(operation) {
    const startTime = Date.now();
    const result = await operation();
    const processingTime = Date.now() - startTime;
    
    return { result, processingTime };
  }

  /**
   * 플랫폼별 검색 메서드 (하위 클래스에서 구현)
   * @param {Object} slotData - 검색할 슬롯 데이터
   * @returns {Promise<Object>} 검색 결과
   */
  async process(slotData) {
    throw new Error('process 메서드는 하위 클래스에서 구현해야 합니다.');
  }

  /**
   * 플랫폼 이름을 반환합니다 (하위 클래스에서 구현)
   * @returns {string} 플랫폼 이름
   */
  getPlatformName() {
    throw new Error('getPlatformName 메서드는 하위 클래스에서 구현해야 합니다.');
  }
}

module.exports = BaseHandler;

