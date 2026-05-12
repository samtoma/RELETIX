CREATE TABLE IF NOT EXISTS responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  q1_overall_feeling INTEGER,
  q2_skipped_frequency TEXT,
  q3_reasons TEXT,
  q4_product_rating INTEGER,
  q5_one_thing_to_change TEXT,
  q6_vision_clarity INTEGER,
  q7_belief_in_direction TEXT,
  q8_morale INTEGER,
  q9_what_would_bring_back TEXT,
  q10_holding_back TEXT,
  q11_contact TEXT
);
CREATE INDEX IF NOT EXISTS idx_responses_submitted_at ON responses(submitted_at);
