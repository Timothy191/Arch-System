-- ============================================
-- User Feedback Collection
-- ============================================

CREATE TABLE IF NOT EXISTS user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES employees(id),
  session_id TEXT,
  page_url TEXT,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('bug', 'feature', 'improvement', 'compliment', 'other')),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  metadata JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'addressed', 'dismissed')),
  assigned_to UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quick feedback for thumbs up/down
CREATE TABLE IF NOT EXISTS quick_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT,
  page_url TEXT,
  reaction TEXT CHECK (reaction IN ('thumbs_up', 'thumbs_down', 'confused')),
  context TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_feedback ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "authenticated_can_create_feedback"
  ON user_feedback FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "service_can_manage_feedback"
  ON user_feedback FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "any_user_can_quick_feedback"
  ON quick_feedback FOR INSERT TO anon USING (true) WITH CHECK (true);

CREATE POLICY "service_can_manage_quick_feedback"
  ON quick_feedback FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_user_feedback_status ON user_feedback(status);
CREATE INDEX idx_user_feedback_type ON user_feedback(feedback_type);
CREATE INDEX idx_user_feedback_created ON user_feedback(created_at DESC);
CREATE INDEX idx_quick_feedback_page ON quick_feedback(page_url, created_at DESC);

-- Function to submit feedback
CREATE OR REPLACE FUNCTION submit_user_feedback(
  p_feedback_type TEXT,
  p_page_url TEXT,
  p_rating INTEGER DEFAULT NULL,
  p_comment TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO user_feedback (user_id, page_url, feedback_type, rating, comment)
  VALUES (p_user_id, p_page_url, p_feedback_type, p_rating, p_comment)
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Function for quick feedback
CREATE OR REPLACE FUNCTION submit_quick_feedback(
  p_reaction TEXT,
  p_page_url TEXT,
  p_context TEXT DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO quick_feedback (session_id, page_url, reaction, context)
  VALUES (p_session_id, p_page_url, p_reaction, p_context)
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION submit_user_feedback TO authenticated;
GRANT EXECUTE ON FUNCTION submit_quick_feedback TO anon;