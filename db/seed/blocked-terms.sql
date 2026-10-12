-- Starter word list (EXECUTIONPLAN §12.4 step 10). English profanity is handled by `obscenity`;
-- this table is for Japanese terms and site-specific patterns. A hit HOLDS the note (hidden until approved)
-- unless action = 'reject'. Keep the real list in the database (/keeper/settings), not in public git history.
INSERT INTO blocked_terms (term, kind, action, note) VALUES
  ('しね',       'substring', 'hold',   'starter: insult'),
  ('死ね',       'substring', 'hold',   'starter: insult'),
  ('殺す',       'substring', 'hold',   'starter: threat'),
  ('きもい',     'substring', 'hold',   'starter: insult'),
  ('中の人',     'substring', 'hold',   'starter: real-life speculation'),
  ('前世',       'substring', 'hold',   'starter: real-life speculation'),
  ('炎上',       'substring', 'hold',   'starter: drama'),
  ('line.me',    'substring', 'reject', 'starter: contact handle'),
  ('onlyfans',   'substring', 'reject', 'starter: spam')
ON CONFLICT (term, kind) DO NOTHING;
