const BaseHandler = require('./base-handler');
const UrlParser = require('../utils/url-parser');

/**
 * 11번가 핸들러 클래스 (스텁)
 * 11번가 플랫폼에서 상품 순위를 검색하는 기능을 제공합니다.
 * 현재는 기본 구조만 구현되어 있으며, 향후 확장 예정입니다.
 */
class ElevenstHandler extends BaseHandler {
  constructor() {
    super();
    this.platformName = '11st';
    this.maxPages = 20;
    this.maxProducts = 2000;
    this.baseDelay = 600;
  }

  /**
   * 플랫폼 이름을 반환합니다.
   * @returns {string} 플랫폼 이름
   */
  getPlatformName() {
    return this.platformName;
  }

  /**
   * 11번가에서 상품 순위를 검색합니다.
   * @param {Object} slotData - 검색할 슬롯 데이터
   * @returns {Promise<Object>} 검색 결과
   */
  async process(slotData) {
    console.log(`🚧 11번가 핸들러는 아직 구현되지 않았습니다.`);
    console.log(`📋 요청된 데이터: ${JSON.stringify(slotData, null, 2)}`);
    
    // 스텁 구현 - 실제로는 에러를 발생시키거나 기본값을 반환
    return {
      found: false,
      rank: null,
      totalProducts: 0,
      processingTime: 0,
      error: '11번가 핸들러 미구현',
      targetProductId: UrlParser.extractProductId(slotData.url, '11st')
    };
  }

  /**
   * 11번가에서 특정 상품의 순위를 검색합니다.
   * @param {Page} page - Playwright 페이지 인스턴스
   * @param {Object} slotData - 검색할 슬롯 데이터
   * @returns {Promise<Object>} 검색 결과
   */
  async search11st(page, slotData) {
    // 향후 구현 예정
    throw new Error('11번가 검색 기능은 아직 구현되지 않았습니다.');
  }

  /**
   * 11번가 검색 설정을 업데이트합니다.
   * @param {Object} config - 새로운 설정
   */
  updateConfig(config) {
    if (config.maxPages) this.maxPages = config.maxPages;
    if (config.maxProducts) this.maxProducts = config.maxProducts;
    if (config.baseDelay) this.baseDelay = config.baseDelay;
  }

  /**
   * 현재 설정을 반환합니다.
   * @returns {Object} 현재 설정
   */
  getConfig() {
    return {
      maxPages: this.maxPages,
      maxProducts: this.maxProducts,
      baseDelay: this.baseDelay,
      platform: this.platformName,
      status: 'stub'
    };
  }
}

module.exports = ElevenstHandler;

