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

  // RPC: 순위 갱신 + keywords 삭제 (트랜잭션)
  async updateRankAndDeleteKeyword({ table, slot_sequence, keyword, link_url, current_rank, keyword_id }) {
    // 입력값 정제: 빈 문자열("")을 정수로 변환, 숫자가 아니면 에러 처리
    const normalizedSlotSeq = typeof slot_sequence === 'string' ? slot_sequence.trim() : slot_sequence;
    const normalizedKeywordId = typeof keyword_id === 'string' ? keyword_id.trim() : keyword_id;
    const normalizedCurrentRank = typeof current_rank === 'string' ? current_rank.trim() : current_rank;

    const slotSeqInt = normalizedSlotSeq === '' || normalizedSlotSeq === null || normalizedSlotSeq === undefined
      ? NaN
      : Number.parseInt(normalizedSlotSeq, 10);
    const keywordIdInt = normalizedKeywordId === '' || normalizedKeywordId === null || normalizedKeywordId === undefined
      ? NaN
      : Number.parseInt(normalizedKeywordId, 10);
    const currentRankInt = normalizedCurrentRank === '' || normalizedCurrentRank === null || normalizedCurrentRank === undefined
      ? null
      : Number.parseInt(normalizedCurrentRank, 10);

    if (!Number.isFinite(slotSeqInt)) {
      throw new Error(`잘못된 slot_sequence 값: "${slot_sequence}"`);
    }
    if (!Number.isFinite(keywordIdInt)) {
      throw new Error(`잘못된 keyword_id 값: "${keyword_id}"`);
    }

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
  async saveRankStatus(keyword, url, slotType, productId, currentRank, startRank) {
    // 기존 기록이 있는지 확인 (keyword + link_url + slot_type로 조회)
    // .single() 제거 - 동일한 keyword/URL을 가진 모든 레코드 반환
    const { data: existingRecords } = await this.supabase
      .from('slot_status')
      .select('*')
      .eq('keyword', keyword)
      .eq('link_url', url)
      .eq('slot_type', slotType);

    if (existingRecords && existingRecords.length > 0) {
      // 모든 매칭 레코드를 한 번에 업데이트
      const { data, error } = await this.supabase
        .from('slot_status')
        .update({
          current_rank: currentRank,
          updated_at: getTimestampWithoutMs()
        })
        .eq('keyword', keyword)
        .eq('link_url', url)
        .eq('slot_type', slotType);

      if (error) {
        console.error('순위 업데이트 오류:', error);
        throw error;
      }
      console.log(`✅ 순위 업데이트: ${keyword} - ${currentRank}위 (${existingRecords.length}개 레코드)`);

      // 각 레코드에 대해 히스토리 저장
      for (const record of existingRecords) {
        try {
          const { error: historyError } = await this.supabase
            .from('slot_rank_history')
            .insert({
              slot_status_id: record.id,
              keyword: keyword,
              link_url: url,
              current_rank: currentRank,
              start_rank: record.start_rank,
              created_at: new Date().toISOString()
            });

          if (historyError) {
            console.error(`❌ 히스토리 저장 오류 (slot_status_id: ${record.id}):`, historyError);
            console.error('❌ 오류 상세:', {
              message: historyError.message,
              details: historyError.details,
              hint: historyError.hint,
              code: historyError.code
            });
          } else {
            console.log(`✅ 히스토리 저장 완료 (slot_status_id: ${record.id}): ${keyword} - ${currentRank}위`);
          }
        } catch (historyException) {
          console.error(`❌ 히스토리 저장 예외 (slot_status_id: ${record.id}):`, historyException);
        }
      }

      return data;
    } else {
      // 새로운 기록 생성 (start_rank는 처음만 기록)
      const { data, error } = await this.supabase
        .from('slot_status')
        .insert({
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
        })
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
  async getRankHistory(keyword, url, slotType, productId) {
    const { data, error } = await this.supabase
      .from('slot_status')
      .select('*')
      .eq('keyword', keyword)
      .eq('url', url)
      .eq('slot_type', slotType)
      .eq('product_id', productId)
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

