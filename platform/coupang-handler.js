const BaseHandler = require('./base-handler');
const UrlParser = require('../utils/url-parser');

/**
 * 쿠팡 핸들러 클래스
 * 쿠팡 플랫폼에서 상품 순위를 검색하는 기능을 제공합니다.
 */
class CoupangHandler extends BaseHandler {
  constructor() {
    super();
    this.platformName = 'coupang';
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
   * 쿠팡에서 상품 순위를 검색합니다.
   * @param {Object} slotData - 검색할 슬롯 데이터
   * @returns {Promise<Object>} 검색 결과
   */
  async process(slotData) {
    if (!this.browser) {
      throw new Error('브라우저가 설정되지 않았습니다.');
    }

    const context = await this.browser.newContext(this.getCommonContextOptions());
    await this.addAntiDetectionScript(context);

    const page = await context.newPage();
    await this.setupNetworkOptimization(page);

    try {
      const result = await this.searchCoupang(page, slotData);
      return result;
    } finally {
      try { await page.close({ runBeforeUnload: true }); } catch (_) {}
      try { await context.close(); } catch (_) {}
    }
  }

  /**
   * 쿠팡에서 특정 상품의 순위를 검색합니다.
   * @param {Page} page - Playwright 페이지 인스턴스
   * @param {Object} slotData - 검색할 슬롯 데이터
   * @returns {Promise<Object>} 검색 결과
   */
  async searchCoupang(page, slotData) {
    const startTime = Date.now();
    
    // URL에서 상품번호 추출
    const targetProductId = UrlParser.extractProductId(slotData.link_url, 'coupang');
    
    if (!targetProductId) {
      console.warn(`URL에서 상품번호를 추출할 수 없습니다: ${slotData.link_url}`);
      return {
        found: false,
        rank: null,
        totalProducts: 0,
        processingTime: Date.now() - startTime,
        error: '상품번호 추출 실패'
      };
    }

    console.log(`🎯 타겟 상품번호: ${targetProductId}`);

    let foundRank = null;
    let allProducts = new Set();
    let pageNumber = 1;

    while (pageNumber <= this.maxPages && allProducts.size < this.maxProducts) {
      const searchUrl = pageNumber === 1 ? 
        `https://www.coupang.com/search?q=${encodeURIComponent(slotData.keyword)}` :
        `https://www.coupang.com/search?q=${encodeURIComponent(slotData.keyword)}&page=${pageNumber}`;
      
      console.log(`⚡ "${slotData.keyword}" 페이지 ${pageNumber}/${this.maxPages} 탐색...`);
      
      try {
        const pageResult = await this.retryOperation(async () => {
          return await this.processPage(page, searchUrl, targetProductId, pageNumber);
        }, 3, 1000);

        if (pageResult.error) {
          console.warn(`페이지 ${pageNumber} 처리 실패: ${pageResult.error}`);
          if (pageNumber > 3) {
            break;
          }
          pageNumber++;
          continue;
        }

        // 새로운 상품 추출 (중복 제거)
        const previousCount = allProducts.size;
        pageResult.products.forEach(product => {
          allProducts.add(product.productId);
        });
        const newProductsCount = allProducts.size - previousCount;

        console.log(`📦 페이지 ${pageNumber}: ${pageResult.products.length}개 발견 (${newProductsCount}개 새로운 상품)`);

        // 타겟 상품 발견 체크
        if (pageResult.targetFound && !foundRank) {
          const targetInAll = Array.from(allProducts).indexOf(targetProductId);
          foundRank = targetInAll + 1;
          console.log(`🎯 "${slotData.keyword}" 페이지 ${pageNumber}에서 타겟 상품 발견! 전체 순위: ${foundRank}`);
          break;
        }

        // 조건 충족 시 중단
        if (foundRank) {
          console.log(`✅ 타겟 상품 발견으로 검색 완료!`);
          break;
        }

        if (allProducts.size >= this.maxProducts) {
          console.log(`🏁 목표 ${this.maxProducts}개 상품 도달로 검색 완료!`);
          break;
        }

        // 새로운 상품이 없는 페이지 범위 확장 결정
        if (newProductsCount === 0 && allProducts.size > 0) {
          console.log(`ℹ️ 새로운 상품 없음 - 페이지 범위 확인 중...`);
          if (pageNumber >= 15) {
            console.log(`⏹️ 충분한 페이지 탐색 완료로 중단`);
            break;
          }
        }

        pageNumber++;
      } catch (pageError) {
        console.log(`🔴 페이지 ${pageNumber} 로드 실패: ${pageError.message}`);
        if (pageNumber > 3) {
          break;
        }
        pageNumber++;
      }
    }

    const processingTime = Date.now() - startTime;

    return {
      found: !!foundRank,
      rank: foundRank,
      totalProducts: allProducts.size,
      processingTime: processingTime,
      targetProductId: targetProductId
    };
  }

  /**
   * 개별 페이지를 처리합니다.
   * @param {Page} page - Playwright 페이지 인스턴스
   * @param {string} searchUrl - 검색 URL
   * @param {string} targetProductId - 타겟 상품번호
   * @param {number} pageNumber - 페이지 번호
   * @returns {Promise<Object>} 페이지 처리 결과
   */
  async processPage(page, searchUrl, targetProductId, pageNumber) {
    try {
      await page.goto(searchUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 6000
      });

      const delay = this.calculateDelay(this.baseDelay, pageNumber);
      await page.waitForTimeout(delay);

      const productsData = await page.evaluate((targetProductId) => {
        const products = [];
        
        // 다양한 셀렉터로 상품 정보 추출
        const selectors = [
          'a[href*="/products/"]',
          'a[href*="/vp/products/"]',
          '[data-product-id]',
          '[data-vendor-item-id]',
          '[data-item-id]'
        ];

        selectors.forEach(selector => {
          document.querySelectorAll(selector).forEach((element) => {
            let productId = null;
            
            if (element.tagName === 'A') {
              const href = element.href || element.getAttribute('href');
              if (href && href.includes('/products/')) {
                const match = href.match(/\/(?:vp\/)?products\/(\d+)/);
                if (match) productId = match[1];
              }
            } else {
              productId = element.getAttribute('data-product-id') || 
                         element.getAttribute('data-vendor-item-id') ||
                         element.getAttribute('data-item-id');
            }
            
            if (productId && !products.find(p => p.productId === productId)) {
              products.push({
                productId: String(productId),
                rank: products.length + 1
              });
            }
          });
        });
        
        // 타겟 상품 찾기
        const targetProduct = products.find(product => product.productId === targetProductId);
        
        return {
          products: products,
          targetFound: !!targetProduct,
          targetRankInPage: targetProduct ? products.indexOf(targetProduct) + 1 : null,
          totalFound: products.length
        };
      }, targetProductId);

      return {
        products: productsData.products,
        targetFound: productsData.targetFound,
        targetRankInPage: productsData.targetRankInPage,
        totalFound: productsData.totalFound
      };

    } catch (error) {
      return {
        error: error.message,
        products: [],
        targetFound: false,
        totalFound: 0
      };
    }
  }

  /**
   * 검색 설정을 업데이트합니다.
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
      platform: this.platformName
    };
  }
}

module.exports = CoupangHandler;

