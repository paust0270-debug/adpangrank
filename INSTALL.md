# 설치 가이드

Supabase 연동 쿠팡 순위 체킹기 v2.0 설치 및 설정 가이드입니다.

## 📋 시스템 요구사항

### 최소 요구사항
- **운영체제**: Windows 10 이상
- **메모리**: 4GB RAM 이상
- **디스크**: 1GB 여유 공간
- **인터넷**: 안정적인 인터넷 연결

### 권장 요구사항
- **운영체제**: Windows 11
- **메모리**: 8GB RAM 이상
- **디스크**: 2GB 여유 공간
- **프로세서**: Intel i5 또는 AMD Ryzen 5 이상

## 🚀 설치 방법

### 방법 1: GitHub에서 직접 다운로드 (권장)

1. **저장소 클론**
   ```bash
   git clone https://github.com/paust0270-debug/coupang-rank-checker.git
   cd coupang-rank-checker
   ```

2. **Node.js 설치 확인**
   - [Node.js 공식 사이트](https://nodejs.org/)에서 LTS 버전 다운로드
   - 설치 후 터미널에서 확인:
     ```bash
     node --version  # v16.0.0 이상이어야 함
     npm --version   # v8.0.0 이상이어야 함
     ```

3. **의존성 설치**
   ```bash
   npm install
   ```

4. **Playwright 브라우저 설치**
   ```bash
   npx playwright install chromium
   ```

5. **실행**
   ```bash
   npm start
   ```

### 방법 2: 배치 파일 실행

1. 프로젝트 폴더에서 다음 파일 중 하나를 더블클릭:
   - `쿠팡_순위_체킹기_24시간_실행.bat` (24시간 연속 실행 버전 - 신규)
   - `쿠팡_순위_체킹기_GUI_실행.bat` (GUI 버전)
   - `쿠팡_순위_체킹기_실행.bat` (콘솔 버전)

### 방법 3: 빌드된 실행 파일 사용

1. `dist/win-unpacked/` 폴더에서 `쿠팡 순위 체킹기.exe` 실행
2. 또는 `dist/` 폴더의 설치 파일 사용

## 🔧 문제 해결

### 일반적인 문제들

#### 1. Node.js가 설치되지 않은 경우
```
Error: 'node' is not recognized as an internal or external command
```

**해결방법:**
- [Node.js 공식 사이트](https://nodejs.org/)에서 다운로드 및 설치
- 설치 후 컴퓨터 재시작
- 터미널에서 `node --version` 확인

#### 2. npm install 실패
```
npm ERR! code ENOENT
npm ERR! syscall open
```

**해결방법:**
```bash
# npm 캐시 정리
npm cache clean --force

# node_modules 삭제 후 재설치
rmdir /s node_modules
npm install
```

#### 3. Playwright 브라우저 설치 실패
```
Error: Browser download failed
```

**해결방법:**
```bash
# 관리자 권한으로 실행
npx playwright install chromium --force

# 또는 수동 다운로드
npx playwright install-deps
```

#### 4. 방화벽 차단
```
Error: net::ERR_INTERNET_DISCONNECTED
```

**해결방법:**
- Windows 방화벽에서 Node.js 허용
- 바이러스 백신 소프트웨어에서 예외 추가
- 프록시 설정 확인

#### 5. 메모리 부족
```
Error: JavaScript heap out of memory
```

**해결방법:**
```bash
# 메모리 제한 증가
set NODE_OPTIONS=--max-old-space-size=4096
npm start
```

## 🎯 첫 실행 설정

### 1. Supabase 설정 (24시간 연속 실행 버전)

#### Supabase 프로젝트 생성
1. [Supabase 공식 사이트](https://supabase.com/)에서 계정 생성
2. 새 프로젝트 생성
3. 프로젝트 URL과 API Key 복사

#### 데이터베이스 테이블 생성
```sql
-- keywords 테이블 (작업 목록)
CREATE TABLE keywords (
  id SERIAL PRIMARY KEY,
  keyword VARCHAR(255) NOT NULL,
  url VARCHAR(500) NOT NULL,
  slot_type VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- slot_status 테이블 (순위 결과)
CREATE TABLE slot_status (
  id SERIAL PRIMARY KEY,
  keyword VARCHAR(255) NOT NULL,
  url VARCHAR(500) NOT NULL,
  slot_type VARCHAR(50) NOT NULL,
  product_id VARCHAR(50) NOT NULL,
  current_rank INTEGER,
  start_rank INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### 환경 변수 설정
`.env` 파일을 생성하고 다음 내용을 추가:
```bash
# Supabase Configuration
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Target Product ID (for fallback)
TARGET_PRODUCT_ID=8617045901

# Application Settings
NODE_ENV=production
```

### 2. 기존 버전 설정
- `database/products.json` 파일에서 검색할 상품 정보 수정
- 상품번호와 키워드 확인

### 3. 테스트 실행
- 24시간 연속 실행 버전으로 먼저 테스트
- GUI 버전으로 테스트
- 콘솔 로그 확인
- Supabase DB 결과 확인

## 📊 성능 최적화

### 시스템 최적화
1. **불필요한 프로그램 종료**
2. **디스크 정리 및 조각 모음**
3. **RAM 정리**
4. **인터넷 연결 안정성 확인**

### 애플리케이션 최적화
1. **headless 모드 사용** (고급 사용자)
2. **delay 값 조정** (네트워크 속도에 따라)
3. **maxPages 값 조정** (필요한 범위만)

## 🔄 업데이트

### 자동 업데이트 확인
```bash
git pull origin main
npm install
```

### 수동 업데이트
1. GitHub에서 최신 릴리스 다운로드
2. 기존 파일 덮어쓰기
3. `npm install` 실행

## 📞 지원

문제가 계속 발생하는 경우:
1. [GitHub Issues](https://github.com/paust0270-debug/coupang-rank-checker/issues)에 문제 보고
2. 로그 파일 첨부
3. 시스템 정보 제공

## ✅ 설치 완료 확인

설치가 완료되면 다음을 확인하세요:

### 기본 확인사항
- [ ] Node.js 버전 확인 (`node --version`)
- [ ] npm 버전 확인 (`npm --version`)
- [ ] Playwright 브라우저 설치 확인
- [ ] GUI 애플리케이션 실행
- [ ] 테스트 검색 실행
- [ ] 결과 데이터베이스 확인

### 24시간 연속 실행 버전 확인사항
- [ ] Supabase 계정 및 프로젝트 생성
- [ ] 데이터베이스 테이블 생성 (keywords, slot_status)
- [ ] .env 파일 설정 (SUPABASE_URL, SUPABASE_ANON_KEY)
- [ ] 24시간 연속 실행 버전 테스트
- [ ] Supabase DB에 데이터 저장 확인
- [ ] 작업 목록 자동 처리 확인

모든 항목이 체크되면 설치가 완료된 것입니다! 🎉
