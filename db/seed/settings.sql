-- Message Board settings (EXECUTIONPLAN §11.2). Idempotent: existing values are kept.
-- Launch period (first 14 days, §14): raid_posts_5m = 20; set back to 40 on 2026-12-15.
INSERT INTO settings (key, value) VALUES
  ('report_threshold',   '3'),
  ('rereport_threshold', '6'),
  ('posting_paused',     'false'),
  ('newcomer_hold',      'false'),
  ('rate_post_10m',      '3'),
  ('rate_post_day',      '10'),
  ('rate_report_hour',   '20'),
  ('raid_posts_5m',      '40'),
  ('max_len',            '300'),
  ('max_lines',          '6'),
  ('board_cache_s',      '10')
ON CONFLICT (key) DO NOTHING;
