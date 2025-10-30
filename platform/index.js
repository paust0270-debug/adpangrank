const CoupangHandler = require('./coupang-handler');
const NaverHandler = require('./naver-handler');
const ElevenstHandler = require('./11st-handler');

/**
 * 플랫폼 매니저 클래스
 * 각 플랫폼별 핸들러를 관리하고 적절한 핸들러로 작업을 위임합니다.
 */
class PlatformManager {
  constructor() {
    this.platforms = new Map();
    this.registerPlatforms();
  }

  /**
   * 지원하는 플랫폼들을 등록합니다.
   */
  registerPlatforms() {
    this.platforms.set('coupang', new CoupangHandler());
    this.platforms.set('naver', new NaverHandler());
    this.platforms.set('11st', new ElevenstHandler());
    
    console.log(`✅ 등록된 플랫폼: ${Array.from(this.platforms.keys()).join(', ')}`);
  }

  /**
   * 브라우저 인스턴스를 모든 핸들러에 설정합니다.
   * @param {Browser} browser - Playwright 브라우저 인스턴스
   */
  setBrowser(browser) {
    for (const handler of this.platforms.values()) {
      handler.setBrowser(browser);
    }
  }

  /**
   * 슬롯 타입에 따라 적절한 핸들러로 작업을 처리합니다.
   * @param {Object} slotData - 처리할 슬롯 데이터
   * @returns {Promise<Object>} 처리 결과
   */
  async processSlot(slotData) {
    const platform = slotData.slot_type;
    const handler = this.platforms.get(platform);
    
    if (!handler) {
      throw new Error(`지원하지 않는 플랫폼: ${platform}`);
    }

    console.log(`🔍 ${platform} 플랫폼에서 "${slotData.keyword}" 처리 시작`);
    
    try {
      const result = await handler.process(slotData);
      console.log(`✅ ${platform} 플랫폼 처리 완료: ${result.found ? `${result.rank}위 발견` : '상품 미발견'}`);
      return result;
    } catch (error) {
      console.error(`❌ ${platform} 플랫폼 처리 실패: ${error.message}`);
      throw error;
    }
  }

  /**
   * 지원하는 플랫폼 목록을 반환합니다.
   * @returns {Array<string>} 지원하는 플랫폼 목록
   */
  getSupportedPlatforms() {
    return Array.from(this.platforms.keys());
  }

  /**
   * 특정 플랫폼이 지원되는지 확인합니다.
   * @param {string} platform - 확인할 플랫폼 이름
   * @returns {boolean} 지원 여부
   */
  isPlatformSupported(platform) {
    return this.platforms.has(platform);
  }

  /**
   * 플랫폼별 통계 정보를 수집합니다.
   * @param {Object} tasks - 처리된 작업 목록
   * @returns {Object} 플랫폼별 통계
   */
  getPlatformStats(tasks) {
    const stats = {};
    
    for (const [platform, handler] of this.platforms) {
      const platformTasks = tasks.filter(task => task.slot_type === platform);
      
      stats[platform] = {
        totalTasks: platformTasks.length,
        completedTasks: platformTasks.filter(task => task.status === 'completed').length,
        failedTasks: platformTasks.filter(task => task.status === 'failed').length,
        avgProcessingTime: platformTasks.length > 0 
          ? Math.round(platformTasks.reduce((sum, task) => sum + (task.processingTime || 0), 0) / platformTasks.length)
          : 0
      };
    }
    
    return stats;
  }

  /**
   * 모든 핸들러의 상태를 확인합니다.
   * @returns {Object} 핸들러 상태 정보
   */
  getHandlersStatus() {
    const status = {};
    
    for (const [platform, handler] of this.platforms) {
      status[platform] = {
        name: handler.getPlatformName(),
        browserSet: handler.browser !== null,
        ready: handler.browser !== null
      };
    }
    
    return status;
  }

  /**
   * 특정 플랫폼의 핸들러를 가져옵니다.
   * @param {string} platform - 플랫폼 이름
   * @returns {BaseHandler|null} 핸들러 인스턴스 또는 null
   */
  getHandler(platform) {
    return this.platforms.get(platform) || null;
  }

  /**
   * 모든 핸들러를 초기화합니다.
   */
  async initializeAll() {
    console.log('🚀 모든 플랫폼 핸들러 초기화 중...');
    
    for (const [platform, handler] of this.platforms) {
      try {
        if (typeof handler.initialize === 'function') {
          await handler.initialize();
          console.log(`✅ ${platform} 핸들러 초기화 완료`);
        }
      } catch (error) {
        console.error(`❌ ${platform} 핸들러 초기화 실패: ${error.message}`);
      }
    }
  }

  /**
   * 모든 핸들러를 정리합니다.
   */
  async cleanupAll() {
    console.log('🧹 모든 플랫폼 핸들러 정리 중...');
    
    for (const [platform, handler] of this.platforms) {
      try {
        if (typeof handler.cleanup === 'function') {
          await handler.cleanup();
          console.log(`✅ ${platform} 핸들러 정리 완료`);
        }
      } catch (error) {
        console.error(`❌ ${platform} 핸들러 정리 실패: ${error.message}`);
      }
    }
  }
}

module.exports = PlatformManager;

