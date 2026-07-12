DO $baseline_preflight$
DECLARE
  existing_target_tables text[];
BEGIN
  SELECT array_agg(format('%I.%I', n.nspname, c.relname) ORDER BY c.relname)
  INTO existing_target_tables
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND c.relname = ANY (ARRAY[
      'products',
      'retailers',
      'offers',
      'price_history',
      'retailer_products',
      'product_variants',
      'product_merge_history',
      'ignored_duplicate_product_pairs',
      'outbound_clicks',
      'search_events'
    ]::text[]);

  IF coalesce(cardinality(existing_target_tables), 0) > 0 THEN
    RAISE EXCEPTION USING
      MESSAGE = 'SupplementScout baseline cannot be executed on an existing environment; migration-history reconciliation is required before deployment.',
      DETAIL = 'Existing target tables: ' || array_to_string(existing_target_tables, ', ');
  END IF;
END;
$baseline_preflight$;


CREATE SCHEMA IF NOT EXISTS "public";


COMMENT ON SCHEMA "public" IS 'standard public schema';


CREATE TABLE IF NOT EXISTS "public"."ignored_duplicate_product_pairs" (
    "id" bigint NOT NULL,
    "product_a_id" bigint NOT NULL,
    "product_b_id" bigint NOT NULL,
    "ignored_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


CREATE TABLE IF NOT EXISTS "public"."offers" (
    "id" bigint NOT NULL,
    "product_id" bigint,
    "price" numeric,
    "url" "text",
    "in_stock" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "retailer_id" bigint,
    "shipping_cost" numeric,
    "total_price" numeric,
    "last_checked_at" timestamp with time zone DEFAULT "now"(),
    "retailer_product_id" bigint,
    "product_variant_id" bigint
);


CREATE TABLE IF NOT EXISTS "public"."outbound_clicks" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "offer_id" bigint,
    "product_id" bigint,
    "retailer_id" bigint,
    "destination_url" "text" NOT NULL,
    "source_page" "text" NOT NULL
);


CREATE TABLE IF NOT EXISTS "public"."price_history" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "offer_id" bigint,
    "price" numeric,
    "shipping_cost" numeric,
    "total_price" numeric,
    "checked_at" timestamp with time zone DEFAULT "now"()
);


CREATE TABLE IF NOT EXISTS "public"."product_merge_history" (
    "id" bigint NOT NULL,
    "canonical_product_id" bigint NOT NULL,
    "candidate_product_id" bigint NOT NULL,
    "merged_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "offers_moved" integer DEFAULT 0 NOT NULL,
    "retailer_products_moved" integer DEFAULT 0 NOT NULL,
    "price_history_preserved" integer DEFAULT 0 NOT NULL,
    "moved_offer_ids" bigint[] DEFAULT '{}'::bigint[] NOT NULL,
    "moved_retailer_product_ids" bigint[] DEFAULT '{}'::bigint[] NOT NULL,
    "candidate_offer_ids" bigint[] DEFAULT '{}'::bigint[] NOT NULL,
    "price_history_offer_ids" bigint[] DEFAULT '{}'::bigint[] NOT NULL,
    "snapshot" "jsonb" NOT NULL,
    "source" "text" DEFAULT 'admin_merge_rpc'::"text" NOT NULL,
    "conflict_kept_offer_ids" bigint[] DEFAULT '{}'::bigint[] NOT NULL,
    "conflict_deleted_offer_ids" bigint[] DEFAULT '{}'::bigint[] NOT NULL,
    "conflict_kept_retailer_product_ids" bigint[] DEFAULT '{}'::bigint[] NOT NULL,
    "conflict_deleted_retailer_product_ids" bigint[] DEFAULT '{}'::bigint[] NOT NULL,
    "canonical_price_history_before" integer DEFAULT 0 NOT NULL,
    "candidate_price_history_before" integer DEFAULT 0 NOT NULL,
    "total_price_history_after" integer DEFAULT 0 NOT NULL,
    "price_history_reassigned" integer DEFAULT 0 NOT NULL,
    "admin_decisions" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


CREATE TABLE IF NOT EXISTS "public"."product_variants" (
    "id" bigint NOT NULL,
    "product_id" bigint NOT NULL,
    "variant_key" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "flavour_code" "text",
    "flavour_label" "text",
    "size_value" numeric,
    "size_unit" "text",
    "pack_count" integer,
    "product_format" "text",
    "gtin" "text",
    "image" "text",
    "nutrition_override" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" bigint NOT NULL,
    "name" "text",
    "slug" "text",
    "brand" "text",
    "category" "text",
    "price" numeric,
    "retailer" "text",
    "image" "text",
    "description" "text",
    "servings" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "gtin" "text",
    "merged_into_product_id" bigint,
    "merged_at" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "net_weight_g" numeric,
    "serving_count_verified" integer,
    "serving_size_g" numeric,
    "protein_per_serving_g" numeric,
    "creatine_per_serving_g" numeric,
    "unit_count" integer,
    "unit_type" "text",
    "product_format" "text",
    "unit_pricing_verified" boolean DEFAULT false NOT NULL,
    "nutrition_verified" boolean DEFAULT false NOT NULL,
    "net_volume_ml" numeric,
    "serving_size_ml" numeric
);


CREATE TABLE IF NOT EXISTS "public"."retailer_products" (
    "id" bigint NOT NULL,
    "retailer_id" bigint NOT NULL,
    "product_id" bigint NOT NULL,
    "external_name" "text" NOT NULL,
    "external_slug" "text",
    "external_gtin" "text",
    "external_url" "text" NOT NULL,
    "match_method" "text",
    "match_confidence" numeric(5,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "product_variant_id" bigint,
    "external_product_id" "text",
    "external_variant_id" "text",
    "external_sku" "text",
    "external_options" "jsonb"
);


CREATE TABLE IF NOT EXISTS "public"."retailers" (
    "id" bigint NOT NULL,
    "name" "text",
    "slug" "text",
    "website" "text",
    "logo" "text",
    "affiliate_network" "text",
    "affiliate_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


CREATE TABLE IF NOT EXISTS "public"."search_events" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "event_type" "text" NOT NULL,
    "source_page" "text" NOT NULL,
    "query" "text" NOT NULL,
    "applied_query" "text",
    "corrected_query" "text",
    "result_count" integer,
    "match_status" "text",
    "search_mode" "text",
    "suggestion_type" "text",
    "suggestion_label" "text",
    "suggestion_href" "text"
);


COMMENT ON COLUMN "public"."product_variants"."flavour_code" IS 'NULL means no flavour dimension. Use an explicit code such as unflavoured when the product is explicitly unflavoured.';


COMMENT ON COLUMN "public"."product_variants"."gtin" IS 'Variant-level evidence only. This value must not be copied into products.gtin.';


ALTER TABLE "public"."ignored_duplicate_product_pairs" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."ignored_duplicate_product_pairs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


ALTER TABLE "public"."offers" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."offers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


ALTER TABLE "public"."outbound_clicks" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."outbound_clicks_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


ALTER TABLE "public"."price_history" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."price_history_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


ALTER TABLE "public"."product_merge_history" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."product_merge_history_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


ALTER TABLE "public"."product_variants" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."product_variants_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


ALTER TABLE "public"."products" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."products_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


ALTER TABLE "public"."retailer_products" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."retailer_products_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


ALTER TABLE "public"."retailers" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."retailers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


ALTER TABLE "public"."search_events" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."search_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


ALTER TABLE ONLY "public"."ignored_duplicate_product_pairs"
    ADD CONSTRAINT "ignored_duplicate_product_pairs_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."outbound_clicks"
    ADD CONSTRAINT "outbound_clicks_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."price_history"
    ADD CONSTRAINT "price_history_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."product_merge_history"
    ADD CONSTRAINT "product_merge_history_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."product_variants"
    ADD CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."retailer_products"
    ADD CONSTRAINT "retailer_products_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."retailers"
    ADD CONSTRAINT "retailers_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."search_events"
    ADD CONSTRAINT "search_events_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."ignored_duplicate_product_pairs"
    ADD CONSTRAINT "ignored_duplicate_product_pairs_unique" UNIQUE ("product_a_id", "product_b_id");


ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_product_retailer_unique" UNIQUE ("product_id", "retailer_id");


ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_retailer_url_unique" UNIQUE ("retailer_id", "url");


ALTER TABLE ONLY "public"."product_merge_history"
    ADD CONSTRAINT "product_merge_history_candidate_once" UNIQUE ("candidate_product_id");


ALTER TABLE ONLY "public"."product_variants"
    ADD CONSTRAINT "product_variants_product_key_unique" UNIQUE ("product_id", "variant_key");


ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_slug_unique" UNIQUE ("slug");


ALTER TABLE ONLY "public"."retailer_products"
    ADD CONSTRAINT "retailer_products_retailer_url_unique" UNIQUE ("retailer_id", "external_url");


ALTER TABLE ONLY "public"."ignored_duplicate_product_pairs"
    ADD CONSTRAINT "ignored_duplicate_product_pairs_not_same_product" CHECK (("product_a_id" <> "product_b_id"));


ALTER TABLE ONLY "public"."ignored_duplicate_product_pairs"
    ADD CONSTRAINT "ignored_duplicate_product_pairs_ordered" CHECK (("product_a_id" < "product_b_id"));


ALTER TABLE ONLY "public"."outbound_clicks"
    ADD CONSTRAINT "outbound_clicks_source_page_check" CHECK (("source_page" = ANY (ARRAY['product_best_offer'::"text", 'product_offer_list'::"text"])));


ALTER TABLE ONLY "public"."product_merge_history"
    ADD CONSTRAINT "product_merge_history_not_same_product" CHECK (("canonical_product_id" <> "candidate_product_id"));


ALTER TABLE ONLY "public"."product_variants"
    ADD CONSTRAINT "product_variants_display_name_nonempty" CHECK (("btrim"("display_name") <> ''::"text"));


ALTER TABLE ONLY "public"."product_variants"
    ADD CONSTRAINT "product_variants_flavour_pair" CHECK (((("flavour_code" IS NULL) AND ("flavour_label" IS NULL)) OR (("flavour_code" IS NOT NULL) AND ("btrim"("flavour_code") <> ''::"text") AND ("flavour_label" IS NOT NULL) AND ("btrim"("flavour_label") <> ''::"text"))));


ALTER TABLE ONLY "public"."product_variants"
    ADD CONSTRAINT "product_variants_gtin_nonempty" CHECK ((("gtin" IS NULL) OR ("btrim"("gtin") <> ''::"text")));


ALTER TABLE ONLY "public"."product_variants"
    ADD CONSTRAINT "product_variants_nutrition_override_object" CHECK (("jsonb_typeof"("nutrition_override") = 'object'::"text"));


ALTER TABLE ONLY "public"."product_variants"
    ADD CONSTRAINT "product_variants_pack_count_positive" CHECK ((("pack_count" IS NULL) OR ("pack_count" > 0)));


ALTER TABLE ONLY "public"."product_variants"
    ADD CONSTRAINT "product_variants_size_unit_nonempty" CHECK ((("size_unit" IS NULL) OR ("btrim"("size_unit") <> ''::"text")));


ALTER TABLE ONLY "public"."product_variants"
    ADD CONSTRAINT "product_variants_size_value_positive" CHECK ((("size_value" IS NULL) OR ((("size_value")::"text" <> 'NaN'::"text") AND ("size_value" > (0)::numeric))));


ALTER TABLE ONLY "public"."product_variants"
    ADD CONSTRAINT "product_variants_variant_key_nonempty" CHECK (("btrim"("variant_key") <> ''::"text"));


ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_cannot_merge_into_self" CHECK ((("merged_into_product_id" IS NULL) OR ("merged_into_product_id" <> "id")));


ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_creatine_not_above_serving_size" CHECK ((("creatine_per_serving_g" IS NULL) OR ("serving_size_g" IS NULL) OR ("creatine_per_serving_g" <= "serving_size_g")));


ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_creatine_per_serving_g_non_negative" CHECK ((("creatine_per_serving_g" IS NULL) OR ((("creatine_per_serving_g")::"text" <> 'NaN'::"text") AND ("creatine_per_serving_g" >= (0)::numeric))));


ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_merge_state_consistent" CHECK (((("merged_into_product_id" IS NULL) AND ("merged_at" IS NULL) AND ("is_active" = true)) OR (("merged_into_product_id" IS NOT NULL) AND ("merged_at" IS NOT NULL) AND ("is_active" = false))));


ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_net_volume_ml_positive" CHECK ((("net_volume_ml" IS NULL) OR ((("net_volume_ml")::"text" <> 'NaN'::"text") AND ("net_volume_ml" > (0)::numeric))));


ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_net_weight_g_positive" CHECK ((("net_weight_g" IS NULL) OR ((("net_weight_g")::"text" <> 'NaN'::"text") AND ("net_weight_g" > (0)::numeric))));


ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_protein_not_above_serving_size" CHECK ((("protein_per_serving_g" IS NULL) OR ("serving_size_g" IS NULL) OR ("protein_per_serving_g" <= "serving_size_g")));


ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_protein_per_serving_g_non_negative" CHECK ((("protein_per_serving_g" IS NULL) OR ((("protein_per_serving_g")::"text" <> 'NaN'::"text") AND ("protein_per_serving_g" >= (0)::numeric))));


ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_serving_count_verified_positive" CHECK ((("serving_count_verified" IS NULL) OR ("serving_count_verified" > 0)));


ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_serving_size_g_positive" CHECK ((("serving_size_g" IS NULL) OR ((("serving_size_g")::"text" <> 'NaN'::"text") AND ("serving_size_g" > (0)::numeric))));


ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_serving_size_ml_positive" CHECK ((("serving_size_ml" IS NULL) OR ((("serving_size_ml")::"text" <> 'NaN'::"text") AND ("serving_size_ml" > (0)::numeric))));


ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_unit_count_positive" CHECK ((("unit_count" IS NULL) OR ("unit_count" > 0)));


ALTER TABLE ONLY "public"."retailer_products"
    ADD CONSTRAINT "retailer_products_external_options_object" CHECK ((("external_options" IS NULL) OR ("jsonb_typeof"("external_options") = 'object'::"text")));


ALTER TABLE ONLY "public"."search_events"
    ADD CONSTRAINT "search_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['search_results'::"text", 'search_submit'::"text", 'suggestion_click'::"text"])));


ALTER TABLE ONLY "public"."search_events"
    ADD CONSTRAINT "search_events_match_status_check" CHECK ((("match_status" IS NULL) OR ("match_status" = ANY (ARRAY['exact'::"text", 'corrected'::"text", 'none'::"text"]))));


ALTER TABLE ONLY "public"."search_events"
    ADD CONSTRAINT "search_events_result_count_check" CHECK ((("result_count" IS NULL) OR ("result_count" >= 0)));


ALTER TABLE ONLY "public"."search_events"
    ADD CONSTRAINT "search_events_search_mode_check" CHECK ((("search_mode" IS NULL) OR ("search_mode" = ANY (ARRAY['standard_ilike'::"text", 'goal_mapped_ilike'::"text"]))));


ALTER TABLE ONLY "public"."search_events"
    ADD CONSTRAINT "search_events_source_page_check" CHECK (("source_page" = ANY (ARRAY['homepage'::"text", 'search_page'::"text", 'unknown'::"text"])));


ALTER TABLE ONLY "public"."ignored_duplicate_product_pairs"
    ADD CONSTRAINT "ignored_duplicate_product_pairs_product_a_id_fkey" FOREIGN KEY ("product_a_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."ignored_duplicate_product_pairs"
    ADD CONSTRAINT "ignored_duplicate_product_pairs_product_b_id_fkey" FOREIGN KEY ("product_b_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");


ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "public"."product_variants"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_retailer_id_fkey" FOREIGN KEY ("retailer_id") REFERENCES "public"."retailers"("id");


ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_retailer_product_id_fkey" FOREIGN KEY ("retailer_product_id") REFERENCES "public"."retailer_products"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."outbound_clicks"
    ADD CONSTRAINT "outbound_clicks_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."outbound_clicks"
    ADD CONSTRAINT "outbound_clicks_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."outbound_clicks"
    ADD CONSTRAINT "outbound_clicks_retailer_id_fkey" FOREIGN KEY ("retailer_id") REFERENCES "public"."retailers"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."price_history"
    ADD CONSTRAINT "price_history_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id");


ALTER TABLE ONLY "public"."product_merge_history"
    ADD CONSTRAINT "product_merge_history_candidate_product_id_fkey" FOREIGN KEY ("candidate_product_id") REFERENCES "public"."products"("id");


ALTER TABLE ONLY "public"."product_merge_history"
    ADD CONSTRAINT "product_merge_history_canonical_product_id_fkey" FOREIGN KEY ("canonical_product_id") REFERENCES "public"."products"("id");


ALTER TABLE ONLY "public"."product_variants"
    ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_merged_into_product_id_fkey" FOREIGN KEY ("merged_into_product_id") REFERENCES "public"."products"("id");


ALTER TABLE ONLY "public"."retailer_products"
    ADD CONSTRAINT "retailer_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."retailer_products"
    ADD CONSTRAINT "retailer_products_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "public"."product_variants"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."retailer_products"
    ADD CONSTRAINT "retailer_products_retailer_id_fkey" FOREIGN KEY ("retailer_id") REFERENCES "public"."retailers"("id") ON DELETE CASCADE;


CREATE INDEX "ignored_duplicate_product_pairs_product_a_idx" ON "public"."ignored_duplicate_product_pairs" USING "btree" ("product_a_id");


CREATE INDEX "ignored_duplicate_product_pairs_product_b_idx" ON "public"."ignored_duplicate_product_pairs" USING "btree" ("product_b_id");


CREATE INDEX "offers_product_variant_id_idx" ON "public"."offers" USING "btree" ("product_variant_id");


CREATE INDEX "offers_retailer_product_id_idx" ON "public"."offers" USING "btree" ("retailer_product_id");


CREATE INDEX "outbound_clicks_created_at_idx" ON "public"."outbound_clicks" USING "btree" ("created_at");


CREATE INDEX "outbound_clicks_offer_id_idx" ON "public"."outbound_clicks" USING "btree" ("offer_id");


CREATE INDEX "outbound_clicks_product_id_idx" ON "public"."outbound_clicks" USING "btree" ("product_id");


CREATE INDEX "outbound_clicks_retailer_id_idx" ON "public"."outbound_clicks" USING "btree" ("retailer_id");


CREATE INDEX "product_merge_history_candidate_product_id_idx" ON "public"."product_merge_history" USING "btree" ("candidate_product_id");


CREATE INDEX "product_merge_history_canonical_product_id_idx" ON "public"."product_merge_history" USING "btree" ("canonical_product_id");


CREATE INDEX "product_variants_gtin_idx" ON "public"."product_variants" USING "btree" ("gtin") WHERE (("gtin" IS NOT NULL) AND ("btrim"("gtin") <> ''::"text"));


CREATE UNIQUE INDEX "product_variants_one_default_per_product_idx" ON "public"."product_variants" USING "btree" ("product_id") WHERE ("is_default" = true);


CREATE UNIQUE INDEX "products_gtin_unique" ON "public"."products" USING "btree" ("gtin") WHERE (("gtin" IS NOT NULL) AND (TRIM(BOTH FROM "gtin") <> ''::"text"));


CREATE INDEX "products_is_active_idx" ON "public"."products" USING "btree" ("is_active");


CREATE INDEX "products_merged_into_product_id_idx" ON "public"."products" USING "btree" ("merged_into_product_id");


CREATE INDEX "retailer_products_external_gtin_idx" ON "public"."retailer_products" USING "btree" ("external_gtin");


CREATE INDEX "retailer_products_external_product_id_idx" ON "public"."retailer_products" USING "btree" ("retailer_id", "external_product_id");


CREATE INDEX "retailer_products_external_slug_idx" ON "public"."retailer_products" USING "btree" ("external_slug");


CREATE INDEX "retailer_products_external_variant_id_idx" ON "public"."retailer_products" USING "btree" ("retailer_id", "external_variant_id");


CREATE INDEX "retailer_products_product_id_idx" ON "public"."retailer_products" USING "btree" ("product_id");


CREATE INDEX "retailer_products_product_variant_id_idx" ON "public"."retailer_products" USING "btree" ("product_variant_id");


CREATE INDEX "search_events_created_at_idx" ON "public"."search_events" USING "btree" ("created_at");


CREATE INDEX "search_events_event_type_created_at_idx" ON "public"."search_events" USING "btree" ("event_type", "created_at");


CREATE INDEX "search_events_match_status_created_at_idx" ON "public"."search_events" USING "btree" ("match_status", "created_at");


CREATE OR REPLACE FUNCTION "public"."extract_product_size"("product_name" "text") RETURNS TABLE("value" numeric, "dimension" "text")
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'pg_catalog', 'public'
    AS $_$
  with size_match as (
    select regexp_match(
      lower(coalesce(product_name, '')),
      '([0-9]+(?:\.[0-9]+)?)\s*(kg|g|ml|l)([^a-z0-9_]|$)'
    ) as match
  )
  select
    case (match)[2]
      when 'kg' then ((match)[1])::numeric * 1000
      when 'g' then ((match)[1])::numeric
      when 'l' then ((match)[1])::numeric * 1000
      when 'ml' then ((match)[1])::numeric
    end as value,
    case
      when (match)[2] in ('kg', 'g') then 'mass'
      when (match)[2] in ('l', 'ml') then 'volume'
    end as dimension
  from size_match
  where match is not null;
$_$;


CREATE OR REPLACE FUNCTION "public"."merge_products"("canonical_id" bigint, "candidate_id" bigint) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  canonical_product public.products%rowtype;
  candidate_product public.products%rowtype;

  locked_count integer;

  canonical_size_value numeric;
  canonical_size_dimension text;
  candidate_size_value numeric;
  candidate_size_dimension text;

  candidate_offer_ids bigint[] := '{}';
  moved_offer_ids bigint[] := '{}';
  candidate_retailer_product_ids bigint[] := '{}';
  moved_retailer_product_ids bigint[] := '{}';
  price_history_offer_ids bigint[] := '{}';
  candidate_offers_before jsonb := '[]'::jsonb;
  candidate_retailer_products_before jsonb := '[]'::jsonb;

  price_history_count integer := 0;
  merged_at_value timestamptz := now();
  merge_history_id bigint;
begin
  if canonical_id is null or candidate_id is null then
    raise exception 'canonical_id and candidate_id are required';
  end if;

  if canonical_id <= 0 or candidate_id <= 0 then
    raise exception 'canonical_id and candidate_id must be positive integers';
  end if;

  if canonical_id = candidate_id then
    raise exception 'canonical_id and candidate_id must be different';
  end if;

  select count(*)
  into locked_count
  from (
    select id
    from public.products
    where id in (canonical_id, candidate_id)
    order by id
    for update
  ) locked_products;

  if locked_count <> 2 then
    raise exception 'Both products must exist';
  end if;

  select *
  into canonical_product
  from public.products
  where id = canonical_id;

  select *
  into candidate_product
  from public.products
  where id = candidate_id;

  if canonical_product.is_active is not true
     or canonical_product.merged_into_product_id is not null
     or canonical_product.merged_at is not null then
    raise exception 'Canonical product is already merged or inactive';
  end if;

  if candidate_product.is_active is not true
     or candidate_product.merged_into_product_id is not null
     or candidate_product.merged_at is not null then
    raise exception 'Candidate product is already merged or inactive';
  end if;

  if nullif(btrim(coalesce(canonical_product.gtin, '')), '') is not null
     and nullif(btrim(coalesce(candidate_product.gtin, '')), '') is not null
     and btrim(canonical_product.gtin) <> btrim(candidate_product.gtin) then
    raise exception 'Merge blocked: products have different non-empty GTINs';
  end if;

  if lower(btrim(coalesce(canonical_product.brand, '')))
     <> lower(btrim(coalesce(candidate_product.brand, ''))) then
    raise exception 'Merge blocked: products have different brands';
  end if;

  if lower(btrim(coalesce(canonical_product.category, '')))
     <> lower(btrim(coalesce(candidate_product.category, ''))) then
    raise exception 'Merge blocked: products have different categories';
  end if;

  if canonical_product.servings is not null
     and candidate_product.servings is not null
     and canonical_product.servings <> candidate_product.servings then
    raise exception 'Merge blocked: products have different servings';
  end if;

  select value, dimension
  into canonical_size_value, canonical_size_dimension
  from public.extract_product_size(canonical_product.name)
  limit 1;

  select value, dimension
  into candidate_size_value, candidate_size_dimension
  from public.extract_product_size(candidate_product.name)
  limit 1;

  if canonical_size_value is not null
     and candidate_size_value is not null
     and (
       canonical_size_value <> candidate_size_value
       or canonical_size_dimension <> candidate_size_dimension
     ) then
    raise exception 'Merge blocked: products have different detected sizes';
  end if;

  if exists (
    select 1
    from public.offers candidate_offer
    where candidate_offer.product_id = candidate_id
      and candidate_offer.retailer_id is null
  ) then
    raise exception 'Merge blocked: candidate offer is missing retailer_id';
  end if;

  if exists (
    select 1
    from public.offers candidate_offer
    where candidate_offer.product_id = candidate_id
      and nullif(btrim(coalesce(candidate_offer.url, '')), '') is null
  ) then
    raise exception 'Merge blocked: candidate offer is missing URL';
  end if;

  if exists (
    select 1
    from public.offers candidate_offer
    join public.offers canonical_offer
      on canonical_offer.product_id = canonical_id
     and canonical_offer.retailer_id = candidate_offer.retailer_id
    where candidate_offer.product_id = candidate_id
  ) then
    raise exception 'Merge blocked: canonical already has an offer for a candidate retailer';
  end if;

  if exists (
    select 1
    from public.offers candidate_offer
    join public.offers canonical_offer
      on canonical_offer.product_id = canonical_id
     and nullif(btrim(coalesce(canonical_offer.url, '')), '')
       = nullif(btrim(coalesce(candidate_offer.url, '')), '')
    where candidate_offer.product_id = candidate_id
  ) then
    raise exception 'Merge blocked: canonical already has an offer with a candidate URL';
  end if;

  if exists (
    select 1
    from public.retailer_products candidate_mapping
    where candidate_mapping.product_id = candidate_id
      and nullif(btrim(coalesce(candidate_mapping.external_url, '')), '') is null
  ) then
    raise exception 'Merge blocked: candidate retailer_products mapping is missing external_url';
  end if;

  if exists (
    select 1
    from public.retailer_products candidate_mapping
    join public.retailer_products canonical_mapping
      on canonical_mapping.product_id = canonical_id
     and canonical_mapping.retailer_id = candidate_mapping.retailer_id
    where candidate_mapping.product_id = candidate_id
  ) then
    raise exception 'Merge blocked: canonical already has a retailer_products mapping for a candidate retailer';
  end if;

  if exists (
    select 1
    from public.retailer_products candidate_mapping
    join public.retailer_products canonical_mapping
      on canonical_mapping.product_id = canonical_id
     and canonical_mapping.retailer_id = candidate_mapping.retailer_id
     and canonical_mapping.external_url = candidate_mapping.external_url
    where candidate_mapping.product_id = candidate_id
  ) then
    raise exception 'Merge blocked: canonical already has the same retailer_products external_url';
  end if;

  select coalesce(array_agg(id order by id), '{}')
  into candidate_offer_ids
  from public.offers
  where product_id = candidate_id;

  select coalesce(array_agg(id order by id), '{}')
  into candidate_retailer_product_ids
  from public.retailer_products
  where product_id = candidate_id;

  select coalesce(jsonb_agg(to_jsonb(o) order by o.id), '[]'::jsonb)
  into candidate_offers_before
  from public.offers o
  where o.product_id = candidate_id;

  select coalesce(jsonb_agg(to_jsonb(rp) order by rp.id), '[]'::jsonb)
  into candidate_retailer_products_before
  from public.retailer_products rp
  where rp.product_id = candidate_id;

  select coalesce(array_agg(distinct offer_id order by offer_id), '{}')
  into price_history_offer_ids
  from public.price_history
  where offer_id = any(candidate_offer_ids);

  select count(*)
  into price_history_count
  from public.price_history
  where offer_id = any(candidate_offer_ids);

  with moved_offers as (
    update public.offers
    set product_id = canonical_id
    where product_id = candidate_id
    returning id
  )
  select coalesce(array_agg(id order by id), '{}')
  into moved_offer_ids
  from moved_offers;

  with moved_mappings as (
    update public.retailer_products
    set product_id = canonical_id
    where product_id = candidate_id
    returning id
  )
  select coalesce(array_agg(id order by id), '{}')
  into moved_retailer_product_ids
  from moved_mappings;

  update public.products
  set
    merged_into_product_id = canonical_id,
    merged_at = merged_at_value,
    is_active = false
  where id = candidate_id;

  insert into public.product_merge_history (
    canonical_product_id,
    candidate_product_id,
    merged_at,
    offers_moved,
    retailer_products_moved,
    price_history_preserved,
    moved_offer_ids,
    moved_retailer_product_ids,
    candidate_offer_ids,
    price_history_offer_ids,
    snapshot,
    source
  )
  values (
    canonical_id,
    candidate_id,
    merged_at_value,
    cardinality(moved_offer_ids),
    cardinality(moved_retailer_product_ids),
    price_history_count,
    moved_offer_ids,
    moved_retailer_product_ids,
    candidate_offer_ids,
    price_history_offer_ids,
    jsonb_build_object(
      'canonical_before_merge', to_jsonb(canonical_product),
      'candidate_before_merge', to_jsonb(candidate_product),
      'candidate_offer_ids', candidate_offer_ids,
      'candidate_retailer_product_ids', candidate_retailer_product_ids,
      'candidate_offers_before', candidate_offers_before,
      'candidate_retailer_products_before', candidate_retailer_products_before,
      'moved_offer_ids', moved_offer_ids,
      'moved_retailer_product_ids', moved_retailer_product_ids,
      'price_history_offer_ids', price_history_offer_ids,
      'price_history_preserved', price_history_count,
      'merged_at', merged_at_value,
      'source', 'admin_merge_rpc'
    ),
    'admin_merge_rpc'
  )
  returning id into merge_history_id;

  return jsonb_build_object(
    'merge_history_id', merge_history_id,
    'canonical_product_id', canonical_id,
    'candidate_product_id', candidate_id,
    'merged_at', merged_at_value,
    'offers_moved', cardinality(moved_offer_ids),
    'retailer_products_moved', cardinality(moved_retailer_product_ids),
    'price_history_preserved', price_history_count,
    'redirect_to', '/product/' || canonical_id::text
  );
end;
$$;


CREATE OR REPLACE FUNCTION "public"."merge_products_with_decisions"("canonical_id" bigint, "candidate_id" bigint, "decisions" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $_$
declare
  canonical_product public.products%rowtype;
  candidate_product public.products%rowtype;
  locked_count integer;
  canonical_size_value numeric;
  canonical_size_dimension text;
  candidate_size_value numeric;
  candidate_size_dimension text;
  offer_decision record;
  mapping_decision record;
  conflict_count integer;
  decision_count integer;
  reassigned_count integer;
  total_reassigned_count integer := 0;
  deleted_reference_count integer := 0;
  remaining_candidate_offers integer := 0;
  remaining_candidate_mappings integer := 0;
  canonical_price_history_before_value integer := 0;
  candidate_price_history_before_value integer := 0;
  total_price_history_before_value integer := 0;
  total_price_history_after_value integer := 0;
  candidate_offer_ids bigint[] := '{}';
  candidate_retailer_product_ids bigint[] := '{}';
  candidate_price_history_offer_ids bigint[] := '{}';
  moved_offer_ids bigint[] := '{}';
  moved_retailer_product_ids bigint[] := '{}';
  conflict_kept_offer_ids_value bigint[] := '{}';
  conflict_deleted_offer_ids_value bigint[] := '{}';
  conflict_kept_retailer_product_ids_value bigint[] := '{}';
  conflict_deleted_retailer_product_ids_value bigint[] := '{}';
  products_before jsonb := '[]'::jsonb;
  offers_before jsonb := '[]'::jsonb;
  retailer_products_before jsonb := '[]'::jsonb;
  price_history_before jsonb := '[]'::jsonb;
  merged_at_value timestamptz := now();
  merge_history_id bigint;
begin
  if canonical_id is null or candidate_id is null or decisions is null then
    raise exception 'canonical_id, candidate_id, and decisions are required';
  end if;

  if jsonb_typeof(decisions) <> 'object' then
    raise exception 'decisions must be a JSON object';
  end if;

  if canonical_id <= 0 or candidate_id <= 0 then
    raise exception 'canonical_id and candidate_id must be positive integers';
  end if;

  if canonical_id = candidate_id then
    raise exception 'canonical_id and candidate_id must be different';
  end if;

  select count(*)
  into locked_count
  from (
    select id
    from public.products
    where id in (canonical_id, candidate_id)
    order by id
    for update
  ) locked_products;

  if locked_count <> 2 then
    raise exception 'Both products must exist';
  end if;

  perform locked_offer.id
  from (
    select id
    from public.offers
    where product_id in (canonical_id, candidate_id)
    order by id
    for update
  ) locked_offer;

  perform locked_mapping.id
  from (
    select id
    from public.retailer_products
    where product_id in (canonical_id, candidate_id)
    order by id
    for update
  ) locked_mapping;

  perform locked_price_history.id
  from (
    select ph.id
    from public.price_history ph
    join public.offers o
      on o.id = ph.offer_id
    where o.product_id in (canonical_id, candidate_id)
    order by ph.id
    for update of ph
  ) locked_price_history;

  select *
  into canonical_product
  from public.products
  where id = canonical_id;

  select *
  into candidate_product
  from public.products
  where id = candidate_id;

  if canonical_product.is_active is not true
     or canonical_product.merged_into_product_id is not null
     or canonical_product.merged_at is not null then
    raise exception 'Canonical product is already merged or inactive';
  end if;

  if candidate_product.is_active is not true
     or candidate_product.merged_into_product_id is not null
     or candidate_product.merged_at is not null then
    raise exception 'Candidate product is already merged or inactive';
  end if;

  if nullif(btrim(coalesce(canonical_product.gtin, '')), '') is not null
     and nullif(btrim(coalesce(candidate_product.gtin, '')), '') is not null
     and btrim(canonical_product.gtin) <> btrim(candidate_product.gtin) then
    raise exception 'Merge blocked: products have different non-empty GTINs';
  end if;

  if lower(btrim(coalesce(canonical_product.brand, '')))
     <> lower(btrim(coalesce(candidate_product.brand, ''))) then
    raise exception 'Merge blocked: products have different brands';
  end if;

  if lower(btrim(coalesce(canonical_product.category, '')))
     <> lower(btrim(coalesce(candidate_product.category, ''))) then
    raise exception 'Merge blocked: products have different categories';
  end if;

  if canonical_product.servings is not null
     and candidate_product.servings is not null
     and canonical_product.servings <> candidate_product.servings then
    raise exception 'Merge blocked: products have different servings';
  end if;

  select value, dimension
  into canonical_size_value, canonical_size_dimension
  from public.extract_product_size(canonical_product.name)
  limit 1;

  select value, dimension
  into candidate_size_value, candidate_size_dimension
  from public.extract_product_size(candidate_product.name)
  limit 1;

  if canonical_size_value is not null
     and candidate_size_value is not null
     and (
       canonical_size_value <> candidate_size_value
       or canonical_size_dimension <> candidate_size_dimension
     ) then
    raise exception 'Merge blocked: products have different detected sizes';
  end if;

  select coalesce(jsonb_agg(to_jsonb(p) order by p.id), '[]'::jsonb)
  into products_before
  from public.products p
  where p.id in (canonical_id, candidate_id);

  select coalesce(jsonb_agg(to_jsonb(o) order by o.id), '[]'::jsonb)
  into offers_before
  from public.offers o
  where o.product_id in (canonical_id, candidate_id);

  select coalesce(jsonb_agg(to_jsonb(rp) order by rp.id), '[]'::jsonb)
  into retailer_products_before
  from public.retailer_products rp
  where rp.product_id in (canonical_id, candidate_id);

  select coalesce(jsonb_agg(to_jsonb(ph) order by ph.id), '[]'::jsonb)
  into price_history_before
  from public.price_history ph
  join public.offers o
    on o.id = ph.offer_id
  where o.product_id in (canonical_id, candidate_id);

  select coalesce(array_agg(id order by id), '{}')
  into candidate_offer_ids
  from public.offers
  where product_id = candidate_id;

  select coalesce(array_agg(id order by id), '{}')
  into candidate_retailer_product_ids
  from public.retailer_products
  where product_id = candidate_id;

  select count(*)
  into canonical_price_history_before_value
  from public.price_history ph
  join public.offers o
    on o.id = ph.offer_id
  where o.product_id = canonical_id;

  select count(*)
  into candidate_price_history_before_value
  from public.price_history ph
  join public.offers o
    on o.id = ph.offer_id
  where o.product_id = candidate_id;

  total_price_history_before_value :=
    canonical_price_history_before_value + candidate_price_history_before_value;

  select coalesce(array_agg(distinct ph.offer_id order by ph.offer_id), '{}')
  into candidate_price_history_offer_ids
  from public.price_history ph
  join public.offers o
    on o.id = ph.offer_id
  where o.product_id = candidate_id;

  create temporary table if not exists pg_temp.merge_offer_conflicts (
    canonical_offer_id bigint not null,
    candidate_offer_id bigint not null,
    primary key (canonical_offer_id, candidate_offer_id)
  ) on commit drop;

  truncate table pg_temp.merge_offer_conflicts;

  insert into pg_temp.merge_offer_conflicts (
    canonical_offer_id,
    candidate_offer_id
  )
  select canonical_offer.id, candidate_offer.id
  from public.offers candidate_offer
  join public.offers canonical_offer
    on canonical_offer.product_id = canonical_id
   and canonical_offer.retailer_id = candidate_offer.retailer_id
  where candidate_offer.product_id = candidate_id
    and candidate_offer.retailer_id is not null;

  create temporary table if not exists pg_temp.merge_mapping_conflicts (
    canonical_mapping_id bigint not null,
    candidate_mapping_id bigint not null,
    primary key (canonical_mapping_id, candidate_mapping_id)
  ) on commit drop;

  truncate table pg_temp.merge_mapping_conflicts;

  insert into pg_temp.merge_mapping_conflicts (
    canonical_mapping_id,
    candidate_mapping_id
  )
  select canonical_mapping.id, candidate_mapping.id
  from public.retailer_products candidate_mapping
  join public.retailer_products canonical_mapping
    on canonical_mapping.product_id = canonical_id
   and canonical_mapping.retailer_id = candidate_mapping.retailer_id
  where candidate_mapping.product_id = candidate_id;

  if exists (
    select 1
    from pg_temp.merge_offer_conflicts
    group by canonical_offer_id
    having count(*) > 1
  ) then
    raise exception 'Merge blocked: canonical offer appears in multiple conflicts';
  end if;

  if exists (
    select 1
    from pg_temp.merge_offer_conflicts
    group by candidate_offer_id
    having count(*) > 1
  ) then
    raise exception 'Merge blocked: candidate offer appears in multiple conflicts';
  end if;

  if exists (
    select 1
    from pg_temp.merge_mapping_conflicts
    group by canonical_mapping_id
    having count(*) > 1
  ) then
    raise exception 'Merge blocked: canonical retailer_products mapping appears in multiple conflicts';
  end if;

  if exists (
    select 1
    from pg_temp.merge_mapping_conflicts
    group by candidate_mapping_id
    having count(*) > 1
  ) then
    raise exception 'Merge blocked: candidate retailer_products mapping appears in multiple conflicts';
  end if;

  if coalesce(jsonb_typeof(decisions->'offerConflicts'), 'array') <> 'array' then
    raise exception 'offerConflicts must be an array';
  end if;

  if coalesce(jsonb_typeof(decisions->'retailerProductConflicts'), 'array') <> 'array' then
    raise exception 'retailerProductConflicts must be an array';
  end if;

  select count(*)
  into conflict_count
  from pg_temp.merge_offer_conflicts;

  select count(*)
  into decision_count
  from jsonb_array_elements(coalesce(decisions->'offerConflicts', '[]'::jsonb));

  if decision_count <> conflict_count then
    raise exception 'Offer conflict decisions must exactly match detected conflicts';
  end if;

  select count(*)
  into conflict_count
  from pg_temp.merge_mapping_conflicts;

  select count(*)
  into decision_count
  from jsonb_array_elements(coalesce(decisions->'retailerProductConflicts', '[]'::jsonb));

  if decision_count <> conflict_count then
    raise exception 'Retailer product conflict decisions must exactly match detected conflicts';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(decisions->'offerConflicts', '[]'::jsonb)) item
    where jsonb_typeof(item) <> 'object'
       or coalesce(item->>'decision', '') not in (
         'keep_canonical',
         'keep_candidate'
       )
       or coalesce(item->>'canonicalOfferId', '') !~ '^[1-9][0-9]*$'
       or coalesce(item->>'candidateOfferId', '') !~ '^[1-9][0-9]*$'
  ) then
    raise exception 'Invalid offer conflict decision';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(decisions->'retailerProductConflicts', '[]'::jsonb)) item
    where jsonb_typeof(item) <> 'object'
       or coalesce(item->>'decision', '') not in (
         'keep_canonical',
         'keep_candidate'
       )
       or coalesce(item->>'canonicalMappingId', '') !~ '^[1-9][0-9]*$'
       or coalesce(item->>'candidateMappingId', '') !~ '^[1-9][0-9]*$'
  ) then
    raise exception 'Invalid retailer product conflict decision';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(decisions->'offerConflicts', '[]'::jsonb)) item
    left join pg_temp.merge_offer_conflicts conflict
      on conflict.canonical_offer_id = (item->>'canonicalOfferId')::bigint
     and conflict.candidate_offer_id = (item->>'candidateOfferId')::bigint
    where conflict.canonical_offer_id is null
  ) then
    raise exception 'Offer conflict decision does not match a detected conflict';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(decisions->'offerConflicts', '[]'::jsonb)) item
    group by (item->>'canonicalOfferId')::bigint, (item->>'candidateOfferId')::bigint
    having count(*) > 1
  ) then
    raise exception 'Duplicate offer conflict decision';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(decisions->'retailerProductConflicts', '[]'::jsonb)) item
    left join pg_temp.merge_mapping_conflicts conflict
      on conflict.canonical_mapping_id = (item->>'canonicalMappingId')::bigint
     and conflict.candidate_mapping_id = (item->>'candidateMappingId')::bigint
    where conflict.canonical_mapping_id is null
  ) then
    raise exception 'Retailer product conflict decision does not match a detected conflict';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(decisions->'retailerProductConflicts', '[]'::jsonb)) item
    group by (item->>'canonicalMappingId')::bigint, (item->>'candidateMappingId')::bigint
    having count(*) > 1
  ) then
    raise exception 'Duplicate retailer product conflict decision';
  end if;

  create temporary table if not exists pg_temp.merge_deleted_offers (
    offer_id bigint primary key
  ) on commit drop;

  truncate table pg_temp.merge_deleted_offers;

  insert into pg_temp.merge_deleted_offers (offer_id)
  select
    case item->>'decision'
      when 'keep_canonical' then (item->>'candidateOfferId')::bigint
      when 'keep_candidate' then (item->>'canonicalOfferId')::bigint
    end
  from jsonb_array_elements(coalesce(decisions->'offerConflicts', '[]'::jsonb)) item;

  create temporary table if not exists pg_temp.merge_kept_offers (
    offer_id bigint primary key
  ) on commit drop;

  truncate table pg_temp.merge_kept_offers;

  insert into pg_temp.merge_kept_offers (offer_id)
  select id
  from public.offers
  where product_id in (canonical_id, candidate_id)
    and id not in (
      select offer_id
      from pg_temp.merge_deleted_offers
    );

  if exists (
    select 1
    from pg_temp.merge_kept_offers kept
    join public.offers kept_offer
      on kept_offer.id = kept.offer_id
    where kept_offer.retailer_id is null
       or nullif(btrim(coalesce(kept_offer.url, '')), '') is null
  ) then
    raise exception 'Merge blocked: kept offer is missing retailer_id or URL';
  end if;

  if exists (
    select 1
    from pg_temp.merge_kept_offers kept
    join public.offers kept_offer
      on kept_offer.id = kept.offer_id
    join public.offers other_offer
      on other_offer.id <> kept_offer.id
     and other_offer.retailer_id = kept_offer.retailer_id
     and nullif(btrim(coalesce(other_offer.url, '')), '')
       = nullif(btrim(coalesce(kept_offer.url, '')), '')
    where other_offer.id not in (
      select offer_id
      from pg_temp.merge_deleted_offers
    )
  ) then
    raise exception 'Merge blocked: kept offer URL conflicts with another offer';
  end if;

  create temporary table if not exists pg_temp.merge_deleted_mappings (
    mapping_id bigint primary key
  ) on commit drop;

  truncate table pg_temp.merge_deleted_mappings;

  insert into pg_temp.merge_deleted_mappings (mapping_id)
  select
    case item->>'decision'
      when 'keep_canonical' then (item->>'candidateMappingId')::bigint
      when 'keep_candidate' then (item->>'canonicalMappingId')::bigint
    end
  from jsonb_array_elements(coalesce(decisions->'retailerProductConflicts', '[]'::jsonb)) item;

  create temporary table if not exists pg_temp.merge_kept_mappings (
    mapping_id bigint primary key
  ) on commit drop;

  truncate table pg_temp.merge_kept_mappings;

  insert into pg_temp.merge_kept_mappings (mapping_id)
  select id
  from public.retailer_products
  where product_id in (canonical_id, candidate_id)
    and id not in (
      select mapping_id
      from pg_temp.merge_deleted_mappings
    );

  if exists (
    select 1
    from pg_temp.merge_kept_mappings kept
    join public.retailer_products kept_mapping
      on kept_mapping.id = kept.mapping_id
    where nullif(btrim(coalesce(kept_mapping.external_url, '')), '') is null
  ) then
    raise exception 'Merge blocked: kept retailer_products mapping is missing external_url';
  end if;

  if exists (
    select 1
    from pg_temp.merge_kept_mappings kept
    join public.retailer_products kept_mapping
      on kept_mapping.id = kept.mapping_id
    join public.retailer_products other_mapping
      on other_mapping.id <> kept_mapping.id
     and other_mapping.retailer_id = kept_mapping.retailer_id
     and other_mapping.external_url = kept_mapping.external_url
    where other_mapping.id not in (
      select mapping_id
      from pg_temp.merge_deleted_mappings
    )
  ) then
    raise exception 'Merge blocked: kept retailer_products external_url conflicts with another mapping';
  end if;

  for offer_decision in
    select
      (item->>'canonicalOfferId')::bigint as canonical_offer_id,
      (item->>'candidateOfferId')::bigint as candidate_offer_id,
      item->>'decision' as decision
    from jsonb_array_elements(coalesce(decisions->'offerConflicts', '[]'::jsonb)) item
    order by (item->>'canonicalOfferId')::bigint, (item->>'candidateOfferId')::bigint
  loop
    if offer_decision.decision = 'keep_canonical' then
      update public.price_history
      set offer_id = offer_decision.canonical_offer_id
      where offer_id = offer_decision.candidate_offer_id;

      get diagnostics reassigned_count = row_count;
      total_reassigned_count := total_reassigned_count + reassigned_count;

      delete from public.offers
      where id = offer_decision.candidate_offer_id
        and product_id = candidate_id;

      if not found then
        raise exception 'Candidate offer % could not be deleted',
          offer_decision.candidate_offer_id;
      end if;

      conflict_kept_offer_ids_value := array_append(
        conflict_kept_offer_ids_value,
        offer_decision.canonical_offer_id
      );
      conflict_deleted_offer_ids_value := array_append(
        conflict_deleted_offer_ids_value,
        offer_decision.candidate_offer_id
      );
    elsif offer_decision.decision = 'keep_candidate' then
      update public.price_history
      set offer_id = offer_decision.candidate_offer_id
      where offer_id = offer_decision.canonical_offer_id;

      get diagnostics reassigned_count = row_count;
      total_reassigned_count := total_reassigned_count + reassigned_count;

      delete from public.offers
      where id = offer_decision.canonical_offer_id
        and product_id = canonical_id;

      if not found then
        raise exception 'Canonical offer % could not be deleted',
          offer_decision.canonical_offer_id;
      end if;

      update public.offers
      set product_id = canonical_id
      where id = offer_decision.candidate_offer_id
        and product_id = candidate_id;

      if not found then
        raise exception 'Candidate offer % could not be moved',
          offer_decision.candidate_offer_id;
      end if;

      moved_offer_ids := array_append(moved_offer_ids, offer_decision.candidate_offer_id);
      conflict_kept_offer_ids_value := array_append(
        conflict_kept_offer_ids_value,
        offer_decision.candidate_offer_id
      );
      conflict_deleted_offer_ids_value := array_append(
        conflict_deleted_offer_ids_value,
        offer_decision.canonical_offer_id
      );
    end if;
  end loop;

  with moved_non_conflicting_offers as (
    update public.offers
    set product_id = canonical_id
    where product_id = candidate_id
      and id not in (
        select candidate_offer_id
        from pg_temp.merge_offer_conflicts
      )
    returning id
  )
  select coalesce(array_agg(id order by id), '{}')
  into moved_offer_ids
  from (
    select unnest(moved_offer_ids) as id
    union all
    select id from moved_non_conflicting_offers
  ) moved_offer_list;

  if exists (
    select 1
    from public.price_history
    where offer_id = any(conflict_deleted_offer_ids_value)
  ) then
    raise exception 'Merge blocked: price_history still references deleted offers';
  end if;

  for mapping_decision in
    select
      (item->>'canonicalMappingId')::bigint as canonical_mapping_id,
      (item->>'candidateMappingId')::bigint as candidate_mapping_id,
      item->>'decision' as decision
    from jsonb_array_elements(coalesce(decisions->'retailerProductConflicts', '[]'::jsonb)) item
    order by (item->>'canonicalMappingId')::bigint, (item->>'candidateMappingId')::bigint
  loop
    if mapping_decision.decision = 'keep_canonical' then
      delete from public.retailer_products
      where id = mapping_decision.candidate_mapping_id
        and product_id = candidate_id;

      if not found then
        raise exception 'Candidate retailer_products mapping % could not be deleted',
          mapping_decision.candidate_mapping_id;
      end if;

      conflict_kept_retailer_product_ids_value := array_append(
        conflict_kept_retailer_product_ids_value,
        mapping_decision.canonical_mapping_id
      );
      conflict_deleted_retailer_product_ids_value := array_append(
        conflict_deleted_retailer_product_ids_value,
        mapping_decision.candidate_mapping_id
      );
    elsif mapping_decision.decision = 'keep_candidate' then
      delete from public.retailer_products
      where id = mapping_decision.canonical_mapping_id
        and product_id = canonical_id;

      if not found then
        raise exception 'Canonical retailer_products mapping % could not be deleted',
          mapping_decision.canonical_mapping_id;
      end if;

      update public.retailer_products
      set product_id = canonical_id
      where id = mapping_decision.candidate_mapping_id
        and product_id = candidate_id;

      if not found then
        raise exception 'Candidate retailer_products mapping % could not be moved',
          mapping_decision.candidate_mapping_id;
      end if;

      moved_retailer_product_ids := array_append(
        moved_retailer_product_ids,
        mapping_decision.candidate_mapping_id
      );
      conflict_kept_retailer_product_ids_value := array_append(
        conflict_kept_retailer_product_ids_value,
        mapping_decision.candidate_mapping_id
      );
      conflict_deleted_retailer_product_ids_value := array_append(
        conflict_deleted_retailer_product_ids_value,
        mapping_decision.canonical_mapping_id
      );
    end if;
  end loop;

  with moved_non_conflicting_mappings as (
    update public.retailer_products
    set product_id = canonical_id
    where product_id = candidate_id
      and id not in (
        select candidate_mapping_id
        from pg_temp.merge_mapping_conflicts
      )
    returning id
  )
  select coalesce(array_agg(id order by id), '{}')
  into moved_retailer_product_ids
  from (
    select unnest(moved_retailer_product_ids) as id
    union all
    select id from moved_non_conflicting_mappings
  ) moved_mapping_list;

  select count(*)
  into deleted_reference_count
  from public.price_history
  where offer_id = any(conflict_deleted_offer_ids_value);

  if deleted_reference_count <> 0 then
    raise exception 'Merge blocked: deleted offers still have price_history references';
  end if;

  select count(*)
  into total_price_history_after_value
  from public.price_history ph
  join public.offers o
    on o.id = ph.offer_id
  where o.product_id = canonical_id;

  if total_price_history_after_value <> total_price_history_before_value then
    raise exception 'Merge blocked: price_history count changed during merge';
  end if;

  select count(*)
  into remaining_candidate_offers
  from public.offers
  where product_id = candidate_id;

  if remaining_candidate_offers <> 0 then
    raise exception 'Merge blocked: candidate product still has offers';
  end if;

  select count(*)
  into remaining_candidate_mappings
  from public.retailer_products
  where product_id = candidate_id;

  if remaining_candidate_mappings <> 0 then
    raise exception 'Merge blocked: candidate product still has retailer_products';
  end if;

  update public.products
  set
    merged_into_product_id = canonical_id,
    merged_at = merged_at_value,
    is_active = false
  where id = candidate_id;

  insert into public.product_merge_history (
    canonical_product_id,
    candidate_product_id,
    merged_at,
    offers_moved,
    retailer_products_moved,
    price_history_preserved,
    moved_offer_ids,
    moved_retailer_product_ids,
    candidate_offer_ids,
    price_history_offer_ids,
    snapshot,
    source,
    conflict_kept_offer_ids,
    conflict_deleted_offer_ids,
    conflict_kept_retailer_product_ids,
    conflict_deleted_retailer_product_ids,
    canonical_price_history_before,
    candidate_price_history_before,
    total_price_history_after,
    price_history_reassigned,
    admin_decisions
  )
  values (
    canonical_id,
    candidate_id,
    merged_at_value,
    cardinality(moved_offer_ids),
    cardinality(moved_retailer_product_ids),
    candidate_price_history_before_value,
    moved_offer_ids,
    moved_retailer_product_ids,
    candidate_offer_ids,
    candidate_price_history_offer_ids,
    jsonb_build_object(
      'products_before', products_before,
      'offers_before', offers_before,
      'retailer_products_before', retailer_products_before,
      'price_history_before', price_history_before,
      'canonical_price_history_before', canonical_price_history_before_value,
      'candidate_price_history_before', candidate_price_history_before_value,
      'total_price_history_before', total_price_history_before_value,
      'total_price_history_after', total_price_history_after_value,
      'offer_conflicts', (
        select coalesce(jsonb_agg(to_jsonb(c) order by c.canonical_offer_id, c.candidate_offer_id), '[]'::jsonb)
        from pg_temp.merge_offer_conflicts c
      ),
      'retailer_product_conflicts', (
        select coalesce(jsonb_agg(to_jsonb(c) order by c.canonical_mapping_id, c.candidate_mapping_id), '[]'::jsonb)
        from pg_temp.merge_mapping_conflicts c
      ),
      'admin_decisions', decisions,
      'conflict_kept_offer_ids', conflict_kept_offer_ids_value,
      'conflict_deleted_offer_ids', conflict_deleted_offer_ids_value,
      'conflict_kept_retailer_product_ids', conflict_kept_retailer_product_ids_value,
      'conflict_deleted_retailer_product_ids', conflict_deleted_retailer_product_ids_value,
      'price_history_reassigned', total_reassigned_count,
      'merged_at', merged_at_value,
      'source', 'admin_merge_rpc_with_decisions'
    ),
    'admin_merge_rpc_with_decisions',
    conflict_kept_offer_ids_value,
    conflict_deleted_offer_ids_value,
    conflict_kept_retailer_product_ids_value,
    conflict_deleted_retailer_product_ids_value,
    canonical_price_history_before_value,
    candidate_price_history_before_value,
    total_price_history_after_value,
    total_reassigned_count,
    decisions
  )
  returning id into merge_history_id;

  return jsonb_build_object(
    'merge_history_id', merge_history_id,
    'canonical_product_id', canonical_id,
    'candidate_product_id', candidate_id,
    'merged_at', merged_at_value,
    'offers_moved', cardinality(moved_offer_ids),
    'retailer_products_moved', cardinality(moved_retailer_product_ids),
    'conflict_kept_offer_ids', conflict_kept_offer_ids_value,
    'conflict_deleted_offer_ids', conflict_deleted_offer_ids_value,
    'conflict_kept_retailer_product_ids', conflict_kept_retailer_product_ids_value,
    'conflict_deleted_retailer_product_ids', conflict_deleted_retailer_product_ids_value,
    'canonical_price_history_before', canonical_price_history_before_value,
    'candidate_price_history_before', candidate_price_history_before_value,
    'total_price_history_after', total_price_history_after_value,
    'price_history_reassigned', total_reassigned_count
  );
end;
$_$;


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER TABLE "public"."ignored_duplicate_product_pairs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."offers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."outbound_clicks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."price_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_merge_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_variants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."retailer_products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."retailers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."search_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Allow public read price history" ON "public"."price_history" FOR SELECT TO "anon" USING (true);


CREATE POLICY "Public can read offers" ON "public"."offers" FOR SELECT TO "anon" USING (true);


CREATE POLICY "Public can read products" ON "public"."products" FOR SELECT USING (true);


CREATE POLICY "Public can read retailers" ON "public"."retailers" FOR SELECT TO "anon" USING (true);


GRANT USAGE ON SCHEMA "public" TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "anon";


GRANT USAGE ON SCHEMA "public" TO "authenticated";


GRANT USAGE ON SCHEMA "public" TO "service_role";


REVOKE ALL ON FUNCTION "public"."extract_product_size"("product_name" "text") FROM PUBLIC;


REVOKE ALL ON FUNCTION "public"."merge_products"("canonical_id" bigint, "candidate_id" bigint) FROM PUBLIC;


GRANT ALL ON FUNCTION "public"."merge_products"("canonical_id" bigint, "candidate_id" bigint) TO "service_role";


REVOKE ALL ON FUNCTION "public"."merge_products_with_decisions"("canonical_id" bigint, "candidate_id" bigint, "decisions" "jsonb") FROM PUBLIC;


GRANT ALL ON FUNCTION "public"."merge_products_with_decisions"("canonical_id" bigint, "candidate_id" bigint, "decisions" "jsonb") TO "service_role";


REVOKE EXECUTE ON FUNCTION "public"."rls_auto_enable"() FROM PUBLIC;


REVOKE EXECUTE ON FUNCTION "public"."rls_auto_enable"() FROM "anon";


REVOKE EXECUTE ON FUNCTION "public"."rls_auto_enable"() FROM "authenticated";


GRANT EXECUTE ON FUNCTION "public"."rls_auto_enable"() TO "postgres";


GRANT EXECUTE ON FUNCTION "public"."rls_auto_enable"() TO "service_role";


GRANT ALL ON TABLE "public"."ignored_duplicate_product_pairs" TO "anon";


GRANT ALL ON TABLE "public"."ignored_duplicate_product_pairs" TO "authenticated";


GRANT ALL ON TABLE "public"."ignored_duplicate_product_pairs" TO "service_role";


GRANT ALL ON SEQUENCE "public"."ignored_duplicate_product_pairs_id_seq" TO "anon";


GRANT ALL ON SEQUENCE "public"."ignored_duplicate_product_pairs_id_seq" TO "authenticated";


GRANT ALL ON SEQUENCE "public"."ignored_duplicate_product_pairs_id_seq" TO "service_role";


GRANT ALL ON TABLE "public"."offers" TO "anon";


GRANT ALL ON TABLE "public"."offers" TO "authenticated";


GRANT ALL ON TABLE "public"."offers" TO "service_role";


GRANT ALL ON SEQUENCE "public"."offers_id_seq" TO "anon";


GRANT ALL ON SEQUENCE "public"."offers_id_seq" TO "authenticated";


GRANT ALL ON SEQUENCE "public"."offers_id_seq" TO "service_role";


GRANT ALL ON TABLE "public"."outbound_clicks" TO "anon";


GRANT ALL ON TABLE "public"."outbound_clicks" TO "authenticated";


GRANT ALL ON TABLE "public"."outbound_clicks" TO "service_role";


GRANT ALL ON SEQUENCE "public"."outbound_clicks_id_seq" TO "anon";


GRANT ALL ON SEQUENCE "public"."outbound_clicks_id_seq" TO "authenticated";


GRANT ALL ON SEQUENCE "public"."outbound_clicks_id_seq" TO "service_role";


GRANT ALL ON TABLE "public"."price_history" TO "anon";


GRANT ALL ON TABLE "public"."price_history" TO "authenticated";


GRANT ALL ON TABLE "public"."price_history" TO "service_role";


GRANT ALL ON SEQUENCE "public"."price_history_id_seq" TO "anon";


GRANT ALL ON SEQUENCE "public"."price_history_id_seq" TO "authenticated";


GRANT ALL ON SEQUENCE "public"."price_history_id_seq" TO "service_role";


GRANT ALL ON TABLE "public"."product_merge_history" TO "anon";


GRANT ALL ON TABLE "public"."product_merge_history" TO "authenticated";


GRANT ALL ON TABLE "public"."product_merge_history" TO "service_role";


GRANT ALL ON SEQUENCE "public"."product_merge_history_id_seq" TO "anon";


GRANT ALL ON SEQUENCE "public"."product_merge_history_id_seq" TO "authenticated";


GRANT ALL ON SEQUENCE "public"."product_merge_history_id_seq" TO "service_role";


GRANT ALL ON TABLE "public"."product_variants" TO "anon";


GRANT ALL ON TABLE "public"."product_variants" TO "authenticated";


GRANT ALL ON TABLE "public"."product_variants" TO "service_role";


GRANT ALL ON SEQUENCE "public"."product_variants_id_seq" TO "anon";


GRANT ALL ON SEQUENCE "public"."product_variants_id_seq" TO "authenticated";


GRANT ALL ON SEQUENCE "public"."product_variants_id_seq" TO "service_role";


GRANT ALL ON TABLE "public"."products" TO "anon";


GRANT ALL ON TABLE "public"."products" TO "authenticated";


GRANT ALL ON TABLE "public"."products" TO "service_role";


GRANT ALL ON SEQUENCE "public"."products_id_seq" TO "anon";


GRANT ALL ON SEQUENCE "public"."products_id_seq" TO "authenticated";


GRANT ALL ON SEQUENCE "public"."products_id_seq" TO "service_role";


GRANT ALL ON TABLE "public"."retailer_products" TO "anon";


GRANT ALL ON TABLE "public"."retailer_products" TO "authenticated";


GRANT ALL ON TABLE "public"."retailer_products" TO "service_role";


GRANT ALL ON SEQUENCE "public"."retailer_products_id_seq" TO "anon";


GRANT ALL ON SEQUENCE "public"."retailer_products_id_seq" TO "authenticated";


GRANT ALL ON SEQUENCE "public"."retailer_products_id_seq" TO "service_role";


GRANT ALL ON TABLE "public"."retailers" TO "anon";


GRANT ALL ON TABLE "public"."retailers" TO "authenticated";


GRANT ALL ON TABLE "public"."retailers" TO "service_role";


GRANT ALL ON SEQUENCE "public"."retailers_id_seq" TO "anon";


GRANT ALL ON SEQUENCE "public"."retailers_id_seq" TO "authenticated";


GRANT ALL ON SEQUENCE "public"."retailers_id_seq" TO "service_role";


GRANT ALL ON TABLE "public"."search_events" TO "anon";


GRANT ALL ON TABLE "public"."search_events" TO "authenticated";


GRANT ALL ON TABLE "public"."search_events" TO "service_role";


GRANT ALL ON SEQUENCE "public"."search_events_id_seq" TO "anon";


GRANT ALL ON SEQUENCE "public"."search_events_id_seq" TO "authenticated";


GRANT ALL ON SEQUENCE "public"."search_events_id_seq" TO "service_role";


ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";


ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";


ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";


ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";


ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";


ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";


ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";


ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";


ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";


ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


CREATE EVENT TRIGGER ensure_rls
    ON ddl_command_end
    WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
    EXECUTE FUNCTION public.rls_auto_enable();
