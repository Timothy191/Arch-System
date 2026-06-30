-- ============================================
-- Drop AI / vector memory schema (monorepo AI separation)
-- ============================================

DROP FUNCTION IF EXISTS public.record_vector_search_performance CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_vector_search_cache CASCADE;
DROP FUNCTION IF EXISTS public.cache_vector_search_results CASCADE;
DROP FUNCTION IF EXISTS public.get_cached_vector_search CASCADE;
DROP FUNCTION IF EXISTS public.generate_vector_search_cache_key CASCADE;
DROP FUNCTION IF EXISTS public.search_memories_semantic CASCADE;
DROP FUNCTION IF EXISTS public.search_memories_hybrid CASCADE;
DROP FUNCTION IF EXISTS public.get_conversation_history CASCADE;

DROP TABLE IF EXISTS vector_search_performance CASCADE;
DROP TABLE IF EXISTS vector_search_cache CASCADE;
DROP TABLE IF EXISTS embedding_cache CASCADE;
DROP TABLE IF EXISTS memory_embeddings CASCADE;
DROP TABLE IF EXISTS ai_usage_logs CASCADE;
DROP TABLE IF EXISTS sync_watermarks CASCADE;
