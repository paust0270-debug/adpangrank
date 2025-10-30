# 데이터베이스 구조

이 폴더는 쿠팡 순위 체킹기의 데이터베이스 파일들을 포함합니다.

## 파일 구조

### `products.json`
주요 데이터베이스 파일로 다음 정보를 포함합니다:

#### `products` 배열
- **id**: 상품 고유 ID
- **keyword**: 검색 키워드
- **productId**: 쿠팡 상품 번호
- **url**: 상품 URL
- **description**: 상품 설명
- **category**: 상품 카테고리
- **addedDate**: 추가된 날짜
- **isActive**: 활성 상태 여부

#### `searchHistory` 배열
검색 기록을 저장합니다:
- **id**: 검색 기록 고유 ID
- **productId**: 상품 번호
- **keyword**: 검색 키워드
- **rank**: 발견된 순위 (null이면 미발견)
- **totalProducts**: 총 확인된 상품 수
- **pagesChecked**: 확인한 페이지 수
- **searchDate**: 검색 날짜
- **status**: 검색 상태 (FOUND, NOT_FOUND, NOT_FOUND_IN_2000, ERROR)

#### `settings` 객체
애플리케이션 설정:
- **maxPages**: 최대 검색 페이지 수
- **maxProducts**: 최대 상품 수집 수
- **delay**: 페이지 로딩 대기 시간 (ms)
- **timeout**: 페이지 로딩 타임아웃 (ms)
- **headless**: 헤드리스 모드 여부
- **autoSave**: 자동 저장 여부
- **lastUpdated**: 마지막 업데이트 시간

## 사용법

```javascript
const fs = require('fs');
const path = require('path');

// 데이터베이스 읽기
const dbPath = path.join(__dirname, 'products.json');
const database = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

// 상품 추가
database.products.push({
  id: Date.now(),
  keyword: '새로운 상품',
  productId: '1234567890',
  url: 'https://www.coupang.com/vp/products/1234567890',
  description: '새로운 상품 설명',
  category: '카테고리',
  addedDate: new Date().toISOString().split('T')[0],
  isActive: true
});

// 검색 기록 추가
database.searchHistory.push({
  id: Date.now(),
  productId: '1234567890',
  keyword: '새로운 상품',
  rank: 1,
  totalProducts: 50,
  pagesChecked: 1,
  searchDate: new Date().toISOString(),
  status: 'FOUND'
});

// 데이터베이스 저장
fs.writeFileSync(dbPath, JSON.stringify(database, null, 2));
```

## 백업

정기적으로 데이터베이스 파일을 백업하는 것을 권장합니다:

```bash
# 백업 생성
cp database/products.json database/backup/products_$(date +%Y%m%d_%H%M%S).json
```

## 주의사항

- JSON 파일이므로 큰따옴표를 사용해야 합니다
- 날짜는 ISO 8601 형식으로 저장됩니다
- 파일 크기가 커지면 SQLite로 마이그레이션을 고려해보세요
