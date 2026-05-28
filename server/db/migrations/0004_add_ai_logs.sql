CREATE TABLE IF NOT EXISTS ai_logs (
    id TEXT PRIMARY KEY,
    meeting_id TEXT,
    provider TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    raw_output TEXT NOT NULL,
    validation_passed INTEGER NOT NULL,
    validation_errors TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ai_logs_provider_idx ON ai_logs(provider);
CREATE INDEX IF NOT EXISTS ai_logs_prompt_version_idx ON ai_logs(prompt_version);
CREATE INDEX IF NOT EXISTS ai_logs_created_at_idx ON ai_logs(created_at);
