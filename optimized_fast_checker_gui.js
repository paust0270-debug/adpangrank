const { chromium } = require('playwright');
const ConfigReader = require('./utils/config-reader');

// ===== API 연동 설정 =====
const cfg = new ConfigReader('./config.ini');
const API_ENABLED = (cfg.get('api', 'enabled') || 'false') === 'true';
const API_BASE_URL = cfg.get('api', 'base_url') || 'http://localhost:3000';

// ===== API 함수들 =====
async function fetchKeywordsFromAPI() {
  if (!API_ENABLED) {
    return [];
  }
  try {
    console.log('🔄 API에서 키워드 목록 가져오는 중...');
    const response = await fetch(`${API_BASE_URL}/api/keywords`);
    const result = await response.json();
    
    if (result.success && result.data && result.data.length > 0) {
      console.log(`✅ ${result.data.length}개의 키워드를 가져왔습니다.`);
      return result.data.map(item => ({
        keyword: item.keyword,
        productId: extractProductId(item.link_url),
        url: item.link_url,
        slot_type: item.slot_type || 'coupang',
        slot_sequence: item.slot_sequence
      }));
    }
    console.log('⚠️ API에서 키워드를 가져오지 못했습니다.');
    return [];
  } catch (error) {
    console.error('❌ Keywords API 호출 실패:', error.message);
    return [];
  }
}

function extractProductId(url) {
  const match = url.match(/products\/(\d+)/);
  return match ? match[1] : null;
}

async function sendRankToAPI(keyword, url, slotType, rank, slotSequence) {
  if (!API_ENABLED) return true; // API 사용 안함 시 성공 처리
  try {
    const response = await fetch(`${API_BASE_URL}/api/rank-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: keyword,
        link_url: url,
        slot_type: slotType,
        current_rank: rank,
        slot_sequence: slotSequence
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ 순위 업데이트 성공: ${keyword} (슬롯 ${slotSequence}) - ${rank}위`);
      return true;
    } else {
      console.error(`❌ 순위 업데이트 실패: ${result.error}`);
      return false;
    }
  } catch (error) {
    console.error('❌ API 호출 실패:', error.message);
    return false;
  }
}

// GUI용 수정된 최종 완성체
(async () => {
  console.log('🎯 쿠팡 순위 체킹 시작 - API 연동 버전');
  
  // API에서 키워드 목록 가져오기
  let productTests = await fetchKeywordsFromAPI();
  
  // API 실패 시 기본 테스트 데이터 사용
  if (productTests.length === 0) {
    console.log('⚠️ 기본 테스트 데이터 사용...');
    productTests = [
      {
        keyword: '이동식 트롤리',
        productId: '8473798698',
        url: 'https://www.coupang.com/vp/products/8473798698?itemId=24519876305',
        slot_type: 'coupang'
      },
      {
        keyword: '자전거 자물쇠',
        productId: '7446595001',
        url: 'https://www.coupang.com/vp/products/7446595001?itemId=24876606891',
        slot_type: 'coupang'
      },
      {
        keyword: '자전거 라이트',
        productId: '8188782600',
        url: 'https://www.coupang.com/vp/products/8188782600?itemId=23425236059',
        slot_type: 'coupang'
      }
    ];
  }

  const browser = await chromium.launch({
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

  const context = await browser.newContext({
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
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  const page = await context.newPage();

  // 빠른 로딩을 위한 네트워크 최적화
  await page.route('**/*', (route) => {
    const resourceType = route.request().resourceType();
    const url = route.request().url();
    
    // 불필요한 리소스만 선별적으로 차단 (페이지 구조 보존)
    if (resourceType === 'image' && 
        (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || url.includes('.webp'))) {
      route.abort(); // 대용량 이미지만 차단
    } else if (resourceType === 'font' || 
               url.includes('analytics') ||
               url.includes('tracking') ||
               url.includes('ads')) {
      route.abort(); // 추적/광고 관련만 차단
    } else {
      route.continue();
    }
  });

  const results = [];
  let totalProductsFound = 0;
  let totalPagesChecked = 0;
  let foundProductsCount = 0;

  try {
    for (let i = 0; i < productTests.length; i++) {
      const test = productTests[i];
      console.log(`\n🔍 ${i + 1}/3 고속 검색 "${test.keyword}" - 상품번호 ${test.productId}`);
      
      let foundRank = null;
      let allProducts = new Set();
      let pageNumber = 1;
      const maxPages = 20; // 20페이지까지 확장
      const FAST_DELAY = 600; // 빠른 대기 시간

      try {
        while (pageNumber <= maxPages && allProducts.size < 2000) { // 2000개까지 확장
          const searchUrl = pageNumber === 1 ? 
            `https://www.coupang.com/search?q=${encodeURIComponent(test.keyword)}` :
            `https://www.coupang.com/search?q=${encodeURIComponent(test.keyword)}&page=${pageNumber}`;
          
          console.log(`⚡ "${test.keyword}" 페이지 ${pageNumber}/${maxPages} 탐색...`);
          
          const startTime = Date.now();
          
          try {
            await page.goto(searchUrl, {
              waitUntil: 'domcontentloaded',
              timeout: 6000 // 빠른 타임아웃
            });

            await page.waitForTimeout(FAST_DELAY); // 짧은 대기

            const productsData = await page.evaluate((targetProductId) => {
              const products = [];
              
              // 빠르고 광범위한 셀렉터 사용
              document.querySelectorAll('a[href*="/products/"], a[href*="/vp/products/"], [data-product-id]').forEach((element, index) => {
                let productId = null;
                let href = null;
                
                if (element.tagName === 'A') {
                  href = element.href || element.getAttribute('href');
                  if (href && href.includes('/products/')) {
                    const match = href.match(/\/(?:vp\/)?products\/(\d+)/);
                    if (match) productId = match[1];
                  }
                } else {
                  productId = element.getAttribute('data-product-id') || 
                             element.getAttribute('data-vendor-item-id') ||
                             element.getAttribute('data-item-id');
                  const linkEl = element.querySelector('a[href*="/products/"]');
                  if (linkEl) href = linkEl.href || linkEl.getAttribute('href');
                }
                
                if (productId) {
                  products.push({
                    productId: String(productId),
                    href: href || '',
                    rank: products.length + 1
                  });
                }
              });
              
              // 타겟 상품 찾기
              const targetProduct = products.find(product => product.productId === targetProductId);
              
              return {
                products: products,
                targetFound: !!targetProduct,
                targetRankInPage: targetProduct ? products.indexOf(targetProduct) + 1 : null,
                totalFound: products.length,
                duplicates: products.length - [...new Set(products.map(p => p.productId))].length
              };
            }, test.productId);

            const loadTime = Date.now() - startTime;
            
            // 새로운 상품 추출 (중복 제거)
            const previousCount = allProducts.size;
            productsData.products.forEach(product => {
              allProducts.add(product.productId);
            });
            const newProductsCount = allProducts.size - previousCount;
            
            console.log(`📦 페이지 ${pageNumber}: ${productsData.totalFound}개 발견 (${newProductsCount}개 새로운 상품, 로드시간: ${loadTime}ms)`);
            
            // 상세 정보 출력 (처음 3페이지만)
            if (pageNumber <= 3) {
              console.log(`📄 페이지 ${pageNumber} 상품 샘플:`, productsData.products.slice(0, 5).map(p => p.productId).join(', '));
            }

            // 타겟 상품 발견 체크
            if (productsData.targetFound && !foundRank) {
              const targetInAll = Array.from(allProducts).indexOf(test.productId);
              foundRank = targetInAll + 1;
              console.log(`🎯 "${test.keyword}" 페이지 ${pageNumber}에서 타겟 상품 발견! 전체 순위: ${foundRank}`);
              
              if (pageNumber < 5) {
                 console.log(`🔍 상세 위치: 페이지 ${pageNumber}의 ${productsData.targetRankInPage}번째`);
              }
            }

            // 빠른 진행 상황 출력
            if (allProducts.size > 0 && allProducts.size % 50 === 0) {
              console.log(`⏳ 진행상황: ${allProducts.size}개 상품 확인 완료`);
            }

            // 조건 충족 시 중단
            if (foundRank) {
              console.log(`✅ 타겟 상품 발견으로 검색 완료!`);
              break;
            }

            if (allProducts.size >= 2000) {
              console.log(`🏁 목표 2000개 상품 도달로 검색 완료!`);
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

          } catch (pageError) {
            console.log(`🔴 페이지 ${pageNumber} 로드 실패: ${pageError.message}`);
            if (pageNumber > 3) { // 처음 3페이지 실패 시에만 계속
              break;
            }
          }

          pageNumber++;
        }

        // 최종 순위 재확인
        if (!foundRank && allProducts.has(test.productId)) {
          const allProductsSorted = Array.from(allProducts);
          foundRank = allProductsSorted.indexOf(test.productId) + 1;
        }

        const result = {
          keyword: test.keyword,
          productId: test.productId,
          url: test.url,
          rank: foundRank,
          totalProductsFound: allProducts.size,
          pagesChecked: pageNumber - 1,
          status: foundRank ? 'FOUND' : (allProducts.size >= 2000 ? 'NOT_FOUND_IN_2000' : 'NOT_FOUND')
        };
        
        results.push(result);
        totalProductsFound += allProducts.size;
        totalPagesChecked += (pageNumber - 1);
        if (foundRank) foundProductsCount++;

        if (foundRank) {
          console.log(`🎉"${test.keyword}" 고속 검색 완료: ${foundRank}위`);
          console.log(`상품번호 ${test.productId}은 ${test.keyword} 검색결과에서 ${foundRank}위입니다.`);
          
          // API로 순위 결과 전송
          await sendRankToAPI(test.keyword, test.url, test.slot_type, foundRank, test.slot_sequence);
        } else {
          console.log(`❌"${test.keyword}" 결과: 상위 ${allProducts.size}개 안에 해당 상품을 찾지 못함`);
          console.log(`상품번호 ${test.productId}은 상위 ${allProducts.size}위 안에 없습니다.`);
        }
        
        console.log(`📊 고속 검색 통계: ${pageNumber-1}페이지 확인, ${allProducts.size}개 상품 수집`);

      } catch (searchError) {
        console.error(`🔴"${test.keyword}" 검색 오류: ${searchError.message}`);
        results.push({
          keyword: test.keyword,
          productId: test.productId,
          url: test.url,
          rank: null,
          totalProductsFound: 0,
          pagesChecked: pageNumber - 1,
          status: 'ERROR'
        });
      }

      // 검색 간 짧은 대기
      if (i < productTests.length - 1) {
        console.log(`⏰ 다음 검색을 위해 1초 대기...`);
        await page.waitForTimeout(1000);
      }
    }

  } catch (error) {
    console.error(`💥 전체 실행 오류 발생: ${error.message}`);
  } finally {
    await browser.close();
    
    console.log('\n=== 🎯 고속 검색결과 요약 ===');
    
    results.forEach((result, index) => {
      console.log(`\n${index + 1}. 키워드: "${result.keyword}"`);
      console.log(`   상품번호: ${result.productId}`);
      console.log(`   상태: ${result.status}`);
      console.log(`   확인한 페이지: ${result.pagesChecked}페이지`);
      
      if (result.status === 'FOUND') {
        console.log(`   🎉 결과: 상품번호 ${result.productId}은 "${result.keyword}" 검색결과에서 ${result.rank}위입니다.`);
      } else if (result.status.startsWith('NOT_FOUND')) {
        console.log(`   ❌ 결과: 상품번호 ${result.productId}은 상위 ${result.totalProductsFound}위 안에 없습니다.`);
      } else {
        console.log(`   🔴 결과: 검색 중 오류 발생`);
      }
      
      console.log(`   📊 총 확인된 상품 수: ${result.totalProductsFound}개`);
    });

    console.log(`\n📈 전체 통계:`);
    console.log(`   총 상품 수집: ${totalProductsFound}개`);
    console.log(`   총 페이지 확인: ${totalPagesChecked}페이지`);
    console.log(`   발견된 상품: ${foundProductsCount}개`);

    console.log('\n🏁 모든 고속 검색 완료!');
  }
})();
