# Init migration changes (Nov 16, 2026)

Most of the content here was created with great plans, yet there is a dissonance between what is already _created_ and what is merely envisioned.

Because so much of this is subject to change as development goes on, I find it easier to focus on what we have _now_ and incrementally work up to a goal. Once the initial migration falls into place, it will be effectively locked so we can begin adding new migrations. More information on this soon.

Thus, the following were removed from initial migration to make development easier in the future:

```sql
CREATE TABLE redemption_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(32) NOT NULL UNIQUE,
  label VARCHAR(100) NOT NULL,
  max_redemptions BIGINT NULL,
  max_redemptions_per_actor INT NOT NULL DEFAULT 1,
  starts_at_ms BIGINT NULL,
  expires_at_ms BIGINT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at_ms BIGINT NOT NULL DEFAULT get_unix_ms ()
);

CREATE TABLE redemption_campaign_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES redemption_campaigns (id) ON DELETE RESTRICT,
  reward_type VARCHAR(20) NOT NULL,
  amount BIGINT NULL,
  shop_item_id UUID NULL,
  quantity INT NULL DEFAULT 1
);

CREATE TABLE redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES redemption_campaigns (id) ON DELETE RESTRICT,
  actor_id UUID NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
  redeemed_at_ms BIGINT NOT NULL DEFAULT get_unix_ms (),
  UNIQUE (campaign_id, actor_id)
);

CREATE TABLE punishment_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appellant_actor_id UUID NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
  infraction_ref_id UUID NULL REFERENCES punishments (id) ON DELETE SET NULL,
  infraction_category punishment NOT NULL,
  status punishment_appeal_status NOT NULL DEFAULT 'open',
  closed_by_actor_id UUID NULL REFERENCES actors (id) ON DELETE RESTRICT,
  created_at_ms BIGINT NOT NULL DEFAULT get_unix_ms (),
  closed_at_ms BIGINT NULL,
  CONSTRAINT chk_punishment_appeals_closed_consistent CHECK (
    (
      closed_at_ms IS NULL
      AND closed_by_actor_id IS NULL
    )
    OR (
      closed_at_ms IS NOT NULL
      AND closed_by_actor_id IS NOT NULL
    )
  )
);

CREATE INDEX idx_punishment_appeals_appellant_created ON punishment_appeals (appellant_actor_id, created_at_ms DESC);

CREATE INDEX idx_punishment_appeals_status_created ON punishment_appeals (status, created_at_ms DESC);

CREATE INDEX idx_punishment_appeals_infraction_ref ON punishment_appeals (infraction_ref_id)
WHERE
  infraction_ref_id IS NOT NULL;

CREATE INDEX idx_punishment_appeals_category_created ON punishment_appeals (infraction_category, created_at_ms DESC);

CREATE INDEX idx_punishment_appeals_closed_by_actor ON punishment_appeals (closed_by_actor_id, closed_at_ms DESC)
WHERE
  closed_by_actor_id IS NOT NULL;

CREATE TABLE bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform VARCHAR(30) NOT NULL DEFAULT 'minecraft',
  title VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  status bug_report_status NOT NULL DEFAULT 'open',
  severity severity NULL,
  created_by_actor_id UUID NULL REFERENCES actors (id) ON DELETE RESTRICT,
  assigned_to_actor_id UUID NULL REFERENCES actors (id) ON DELETE SET NULL,
  closed_by_actor_id UUID NULL REFERENCES actors (id) ON DELETE RESTRICT,
  closed_at_ms BIGINT NULL,
  created_at_ms BIGINT NOT NULL DEFAULT get_unix_ms (),
  updated_at_ms BIGINT NULL,
  CONSTRAINT chk_bug_reports_closed_consistent CHECK (
    (
      closed_at_ms IS NULL
      AND closed_by_actor_id IS NULL
    )
    OR (
      closed_at_ms IS NOT NULL
      AND closed_by_actor_id IS NOT NULL
    )
  )
);

CREATE INDEX idx_bug_reports_status_severity_created ON bug_reports (status, severity, created_at_ms DESC);

CREATE INDEX idx_bug_reports_created_by_actor ON bug_reports (created_by_actor_id, created_at_ms DESC)
WHERE
  created_by_actor_id IS NOT NULL;

CREATE INDEX idx_bug_reports_assigned_status_created ON bug_reports (assigned_to_actor_id, status, created_at_ms DESC)
WHERE
  assigned_to_actor_id IS NOT NULL;

CREATE INDEX idx_bug_reports_closed_by_actor ON bug_reports (closed_by_actor_id, closed_at_ms DESC)
WHERE
  closed_by_actor_id IS NOT NULL;

CREATE INDEX idx_bug_reports_title_description_fts ON bug_reports USING GIN (
  to_tsvector(
    'english',
    coalesce(title, '') || ' ' || coalesce(description, '')
  )
);

CREATE TABLE entitlement_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku VARCHAR(64) NOT NULL UNIQUE,
  -- Example: gadget, cosmetic, pet
  item_type VARCHAR(50) NOT NULL,
  label VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at_ms BIGINT NOT NULL DEFAULT get_unix_ms (),
  updated_at_ms BIGINT NOT NULL DEFAULT get_unix_ms ()
);

CREATE TABLE player_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
  entitlement_item_id UUID NOT NULL REFERENCES entitlement_items (id) ON DELETE RESTRICT,
  source VARCHAR(50) NOT NULL,
  source_ref_id UUID NULL,
  quantity BIGINT NOT NULL DEFAULT 1,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  granted_at_ms BIGINT NOT NULL DEFAULT get_unix_ms (),
  revoked_at_ms BIGINT NULL,
  expires_at_ms BIGINT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  CHECK (quantity >= 0),
  CHECK (
    status IN ('active', 'revoked', 'expired', 'consumed')
  )
);

CREATE TABLE shop_offerings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entitlement_item_id UUID NOT NULL REFERENCES entitlement_items (id) ON DELETE RESTRICT,
  label VARCHAR(100),
  price BIGINT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at_ms BIGINT NULL,
  ends_at_ms BIGINT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at_ms BIGINT NOT NULL DEFAULT get_unix_ms (),
  updated_at_ms BIGINT NOT NULL DEFAULT get_unix_ms (),
  CHECK (price >= 0),
  CHECK (quantity > 0)
);

CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
  total_amount BIGINT NOT NULL,
  currency_type VARCHAR(50) NOT NULL DEFAULT 'soft_currency',
  status VARCHAR(20) NOT NULL,
  created_at_ms BIGINT NOT NULL DEFAULT get_unix_ms (),
  completed_at_ms BIGINT NULL,
  cancelled_at_ms BIGINT NULL,
  CHECK (total_amount >= 0),
  CHECK (
    status IN ('pending', 'completed', 'cancelled', 'failed')
  )
);

CREATE TABLE purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders (id) ON DELETE RESTRICT,
  shop_listing_id UUID NULL REFERENCES shop_offerings (id) ON DELETE RESTRICT,
  entitlement_item_id UUID NOT NULL REFERENCES entitlement_items (id) ON DELETE RESTRICT,
  sku VARCHAR(64) NOT NULL,
  label VARCHAR(100) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price BIGINT NOT NULL,
  line_total BIGINT NOT NULL,
  granted_entitlement_id UUID NULL REFERENCES player_entitlements (id) ON DELETE SET NULL,
  CHECK (quantity > 0),
  CHECK (unit_price >= 0),
  CHECK (line_total >= 0),
  CHECK (line_total = quantity * unit_price)
);

CREATE TABLE virtual_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
  amount BIGINT NOT NULL,
  transaction_type VARCHAR(50) NOT NULL,
  source VARCHAR(50) NOT NULL,
  source_ref_id UUID NULL,
  balance_after BIGINT NOT NULL,
  created_at_ms BIGINT NOT NULL DEFAULT get_unix_ms ()
);

-- ============================================================
-- Generic moderation resource links
-- This is the bridge layer that lets reports, cases, appeals,
-- punishments, bugs, actors, and evidence-like resources connect.
-- ============================================================
CREATE TABLE moderation_resource_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type moderation_resource_type NOT NULL,
  source_id UUID NOT NULL,
  target_type moderation_resource_type NOT NULL,
  target_id UUID NOT NULL,
  link_type moderation_link_type NOT NULL DEFAULT 'related_to',
  created_by_actor_id UUID NULL REFERENCES actors (id) ON DELETE SET NULL,
  created_at_ms BIGINT NOT NULL DEFAULT get_unix_ms (),
  note TEXT NULL,
  CONSTRAINT chk_moderation_resource_links_not_self CHECK (
    source_type <> target_type
    OR source_id <> target_id
  )
);

CREATE INDEX idx_moderation_resource_links_source ON moderation_resource_links (source_type, source_id, link_type);

CREATE INDEX idx_moderation_resource_links_target ON moderation_resource_links (target_type, target_id, link_type);

CREATE INDEX idx_moderation_resource_links_created ON moderation_resource_links (created_at_ms DESC);

CREATE UNIQUE INDEX uq_moderation_resource_links_exact ON moderation_resource_links (
  source_type,
  source_id,
  target_type,
  target_id,
  link_type
);

-- ============================================================
-- Moderation evidence
-- Evidence is stronger than a generic link: it means this item
-- is being used to support review, investigation, or action.
-- ============================================================
CREATE TABLE moderation_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type moderation_resource_type NOT NULL,
  object_id UUID NOT NULL,
  evidence_type moderation_evidence_type NOT NULL,
  chat_message_id UUID NULL REFERENCES chat_messages (id) ON DELETE SET NULL,
  title TEXT NULL,
  description TEXT NULL,
  url TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_by_actor_id UUID NULL REFERENCES actors (id) ON DELETE SET NULL,
  created_at_ms BIGINT NOT NULL DEFAULT get_unix_ms (),
  is_removed BOOLEAN NOT NULL DEFAULT FALSE,
  removed_by_actor_id UUID NULL REFERENCES actors (id) ON DELETE SET NULL,
  removed_at_ms BIGINT NULL,
  CONSTRAINT chk_moderation_evidence_removed_consistent CHECK (
    (
      is_removed = FALSE
      AND removed_by_actor_id IS NULL
      AND removed_at_ms IS NULL
    )
    OR (
      is_removed = TRUE
      AND removed_by_actor_id IS NOT NULL
      AND removed_at_ms IS NOT NULL
    )
  ),
  CONSTRAINT chk_moderation_evidence_has_payload CHECK (
    chat_message_id IS NOT NULL
    OR url IS NOT NULL
    OR description IS NOT NULL
    OR metadata <> '{}'::jsonb
  )
);

CREATE INDEX idx_moderation_evidence_object ON moderation_evidence (object_type, object_id, created_at_ms DESC);

CREATE INDEX idx_moderation_evidence_type ON moderation_evidence (evidence_type, created_at_ms DESC);

CREATE INDEX idx_moderation_evidence_chat_message ON moderation_evidence (chat_message_id)
WHERE
  chat_message_id IS NOT NULL;

CREATE INDEX idx_moderation_evidence_submitted_by ON moderation_evidence (submitted_by_actor_id, created_at_ms DESC)
WHERE
  submitted_by_actor_id IS NOT NULL;

-- ============================================================
-- Moderation events / limited operational timeline
-- This is the staff-facing moderation trail, not the full admin audit log.
-- ============================================================
CREATE TABLE moderation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type moderation_resource_type NOT NULL,
  object_id UUID NOT NULL,
  event_type moderation_event_type NOT NULL,
  actor_id UUID NULL REFERENCES actors (id) ON DELETE SET NULL,
  previous_value JSONB NULL,
  new_value JSONB NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at_ms BIGINT NOT NULL DEFAULT get_unix_ms ()
);

CREATE INDEX idx_moderation_events_object_created ON moderation_events (object_type, object_id, created_at_ms DESC);

CREATE INDEX idx_moderation_events_actor_created ON moderation_events (actor_id, created_at_ms DESC)
WHERE
  actor_id IS NOT NULL;

CREATE INDEX idx_moderation_events_type_created ON moderation_events (event_type, created_at_ms DESC);

CREATE INDEX idx_moderation_events_created ON moderation_events (created_at_ms DESC);
```

## Unused enum types

These types no longer have references in the active schema. Their definitions are
retained here alongside the removed tables for future design work. The obsolete
`chat_channel` rollback entry was also removed; it had no type definition.

```sql
CREATE TYPE server_status AS ENUM('online', 'offline');

CREATE TYPE moderation_resource_type AS ENUM(
  'actor',
  'server',
  'report',
  'report_comment',
  'appeal',
  'mod_case',
  'watchlist_entry',
  'infraction',
  'punishment',
  'chat_message',
  'bug_report',
  'external_url',
  'file'
);

CREATE TYPE moderation_link_type AS ENUM(
  'related_to',
  'evidence_for',
  'subject_of',
  'reporter_of',
  'appellant_of',
  'escalated_to',
  'created_from',
  'attached_to',
  'appeals',
  'resulted_in',
  'duplicate_of',
  'blocked_by',
  'mentions',
  'involves',
  'resolved_by'
);

CREATE TYPE moderation_evidence_type AS ENUM(
  'chat_message',
  'chat_context',
  'screenshot',
  'video',
  'server_log',
  'command_log',
  'bug_report',
  'external_url',
  'file',
  'staff_observation',
  'other'
);

CREATE TYPE moderation_event_type AS ENUM(
  'created',
  'updated',
  'status_changed',
  'priority_changed',
  'severity_changed',
  'assigned',
  'triaged',
  'comment_added',
  'comment_edited',
  'evidence_added',
  'evidence_removed',
  'linked_resource',
  'unlinked_resource',
  'escalated_to_case',
  'infraction_issued',
  'appeal_opened',
  'appeal_closed',
  'watchlist_added',
  'watchlist_cleared',
  'closed',
  'reopened'
);

CREATE TYPE punishment_appeal_status AS ENUM(
  'open',
  'under_review',
  'accepted',
  'rejected',
  'withdrawn'
);
```
