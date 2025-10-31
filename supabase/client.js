const { createClient } = require('@supabase/supabase-js');
const ConfigReader = require('../utils/config-reader');

// 밀리초를 제거한 타임스탬프 생성 함수 (created_at과 동일한 형태)
function getTimestampWithoutMs() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

class SupabaseClient {
  constructor() {
    const config = new ConfigReader('./config.ini');
    const supabaseUrl = config.get('supabase', 'url') || process.env.SUPABASE_URL;
    const supabaseKey = config.get('supabase', 'anon_key') || process.env.SUPABASE_ANON_KEY;
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  // 정수 정규화 함수: 빈 문자열, null, undefined → null, 유효한 숫자만 정수로 변환
  normalizeInt(value) {
    if (value === '' || value === null || value === undefined) return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) || !Number.isFinite(parsed) ? null : parsed;
  }

  // RPC: 순위 갱신 + keywords 삭제 (트랜잭션)
  async updateRankAndDeleteKeyword({ table, slot_sequence, keyword, link_url, current_rank, keyword_id }) {
    // normalizeInt를 사용하여 안전하게 정수 변환
    const slotSeqInt = this.normalizeInt(slot_sequence);
    const keywordIdInt = this.normalizeInt(keyword_id);
    const currentRankInt = this.normalizeInt(current_rank);

    // 필수 필드 검증
    if (slotSeqInt === null) {
      throw new Error(`잘못된 slot_sequence 값: "${slot_sequence}"`);
    }
    if (keywordIdInt === null) {
      throw new Error(`잘못된 keyword_id 값: "${keyword_id}"`);
    }
    // current_rank는 null 허용 (상품을 찾지 못한 경우)

    const { error } = await this.supabase.rpc('update_rank_and_delete_keyword', {
      p_table: table,
      p_slot_sequence: slotSeqInt,
      p_keyword: keyword,
      p_link_url: link_url,
      p_current_rank: currentRankInt,
      p_keyword_id: keywordIdInt
    });
    if (error) {
      console.error('RPC 실패:', error);
      throw error;
    }
  }

  // keywords 테이블에서 대기 작업 조회 후 워커에게 할당 (slot_sequence 우선)
  async getAllPendingTasks(workerId) {
    const { data, error } = await this.supabase
      .from('keywords')
      .select('id, slot_type, keyword, link_url, slot_sequence')
      .is('assigned_to', null)
      .order('slot_sequence', { ascending: true })
      .order('id', { ascending: true })
      .limit(6);

    if (error) {
      console.error('작업 목록 조회 오류:', error);
      throw error;
    }

    if (data && data.length > 0) {
      const ids = data.map((t) => t.id);
      const { error: assignError } = await this.supabase
        .from('keywords')
        .update({ assigned_to: workerId, assigned_at: new Date().toISOString() })
        .in('id', ids);
      if (assignError) {
        console.error('작업 할당 오류:', assignError);
      }
    }

    return data || [];
  }

  // 특정 플랫폼의 작업 조회
  async getTasksByPlatform(platform) {
    const { data, error } = await this.supabase
      .from('keywords')
      .select('*')
      .eq('slot_type', platform)
      .order('id', { ascending: true });

    if (error) {
      console.error(`${platform} 작업 조회 오류:`, error);
      throw error;
    }
    return data || [];
  }

  // slot_status 테이블에 순위 상태 저장/업데이트 + slot_rank_history 히스토리 저장
  async saveRankStatus(keyword, url, slotType, productId, currentRank, startRank, slotSequence = null) {
    // slot_sequence가 제공된 경우 정확히 하나의 레코드만 찾기 (1:1 매칭)
    if (slotSequence !== null && slotSequence !== undefined) {
      const { data: existingRecord } = await this.supabase
        .from('slot_status')
        .select('*')
        .eq('slot_sequence', slotSequence)
        .eq('slot_type', slotType)
        .maybeSingle();

      if (existingRecord) {
        // 기존 레코드 업데이트
        const { data, error } = await this.supabase
          .from('slot_status')
          .update({
            current_rank: currentRank,
            updated_at: getTimestampWithoutMs()
          })
          .eq('slot_sequence', slotSequence)
          .eq('slot_type', slotType)
          .select()
          .single();

        if (error) {
          console.error('순위 업데이트 오류:', error);
          throw error;
        }
        console.log(`✅ 순위 업데이트: ${keyword} - ${currentRank}위 (slot_sequence: ${slotSequence})`);

        // 히스토리는 첫 번째 레코드에만 저장 (중복방지)
        try {
          const { error: historyError } = await this.supabase
            .from('slot_rank_history')
            .insert({
              slot_status_id: existingRecord.id,
              keyword: keyword,
              link_url: url,
              current_rank: currentRank,
              start_rank: existingRecord.start_rank || startRank,
              created_at: new Date().toISOString()
            });

          if (historyError) {
            console.error(`❌ 히스토리 저장 오류 (slot_status_id: ${existingRecord.id}):`, historyError);
            console.error('❌ 오류 상세:', {
              message: historyError.message,
              details: historyError.details,
              hint: historyError.hint,
              code: historyError.code
            });
          } else {
            console.log(`✅ 히스토리 저장 완료 (slot_status_id: ${existingRecord.id}): ${keyword} - ${currentRank}위`);
          }
        } catch (historyException) {
          console.error(`❌ 히스토리 저장 예외 (slot_status_id: ${existingRecord.id}):`, historyException);
        }

        return data;
      }
    }

    // slot_sequence가 없거나 레코드를 찾지 못한 경우, 기존 방식 사용 (keyword + link_url + slot_type로 조회)
    // 하지만 첫 번째 레코드만 사용 (중복방지)
    const { data: existingRecords } = await this.supabase
      .from('slot_status')
      .select('*')
      .eq('keyword', keyword)
      .eq('link_url', url)
      .eq('slot_type', slotType)
      .order('id', { ascending: true })
      .limit(1);

    if (existingRecords && existingRecords.length > 0) {
      const firstRecord = existingRecords[0];
      
      // 첫 번째 레코드만 업데이트
      const { data, error } = await this.supabase
        .from('slot_status')
        .update({
          current_rank: currentRank,
          updated_at: getTimestampWithoutMs()
        })
        .eq('id', firstRecord.id);

      if (error) {
        console.error('순위 업데이트 오류:', error);
        throw error;
      }
      console.log(`✅ 순위 업데이트: ${keyword} - ${currentRank}위 (slot_status_id: ${firstRecord.id})`);

      // 히스토리는 첫 번째 레코드에만 저장 (중복방지)
      try {
        const { error: historyError } = await this.supabase
          .from('slot_rank_history')
          .insert({
            slot_status_id: firstRecord.id,
            keyword: keyword,
            link_url: url,
            current_rank: currentRank,
            start_rank: firstRecord.start_rank || startRank,
            created_at: new Date().toISOString()
          });

        if (historyError) {
          console.error(`❌ 히스토리 저장 오류 (slot_status_id: ${firstRecord.id}):`, historyError);
          console.error('❌ 오류 상세:', {
            message: historyError.message,
            details: historyError.details,
            hint: historyError.hint,
            code: historyError.code
          });
        } else {
          console.log(`✅ 히스토리 저장 완료 (slot_status_id: ${firstRecord.id}): ${keyword} - ${currentRank}위`);
        }
      } catch (historyException) {
        console.error(`❌ 히스토리 저장 예외 (slot_status_id: ${firstRecord.id}):`, historyException);
      }

      return data;
    } else {
      // 새로운 기록 생성 (start_rank는 처음만 기록)
      const insertData = {
        keyword: keyword,
        link_url: url,
        slot_type: slotType,
        // 필수 필드들만 추가 (실제 테이블에 존재하는 필드만)
        customer_id: 'rank-checker-system', // 순위 체킹 시스템용 고정 ID
        customer_name: '순위체킹시스템', // 고정 고객명
        slot_count: 1, // 기본값
        current_rank: currentRank,
        start_rank: startRank,
        created_at: new Date().toISOString(),
        updated_at: getTimestampWithoutMs()
      };

      // slot_sequence가 제공된 경우 포함
      if (slotSequence !== null && slotSequence !== undefined) {
        insertData.slot_sequence = slotSequence;
      }

      const { data, error } = await this.supabase
        .from('slot_status')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('순위 저장 오류:', error);
        throw error;
      }
      console.log(`✅ 순위 신규 생성: ${keyword} - ${currentRank}위 (시작순위: ${startRank}위)`);

      // slot_rank_history 테이블에 첫 히스토리 저장
      try {
        const { error: historyError } = await this.supabase
          .from('slot_rank_history')
          .insert({
            slot_status_id: data.id,
            keyword: keyword,
            link_url: url,
            current_rank: currentRank,
            start_rank: startRank,
            created_at: new Date().toISOString()
          });

        if (historyError) {
          console.error('❌ 첫 히스토리 저장 오류:', historyError);
          console.error('❌ 오류 상세:', {
            message: historyError.message,
            details: historyError.details,
            hint: historyError.hint,
            code: historyError.code
          });
        } else {
          console.log(`✅ 첫 히스토리 저장 완료: ${keyword} - ${currentRank}위 (시작순위: ${startRank}위)`);
        }
      } catch (historyException) {
        console.error('❌ 첫 히스토리 저장 예외:', historyException);
      }

      return data;
    }
  }

  // 처리 완료된 키워드 삭제
  async deleteProcessedKeyword(keywordId) {
    const { error } = await this.supabase
      .from('keywords')
      .delete()
      .eq('id', keywordId);

    if (error) {
      console.error('키워드 삭제 오류:', error);
      throw error;
    }
    console.log(`🗑️ 키워드 ID ${keywordId} 삭제 완료`);
  }

  // 순위 이력 조회 (디버깅용)
  async getRankHistory(keyword, url, slotType) {
    const { data, error } = await this.supabase
      .from('slot_status')
      .select('*')
      .eq('keyword', keyword)
      .eq('link_url', url)
      .eq('slot_type', slotType)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('순위 이력 조회 오류:', error);
      throw error;
    }
    return data || [];
  }

  // 플랫폼별 통계 조회
  async getPlatformStats(slotType) {
    const { data, error } = await this.supabase
      .from('slot_status')
      .select('current_rank, start_rank, created_at')
      .eq('slot_type', slotType);

    if (error) {
      console.error(`${slotType} 통계 조회 오류:`, error);
      throw error;
    }

    if (!data || data.length === 0) {
      return {
        totalChecks: 0,
        avgRank: 0,
        bestRank: 0,
        worstRank: 0
      };
    }

    const ranks = data.map(item => item.current_rank).filter(rank => rank !== null);
    const startRanks = data.map(item => item.start_rank).filter(rank => rank !== null);

    return {
      totalChecks: data.length,
      avgRank: ranks.length > 0 ? Math.round(ranks.reduce((a, b) => a + b, 0) / ranks.length) : 0,
      bestRank: ranks.length > 0 ? Math.min(...ranks) : 0,
      worstRank: ranks.length > 0 ? Math.max(...ranks) : 0,
      avgStartRank: startRanks.length > 0 ? Math.round(startRanks.reduce((a, b) => a + b, 0) / startRanks.length) : 0
    };
  }
}

module.exports = SupabaseClient;


