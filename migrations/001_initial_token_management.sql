CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS managed_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  token_ciphertext text NOT NULL,
  region text NOT NULL DEFAULT 'cn',
  proxy_url text,
  status text NOT NULL DEFAULT 'unchecked',
  sort_order integer NOT NULL DEFAULT 0,
  last_checked_at timestamptz,
  last_error text,
  failure_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS managed_tokens_status_order_idx
  ON managed_tokens (status, sort_order, id);

CREATE TABLE IF NOT EXISTS token_rotation_state (
  scope text PRIMARY KEY,
  last_token_id uuid REFERENCES managed_tokens(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active',
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS api_keys_status_idx ON api_keys (status);

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY,
  object text NOT NULL DEFAULT 'task',
  type text NOT NULL,
  status text NOT NULL,
  request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_payload jsonb,
  error jsonb,
  result_url text NOT NULL,
  api_key_id uuid REFERENCES api_keys(id) ON DELETE SET NULL,
  token_id uuid REFERENCES managed_tokens(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS tasks_api_key_created_idx ON tasks (api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tasks_status_created_idx ON tasks (status, created_at DESC);

CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  token_id uuid REFERENCES managed_tokens(id) ON DELETE SET NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS alerts_status_created_idx ON alerts (status, created_at DESC);
