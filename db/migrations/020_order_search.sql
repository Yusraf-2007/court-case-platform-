-- 020_order_search.sql
-- Search over order text: full-text and semantic, for the hybrid /search.
--
--   1. orders.order_tsv: tsvector GENERATED from order_text ('english'
--      configuration: stems "convicted"/"conviction" to one lexeme), with a
--      GIN index. Generated, so it can never drift from the text.
--
--   2. orders.embedding: vector(1536), filled by db/scripts/embed_orders.ts
--      (not by this migration: it needs an embedding API). Also
--      embedding_model, the model that produced it, so vectors from
--      different models are never compared with each other.
--      ivfflat index, cosine distance, lists = 1. pgvector's guidance is
--      lists = rows / 1000 up to 1M rows; with 47 orders one list is right,
--      and a single list is an exact search. REINDEX with more lists once
--      the table grows (and after a large backfill: ivfflat picks its
--      centroids from the rows present when the index is built).
--
--   3. orders_clear_stale_embedding: BEFORE UPDATE OF order_text. An edited
--      order loses its embedding (and model), so semantic search never
--      ranks it by text it no longer has; the backfill re-embeds rows with
--      a NULL embedding.
--
--   4. The audit log must not fill with vectors. audit_row() (019) gains an
--      optional third argument: columns left out of the audit entirely,
--      on insert, update and delete. audit_orders omits embedding,
--      embedding_model and order_tsv, so a backfill writes no audit rows
--      and an order's audit copy stays readable.
--
-- KNOWN GAPS
--   - The embedding model is not fixed here. The backfill defaults to a
--     1536-dimension model and refuses any model whose vectors are not 1536
--     wide.
--   - Order text is mostly English with transliterated names; the 'english'
--     configuration does not stem Hindi. Names still match as whole words.

BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- 1. Full-text
-- ---------------------------------------------------------------------------
ALTER TABLE orders
    ADD COLUMN order_tsv tsvector
        GENERATED ALWAYS AS (to_tsvector('english'::regconfig, order_text)) STORED;

CREATE INDEX orders_order_tsv_idx ON orders USING gin (order_tsv);

-- ---------------------------------------------------------------------------
-- 2. Semantic
-- ---------------------------------------------------------------------------
ALTER TABLE orders
    ADD COLUMN embedding       vector(1536),
    ADD COLUMN embedding_model text,
    ADD CONSTRAINT orders_embedding_has_model
        CHECK ((embedding IS NULL) = (embedding_model IS NULL));

CREATE INDEX orders_embedding_idx ON orders
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 1);

-- ---------------------------------------------------------------------------
-- 3. Edited text invalidates the embedding
-- ---------------------------------------------------------------------------
CREATE FUNCTION orders_clear_stale_embedding() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    PERFORM note_trigger_fired(TG_NAME);
    NEW.embedding := NULL;
    NEW.embedding_model := NULL;
    RETURN NEW;
END;
$$;

CREATE TRIGGER orders_clear_stale_embedding
    BEFORE UPDATE OF order_text ON orders
    FOR EACH ROW
    WHEN (NEW.order_text IS DISTINCT FROM OLD.order_text)
    EXECUTE FUNCTION orders_clear_stale_embedding();

-- ---------------------------------------------------------------------------
-- 4. audit_row(): TG_ARGV[2] lists columns omitted from the audit entirely.
-- Unchanged from 019 apart from the two omit lines.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_row() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    who    text  := nullif(current_setting('app.user', true), '');
    omit   text[] := string_to_array(coalesce(TG_ARGV[2], ''), ',');
    o      jsonb := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) - omit END;
    n      jsonb := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) - omit END;
    r      jsonb := coalesce(n, o);
    skip   text[] := string_to_array(coalesce(TG_ARGV[1], ''), ',');
    cases  bigint[];
    act    text  := lower(TG_OP);
    k      text;
    c      bigint;
BEGIN
    PERFORM note_trigger_fired(TG_NAME);

    cases := CASE TG_ARGV[0]
        WHEN 'id'            THEN ARRAY[(r ->> 'id')::bigint]
        WHEN 'case_id'       THEN ARRAY[(r ->> 'case_id')::bigint]
        WHEN 'case_party_id' THEN ARRAY(SELECT case_id FROM case_parties
                                        WHERE id = (r ->> 'case_party_id')::bigint)
        WHEN 'person'        THEN ARRAY(SELECT DISTINCT case_id FROM case_parties
                                        WHERE person_id = (r ->> 'id')::bigint)
    END;

    -- A party row carries the person it links, so adding a new person to a
    -- case is logged in full.
    IF TG_TABLE_NAME = 'case_parties' THEN
        IF n IS NOT NULL THEN
            n := n || jsonb_build_object('person',
                 (SELECT to_jsonb(p) FROM persons p WHERE p.id = (n ->> 'person_id')::bigint));
        END IF;
        IF o IS NOT NULL THEN
            o := o || jsonb_build_object('person',
                 (SELECT to_jsonb(p) FROM persons p WHERE p.id = (o ->> 'person_id')::bigint));
        END IF;
    END IF;

    FOREACH c IN ARRAY coalesce(cases, '{}') LOOP
        IF TG_OP = 'UPDATE' THEN
            FOR k IN
                SELECT key FROM jsonb_each(n)
                WHERE n -> key IS DISTINCT FROM o -> key AND NOT key = ANY (skip)
            LOOP
                INSERT INTO case_audit_log
                    (case_id, table_name, row_id, action, field_changed, old_value, new_value, changed_by)
                VALUES (c, TG_TABLE_NAME, (r ->> 'id')::bigint, act, k, o ->> k, n ->> k, who);
            END LOOP;
        ELSE
            INSERT INTO case_audit_log
                (case_id, table_name, row_id, action, field_changed, old_value, new_value, changed_by)
            VALUES (c, TG_TABLE_NAME, (r ->> 'id')::bigint, act, '*', o::text, n::text, who);
        END IF;
    END LOOP;

    RETURN NULL;   -- AFTER trigger
END;
$$;

DROP TRIGGER audit_orders ON orders;
CREATE TRIGGER audit_orders
    AFTER INSERT OR UPDATE OR DELETE ON orders
    FOR EACH ROW EXECUTE FUNCTION audit_row('case_id', '', 'embedding,embedding_model,order_tsv');

COMMIT;
