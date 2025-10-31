-- Convert slot_rank_history table's current_rank and start_rank from text to integer
-- 기존 '숫자 [0]' 형식의 텍스트에서 숫자만 추출하여 integer로 변환

-- 1. current_rank 컬럼을 integer 타입으로 변경
ALTER TABLE public.slot_rank_history
ALTER COLUMN current_rank TYPE integer USING
  CASE
    WHEN current_rank IS NULL THEN NULL
    WHEN current_rank = '' THEN NULL
    WHEN current_rank ~ '^[0-9]+' THEN (regexp_replace(current_rank, '^([0-9]+).*', '\1'))::integer
    ELSE NULL
  END;

-- 2. start_rank 컬럼을 integer 타입으로 변경
ALTER TABLE public.slot_rank_history
ALTER COLUMN start_rank TYPE integer USING
  CASE
    WHEN start_rank IS NULL THEN NULL
    WHEN start_rank = '' THEN NULL
    WHEN start_rank ~ '^[0-9]+' THEN (regexp_replace(start_rank, '^([0-9]+).*', '\1'))::integer
    ELSE NULL
  END;

-- 변환 완료 확인 쿼리 (선택사항)
-- SELECT 
--   column_name,
--   data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
--   AND table_name = 'slot_rank_history'
--   AND column_name IN ('current_rank', 'start_rank');

