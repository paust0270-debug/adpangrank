/**
 * URL 파서 유틸리티
 * 각 플랫폼별 URL에서 상품번호를 추출하는 기능을 제공합니다.
 */

class UrlParser {
  /**
   * URL에서 상품번호를 추출합니다.
   * @param {string} url - 상품 URL
   * @param {string} platform - 플랫폼 타입 ('coupang', 'naver', '11st')
   * @returns {string|null} 추출된 상품번호 또는 null
   */
  static extractProductId(url, platform) {
    if (!url || typeof url !== 'string') {
      return null;
    }

    switch (platform.toLowerCase()) {
      case 'coupang':
        return this.extractCoupangProductId(url);
      case 'naver':
        return this.extractNaverProductId(url);
      case '11st':
        return this.extract11stProductId(url);
      default:
        console.warn(`지원하지 않는 플랫폼: ${platform}`);
        return null;
    }
  }

  /**
   * 쿠팡 URL에서 상품번호를 추출합니다.
   * @param {string} url - 쿠팡 상품 URL
   * @returns {string|null} 추출된 상품번호 또는 null
   */
  static extractCoupangProductId(url) {
    // 쿠팡 URL 패턴들:
    // https://www.coupang.com/vp/products/8473798698?itemId=24519876305
    // https://www.coupang.com/products/8473798698
    // https://m.coupang.com/vp/products/8473798698
    
    const patterns = [
      /\/products\/(\d+)/,           // /products/숫자
      /\/vp\/products\/(\d+)/,       // /vp/products/숫자
      /productId=(\d+)/,             // productId=숫자
      /itemId=(\d+)/                 // itemId=숫자
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    console.warn(`쿠팡 URL에서 상품번호를 찾을 수 없습니다: ${url}`);
    return null;
  }

  /**
   * 네이버 쇼핑 URL에서 상품번호를 추출합니다.
   * @param {string} url - 네이버 쇼핑 상품 URL
   * @returns {string|null} 추출된 상품번호 또는 null
   */
  static extractNaverProductId(url) {
    // 네이버 쇼핑 URL 패턴들:
    // https://shopping.naver.com/catalog/12345678901
    // https://shopping.naver.com/detail/detail.naver?nv_mid=12345678901
    
    const patterns = [
      /\/catalog\/(\d+)/,            // /catalog/숫자
      /nv_mid=(\d+)/,                 // nv_mid=숫자
      /productId=(\d+)/,              // productId=숫자
      /itemId=(\d+)/                  // itemId=숫자
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    console.warn(`네이버 URL에서 상품번호를 찾을 수 없습니다: ${url}`);
    return null;
  }

  /**
   * 11번가 URL에서 상품번호를 추출합니다.
   * @param {string} url - 11번가 상품 URL
   * @returns {string|null} 추출된 상품번호 또는 null
   */
  static extract11stProductId(url) {
    // 11번가 URL 패턴들:
    // https://www.11st.co.kr/products/1234567890
    // https://www.11st.co.kr/products/1234567890/share
    
    const patterns = [
      /\/products\/(\d+)/,            // /products/숫자
      /productId=(\d+)/,              // productId=숫자
      /itemId=(\d+)/,                 // itemId=숫자
      /prdNo=(\d+)/                   // prdNo=숫자
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    console.warn(`11번가 URL에서 상품번호를 찾을 수 없습니다: ${url}`);
    return null;
  }

  /**
   * URL이 유효한지 검증합니다.
   * @param {string} url - 검증할 URL
   * @returns {boolean} 유효한 URL인지 여부
   */
  static isValidUrl(url) {
    if (!url || typeof url !== 'string') {
      return false;
    }

    try {
      new URL(url);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 플랫폼별 URL 패턴을 검증합니다.
   * @param {string} url - 검증할 URL
   * @param {string} platform - 플랫폼 타입
   * @returns {boolean} 해당 플랫폼의 URL인지 여부
   */
  static isValidPlatformUrl(url, platform) {
    if (!this.isValidUrl(url)) {
      return false;
    }

    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    switch (platform.toLowerCase()) {
      case 'coupang':
        return hostname.includes('coupang.com');
      case 'naver':
        return hostname.includes('shopping.naver.com') || hostname.includes('naver.com');
      case '11st':
        return hostname.includes('11st.co.kr');
      default:
        return false;
    }
  }

  /**
   * URL에서 플랫폼을 자동 감지합니다.
   * @param {string} url - 감지할 URL
   * @returns {string|null} 감지된 플랫폼 또는 null
   */
  static detectPlatform(url) {
    if (!this.isValidUrl(url)) {
      return null;
    }

    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    if (hostname.includes('coupang.com')) {
      return 'coupang';
    } else if (hostname.includes('shopping.naver.com') || hostname.includes('naver.com')) {
      return 'naver';
    } else if (hostname.includes('11st.co.kr')) {
      return '11st';
    }

    return null;
  }

  /**
   * URL 정규화 (일관된 형태로 변환)
   * @param {string} url - 정규화할 URL
   * @returns {string} 정규화된 URL
   */
  static normalizeUrl(url) {
    if (!this.isValidUrl(url)) {
      return url;
    }

    try {
      const urlObj = new URL(url);
      // 불필요한 쿼리 파라미터 제거
      urlObj.search = '';
      return urlObj.toString();
    } catch (error) {
      return url;
    }
  }
}

module.exports = UrlParser;

