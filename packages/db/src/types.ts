// GENERATED FILE — do not edit. Source: the migration chain in supabase/migrations, via
// `supabase gen types typescript --schema public` (Supabase CLI 3.1.0) formatted with Prettier.
// Regenerate: `pnpm db:gen-types`. CI's `db` job fails when this file drifts from the migrations.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      ai_budgets: {
        Row: {
          alert_threshold_pct: number;
          created_at: string;
          monthly_cap_nano_usd: number;
          note: string | null;
          org_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          alert_threshold_pct?: number;
          created_at?: string;
          monthly_cap_nano_usd: number;
          note?: string | null;
          org_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          alert_threshold_pct?: number;
          created_at?: string;
          monthly_cap_nano_usd?: number;
          note?: string | null;
          org_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ai_budgets_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_extractions: {
        Row: {
          ai_run_id: string;
          anchors: NonNullable<Json>;
          created_at: string;
          document_id: string;
          field_confidence: NonNullable<Json>;
          flags: string[];
          id: string;
          org_id: string;
          prompt_template_id: string | null;
          raw_output: Json | null;
          schema_name: string;
          schema_version: string;
          validated_output: Json | null;
          validation_errors: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          ai_run_id: string;
          anchors?: NonNullable<Json>;
          created_at?: string;
          document_id: string;
          field_confidence?: NonNullable<Json>;
          flags?: string[];
          id?: string;
          org_id: string;
          prompt_template_id?: string | null;
          raw_output?: Json | null;
          schema_name: string;
          schema_version: string;
          validated_output?: Json | null;
          validation_errors?: NonNullable<Json>;
        };
        Update: {
          ai_run_id?: string;
          anchors?: NonNullable<Json>;
          created_at?: string;
          document_id?: string;
          field_confidence?: NonNullable<Json>;
          flags?: string[];
          id?: string;
          org_id?: string;
          prompt_template_id?: string | null;
          raw_output?: Json | null;
          schema_name?: string;
          schema_version?: string;
          validated_output?: Json | null;
          validation_errors?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: "ai_extractions_ai_run_id_fkey";
            columns: ["ai_run_id"];
            isOneToOne: false;
            referencedRelation: "ai_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_extractions_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_extractions_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_extractions_prompt_template_id_fkey";
            columns: ["prompt_template_id"];
            isOneToOne: false;
            referencedRelation: "prompt_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_runs: {
        Row: {
          at: string;
          attempts: number;
          cache_creation_input_tokens: number;
          cache_read_input_tokens: number;
          cost_nano_usd: number;
          cost_usd: number | null;
          error: string | null;
          flags: string[];
          id: string;
          input_hash: string | null;
          input_tokens: number;
          job_id: string | null;
          latency_ms: number;
          model: string;
          org_id: string;
          output_tokens: number;
          prompt_template_id: string;
          prompt_version: string;
          provider: string;
          purpose: string;
          request_id: string | null;
          status: string;
          triggered_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          at?: string;
          attempts?: number;
          cache_creation_input_tokens?: number;
          cache_read_input_tokens?: number;
          cost_nano_usd?: number;
          cost_usd?: never;
          error?: string | null;
          flags?: string[];
          id?: string;
          input_hash?: string | null;
          input_tokens?: number;
          job_id?: string | null;
          latency_ms?: number;
          model: string;
          org_id: string;
          output_tokens?: number;
          prompt_template_id: string;
          prompt_version: string;
          provider: string;
          purpose: string;
          request_id?: string | null;
          status: string;
          triggered_by?: string | null;
        };
        Update: {
          at?: string;
          attempts?: number;
          cache_creation_input_tokens?: number;
          cache_read_input_tokens?: number;
          cost_nano_usd?: number;
          cost_usd?: never;
          error?: string | null;
          flags?: string[];
          id?: string;
          input_hash?: string | null;
          input_tokens?: number;
          job_id?: string | null;
          latency_ms?: number;
          model?: string;
          org_id?: string;
          output_tokens?: number;
          prompt_template_id?: string;
          prompt_version?: string;
          provider?: string;
          purpose?: string;
          request_id?: string | null;
          status?: string;
          triggered_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ai_runs_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      attribute_definitions: {
        Row: {
          allowed_values: Json | null;
          code: string;
          created_at: string;
          data_type: string;
          id: string;
          is_hard_default: boolean;
          label_en: string;
          label_zh: string;
          required: boolean;
          sort_order: number;
          taxonomy_id: string;
          tolerance: number | null;
          unit: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          allowed_values?: Json | null;
          code: string;
          created_at?: string;
          data_type: string;
          id?: string;
          is_hard_default?: boolean;
          label_en: string;
          label_zh: string;
          required?: boolean;
          sort_order?: number;
          taxonomy_id: string;
          tolerance?: number | null;
          unit?: string | null;
          updated_at?: string;
        };
        Update: {
          allowed_values?: Json | null;
          code?: string;
          created_at?: string;
          data_type?: string;
          id?: string;
          is_hard_default?: boolean;
          label_en?: string;
          label_zh?: string;
          required?: boolean;
          sort_order?: number;
          taxonomy_id?: string;
          tolerance?: number | null;
          unit?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attribute_definitions_taxonomy_id_fkey";
            columns: ["taxonomy_id"];
            isOneToOne: false;
            referencedRelation: "product_taxonomy";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_events: {
        Row: {
          acting_as: string;
          action: string;
          actor_org_id: string | null;
          actor_user_id: string | null;
          after_hash: string | null;
          at: string;
          before_hash: string | null;
          diff: Json | null;
          entity_id: string | null;
          entity_org_id: string | null;
          entity_table: string;
          id: string;
          ip_hash: string | null;
          request_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          acting_as: string;
          action: string;
          actor_org_id?: string | null;
          actor_user_id?: string | null;
          after_hash?: string | null;
          at?: string;
          before_hash?: string | null;
          diff?: Json | null;
          entity_id?: string | null;
          entity_org_id?: string | null;
          entity_table: string;
          id?: string;
          ip_hash?: string | null;
          request_id?: string | null;
        };
        Update: {
          acting_as?: string;
          action?: string;
          actor_org_id?: string | null;
          actor_user_id?: string | null;
          after_hash?: string | null;
          at?: string;
          before_hash?: string | null;
          diff?: Json | null;
          entity_id?: string | null;
          entity_org_id?: string | null;
          entity_table?: string;
          id?: string;
          ip_hash?: string | null;
          request_id?: string | null;
        };
        Relationships: [];
      };
      brief_items: {
        Row: {
          brief_id: string;
          compliance_hold: boolean;
          created_at: string;
          id: string;
          line_no: number;
          notes: string | null;
          org_id: string;
          project_id: string;
          quantity: number;
          quantity_unit: string;
          specification_id: string | null;
          target_currency: string;
          target_unit_price: number | null;
          taxonomy_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          brief_id: string;
          compliance_hold?: boolean;
          created_at?: string;
          id?: string;
          line_no: number;
          notes?: string | null;
          org_id: string;
          project_id: string;
          quantity: number;
          quantity_unit: string;
          specification_id?: string | null;
          target_currency?: string;
          target_unit_price?: number | null;
          taxonomy_id: string;
          updated_at?: string;
        };
        Update: {
          brief_id?: string;
          compliance_hold?: boolean;
          created_at?: string;
          id?: string;
          line_no?: number;
          notes?: string | null;
          org_id?: string;
          project_id?: string;
          quantity?: number;
          quantity_unit?: string;
          specification_id?: string | null;
          target_currency?: string;
          target_unit_price?: number | null;
          taxonomy_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brief_items_brief_id_fkey";
            columns: ["brief_id"];
            isOneToOne: false;
            referencedRelation: "buyer_briefs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "brief_items_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "brief_items_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "sourcing_projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "brief_items_specification_id_fkey";
            columns: ["specification_id"];
            isOneToOne: false;
            referencedRelation: "product_specifications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "brief_items_taxonomy_id_fkey";
            columns: ["taxonomy_id"];
            isOneToOne: false;
            referencedRelation: "product_taxonomy";
            referencedColumns: ["id"];
          },
        ];
      };
      buyer_briefs: {
        Row: {
          ai_proposal: Json | null;
          ai_run_id: string | null;
          confirmed_spec_id: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          org_id: string;
          project_id: string;
          raw_input_en: string | null;
          raw_input_zh: string | null;
          status: string;
          updated_at: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          ai_proposal?: Json | null;
          ai_run_id?: string | null;
          confirmed_spec_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          org_id: string;
          project_id: string;
          raw_input_en?: string | null;
          raw_input_zh?: string | null;
          status?: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          ai_proposal?: Json | null;
          ai_run_id?: string | null;
          confirmed_spec_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          org_id?: string;
          project_id?: string;
          raw_input_en?: string | null;
          raw_input_zh?: string | null;
          status?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "buyer_briefs_ai_run_id_fkey";
            columns: ["ai_run_id"];
            isOneToOne: false;
            referencedRelation: "ai_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "buyer_briefs_confirmed_spec_id_fkey";
            columns: ["confirmed_spec_id"];
            isOneToOne: false;
            referencedRelation: "product_specifications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "buyer_briefs_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "buyer_briefs_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "sourcing_projects";
            referencedColumns: ["id"];
          },
        ];
      };
      comparison_snapshots: {
        Row: {
          as_of: string;
          brief_item_id: string;
          engine_version: string;
          fx_rate_ids: string[];
          generated_at: string;
          generated_by: string | null;
          id: string;
          inputs_hash: string;
          org_id: string;
          project_id: string;
          quantity: number;
          quantity_unit: string;
          result: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          as_of: string;
          brief_item_id: string;
          engine_version: string;
          fx_rate_ids?: string[];
          generated_at?: string;
          generated_by?: string | null;
          id?: string;
          inputs_hash: string;
          org_id: string;
          project_id: string;
          quantity: number;
          quantity_unit: string;
          result: NonNullable<Json>;
        };
        Update: {
          as_of?: string;
          brief_item_id?: string;
          engine_version?: string;
          fx_rate_ids?: string[];
          generated_at?: string;
          generated_by?: string | null;
          id?: string;
          inputs_hash?: string;
          org_id?: string;
          project_id?: string;
          quantity?: number;
          quantity_unit?: string;
          result?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: "comparison_snapshots_brief_item_id_fkey";
            columns: ["brief_item_id"];
            isOneToOne: false;
            referencedRelation: "brief_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comparison_snapshots_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comparison_snapshots_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "sourcing_projects";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_disclosure_grants: {
        Row: {
          buyer_org_id: string;
          created_at: string;
          expires_at: string | null;
          granted_at: string;
          granted_by: string;
          id: string;
          reason: string;
          revoke_reason: string | null;
          revoked_at: string | null;
          revoked_by: string | null;
          supplier_contact_id: string;
        };
        ComputedFields: never;
        Insert: {
          buyer_org_id: string;
          created_at?: string;
          expires_at?: string | null;
          granted_at?: string;
          granted_by?: string;
          id?: string;
          reason: string;
          revoke_reason?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          supplier_contact_id: string;
        };
        Update: {
          buyer_org_id?: string;
          created_at?: string;
          expires_at?: string | null;
          granted_at?: string;
          granted_by?: string;
          id?: string;
          reason?: string;
          revoke_reason?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          supplier_contact_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contact_disclosure_grants_buyer_org_id_fkey";
            columns: ["buyer_org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_disclosure_grants_supplier_contact_id_fkey";
            columns: ["supplier_contact_id"];
            isOneToOne: false;
            referencedRelation: "supplier_contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      document_access_log: {
        Row: {
          action: string;
          at: string;
          document_id: string;
          id: string;
          ip_hash: string | null;
          org_id: string | null;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          at?: string;
          document_id: string;
          id?: string;
          ip_hash?: string | null;
          org_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          at?: string;
          document_id?: string;
          id?: string;
          ip_hash?: string | null;
          org_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "document_access_log_document_fk";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_access_log_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      document_cells: {
        Row: {
          col_no: number;
          created_at: string;
          document_id: string;
          id: string;
          org_id: string;
          parsed: Json | null;
          raw: string | null;
          row_no: number;
          sheet: string;
        };
        ComputedFields: never;
        Insert: {
          col_no: number;
          created_at?: string;
          document_id: string;
          id?: string;
          org_id: string;
          parsed?: Json | null;
          raw?: string | null;
          row_no: number;
          sheet: string;
        };
        Update: {
          col_no?: number;
          created_at?: string;
          document_id?: string;
          id?: string;
          org_id?: string;
          parsed?: Json | null;
          raw?: string | null;
          row_no?: number;
          sheet?: string;
        };
        Relationships: [
          {
            foreignKeyName: "document_cells_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_cells_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      document_pages: {
        Row: {
          created_at: string;
          document_id: string;
          id: string;
          layout: Json | null;
          ocr_run_id: string | null;
          org_id: string;
          page_no: number;
          text: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          document_id: string;
          id?: string;
          layout?: Json | null;
          ocr_run_id?: string | null;
          org_id: string;
          page_no: number;
          text?: string | null;
        };
        Update: {
          created_at?: string;
          document_id?: string;
          id?: string;
          layout?: Json | null;
          ocr_run_id?: string | null;
          org_id?: string;
          page_no?: number;
          text?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "document_pages_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_pages_ocr_run_id_fkey";
            columns: ["ocr_run_id"];
            isOneToOne: false;
            referencedRelation: "ai_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_pages_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          bytes: number;
          created_at: string;
          id: string;
          mime: string;
          org_id: string;
          original_filename: string;
          page_count: number | null;
          project_id: string | null;
          rejected_reason: string | null;
          retention_class: string;
          rights_class: Database["public"]["Enums"]["rights_class"];
          scan_result: Json | null;
          sha256: string | null;
          source_permission_id: string | null;
          source_type: Database["public"]["Enums"]["source_type"];
          status: Database["public"]["Enums"]["document_status"];
          storage_bucket: string;
          storage_path: string;
          supplier_id: string | null;
          updated_at: string;
          uploaded_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          bytes: number;
          created_at?: string;
          id?: string;
          mime: string;
          org_id: string;
          original_filename: string;
          page_count?: number | null;
          project_id?: string | null;
          rejected_reason?: string | null;
          retention_class?: string;
          rights_class: Database["public"]["Enums"]["rights_class"];
          scan_result?: Json | null;
          sha256?: string | null;
          source_permission_id?: string | null;
          source_type: Database["public"]["Enums"]["source_type"];
          status?: Database["public"]["Enums"]["document_status"];
          storage_bucket?: string;
          storage_path: string;
          supplier_id?: string | null;
          updated_at?: string;
          uploaded_by?: string | null;
        };
        Update: {
          bytes?: number;
          created_at?: string;
          id?: string;
          mime?: string;
          org_id?: string;
          original_filename?: string;
          page_count?: number | null;
          project_id?: string | null;
          rejected_reason?: string | null;
          retention_class?: string;
          rights_class?: Database["public"]["Enums"]["rights_class"];
          scan_result?: Json | null;
          sha256?: string | null;
          source_permission_id?: string | null;
          source_type?: Database["public"]["Enums"]["source_type"];
          status?: Database["public"]["Enums"]["document_status"];
          storage_bucket?: string;
          storage_path?: string;
          supplier_id?: string | null;
          updated_at?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "documents_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "sourcing_projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_source_permission_id_fkey";
            columns: ["source_permission_id"];
            isOneToOne: false;
            referencedRelation: "source_permissions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_public_profile_v";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_verification_summary_v";
            referencedColumns: ["supplier_id"];
          },
        ];
      };
      duty_assumptions: {
        Row: {
          basis: string;
          brief_item_id: string | null;
          broker_name: string | null;
          created_at: string;
          created_by: string;
          hmf_applies: boolean | null;
          hts_candidate: string | null;
          id: string;
          mpf_applies: boolean | null;
          notes: string | null;
          org_id: string;
          project_id: string;
          rate_pct: number | null;
          reviewed_by_broker: boolean;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          basis: string;
          brief_item_id?: string | null;
          broker_name?: string | null;
          created_at?: string;
          created_by: string;
          hmf_applies?: boolean | null;
          hts_candidate?: string | null;
          id?: string;
          mpf_applies?: boolean | null;
          notes?: string | null;
          org_id: string;
          project_id: string;
          rate_pct?: number | null;
          reviewed_by_broker?: boolean;
          updated_at?: string;
        };
        Update: {
          basis?: string;
          brief_item_id?: string | null;
          broker_name?: string | null;
          created_at?: string;
          created_by?: string;
          hmf_applies?: boolean | null;
          hts_candidate?: string | null;
          id?: string;
          mpf_applies?: boolean | null;
          notes?: string | null;
          org_id?: string;
          project_id?: string;
          rate_pct?: number | null;
          reviewed_by_broker?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "duty_assumptions_brief_item_id_fkey";
            columns: ["brief_item_id"];
            isOneToOne: false;
            referencedRelation: "brief_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "duty_assumptions_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "duty_assumptions_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "sourcing_projects";
            referencedColumns: ["id"];
          },
        ];
      };
      freight_estimates: {
        Row: {
          amount: number;
          created_at: string;
          created_by: string | null;
          currency: string;
          destination: string;
          document_id: string | null;
          id: string;
          mode: string;
          notes: string | null;
          org_id: string;
          origin: string;
          project_id: string;
          provider_name: string | null;
          provider_or_manual: string;
          status: Database["public"]["Enums"]["cost_line_status"];
          updated_at: string;
          valid_until: string | null;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          created_at?: string;
          created_by?: string | null;
          currency: string;
          destination: string;
          document_id?: string | null;
          id?: string;
          mode: string;
          notes?: string | null;
          org_id: string;
          origin: string;
          project_id: string;
          provider_name?: string | null;
          provider_or_manual: string;
          status?: Database["public"]["Enums"]["cost_line_status"];
          updated_at?: string;
          valid_until?: string | null;
        };
        Update: {
          amount?: number;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          destination?: string;
          document_id?: string | null;
          id?: string;
          mode?: string;
          notes?: string | null;
          org_id?: string;
          origin?: string;
          project_id?: string;
          provider_name?: string | null;
          provider_or_manual?: string;
          status?: Database["public"]["Enums"]["cost_line_status"];
          updated_at?: string;
          valid_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "freight_estimates_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "freight_estimates_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "freight_estimates_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "sourcing_projects";
            referencedColumns: ["id"];
          },
        ];
      };
      fx_rates: {
        Row: {
          base: string;
          fetched_at: string;
          id: string;
          is_reference: boolean;
          quote: string;
          rate: number;
          rate_date: string;
          recorded_by: string | null;
          source: string;
        };
        ComputedFields: never;
        Insert: {
          base: string;
          fetched_at?: string;
          id?: string;
          is_reference?: boolean;
          quote: string;
          rate: number;
          rate_date: string;
          recorded_by?: string | null;
          source: string;
        };
        Update: {
          base?: string;
          fetched_at?: string;
          id?: string;
          is_reference?: boolean;
          quote?: string;
          rate?: number;
          rate_date?: string;
          recorded_by?: string | null;
          source?: string;
        };
        Relationships: [];
      };
      human_corrections: {
        Row: {
          after: Json | null;
          at: string;
          before: Json | null;
          corrected_by: string;
          field_path: string;
          id: string;
          reason: string;
          review_task_id: string;
        };
        ComputedFields: never;
        Insert: {
          after?: Json | null;
          at?: string;
          before?: Json | null;
          corrected_by?: string;
          field_path: string;
          id?: string;
          reason: string;
          review_task_id: string;
        };
        Update: {
          after?: Json | null;
          at?: string;
          before?: Json | null;
          corrected_by?: string;
          field_path?: string;
          id?: string;
          reason?: string;
          review_task_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "human_corrections_review_task_id_fkey";
            columns: ["review_task_id"];
            isOneToOne: false;
            referencedRelation: "review_tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      invites: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string;
          org_id: string;
          role: Database["public"]["Enums"]["member_role"];
          token_hash: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email: string;
          expires_at: string;
          id?: string;
          invited_by: string;
          org_id: string;
          role: Database["public"]["Enums"]["member_role"];
          token_hash: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string;
          org_id?: string;
          role?: Database["public"]["Enums"]["member_role"];
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invites_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      job_executions: {
        Row: {
          attempts: number;
          error: string | null;
          finished_at: string | null;
          id: string;
          idempotency_key: string;
          msg_id: number | null;
          payload_hash: string | null;
          queue: string;
          started_at: string;
          status: string;
          worker_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          idempotency_key: string;
          msg_id?: number | null;
          payload_hash?: string | null;
          queue: string;
          started_at?: string;
          status?: string;
          worker_id?: string | null;
        };
        Update: {
          attempts?: number;
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          idempotency_key?: string;
          msg_id?: number | null;
          payload_hash?: string | null;
          queue?: string;
          started_at?: string;
          status?: string;
          worker_id?: string | null;
        };
        Relationships: [];
      };
      jobs_dead_letter: {
        Row: {
          attempts: number;
          created_at: string;
          error: string;
          first_failed_at: string;
          id: string;
          idempotency_key: string | null;
          last_failed_at: string;
          message: NonNullable<Json>;
          msg_id: number | null;
          queue: string;
          resolution: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          attempts: number;
          created_at?: string;
          error: string;
          first_failed_at?: string;
          id?: string;
          idempotency_key?: string | null;
          last_failed_at?: string;
          message: NonNullable<Json>;
          msg_id?: number | null;
          queue: string;
          resolution?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          error?: string;
          first_failed_at?: string;
          id?: string;
          idempotency_key?: string | null;
          last_failed_at?: string;
          message?: NonNullable<Json>;
          msg_id?: number | null;
          queue?: string;
          resolution?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
        };
        Relationships: [];
      };
      landed_cost_scenarios: {
        Row: {
          comparison_snapshot_id: string;
          created_at: string;
          eligible_for_ranking: boolean;
          explanations: string[];
          goods_currency: string | null;
          goods_total: number | null;
          id: string;
          landed_currency: string | null;
          landed_total: number | null;
          lines: NonNullable<Json>;
          org_id: string;
          quotation_id: string;
          total_status: string;
        };
        ComputedFields: never;
        Insert: {
          comparison_snapshot_id: string;
          created_at?: string;
          eligible_for_ranking?: boolean;
          explanations?: string[];
          goods_currency?: string | null;
          goods_total?: number | null;
          id?: string;
          landed_currency?: string | null;
          landed_total?: number | null;
          lines: NonNullable<Json>;
          org_id: string;
          quotation_id: string;
          total_status: string;
        };
        Update: {
          comparison_snapshot_id?: string;
          created_at?: string;
          eligible_for_ranking?: boolean;
          explanations?: string[];
          goods_currency?: string | null;
          goods_total?: number | null;
          id?: string;
          landed_currency?: string | null;
          landed_total?: number | null;
          lines?: NonNullable<Json>;
          org_id?: string;
          quotation_id?: string;
          total_status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "landed_cost_scenarios_comparison_snapshot_id_fkey";
            columns: ["comparison_snapshot_id"];
            isOneToOne: false;
            referencedRelation: "comparison_snapshots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "landed_cost_scenarios_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "landed_cost_scenarios_quotation_id_fkey";
            columns: ["quotation_id"];
            isOneToOne: false;
            referencedRelation: "quotations";
            referencedColumns: ["id"];
          },
        ];
      };
      memberships: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          id: string;
          invited_by: string | null;
          org_id: string;
          role: Database["public"]["Enums"]["member_role"];
          status: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          id?: string;
          invited_by?: string | null;
          org_id: string;
          role: Database["public"]["Enums"]["member_role"];
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          id?: string;
          invited_by?: string | null;
          org_id?: string;
          role?: Database["public"]["Enums"]["member_role"];
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "memberships_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          created_at: string;
          dedupe_key: string | null;
          delivered_via: string[];
          email_sent_at: string | null;
          id: string;
          kind: string;
          org_id: string | null;
          payload: NonNullable<Json>;
          read_at: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          dedupe_key?: string | null;
          delivered_via?: string[];
          email_sent_at?: string | null;
          id?: string;
          kind: string;
          org_id?: string | null;
          payload?: NonNullable<Json>;
          read_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          dedupe_key?: string | null;
          delivered_via?: string[];
          email_sent_at?: string | null;
          id?: string;
          kind?: string;
          org_id?: string | null;
          payload?: NonNullable<Json>;
          read_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          compliance_state: Database["public"]["Enums"]["compliance_state"];
          country: string;
          created_at: string;
          created_by: string | null;
          display_name: string;
          display_name_zh: string | null;
          id: string;
          legal_name: string;
          org_type: Database["public"]["Enums"]["org_type"];
          settings: NonNullable<Json>;
          status: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          compliance_state?: Database["public"]["Enums"]["compliance_state"];
          country?: string;
          created_at?: string;
          created_by?: string | null;
          display_name: string;
          display_name_zh?: string | null;
          id?: string;
          legal_name: string;
          org_type: Database["public"]["Enums"]["org_type"];
          settings?: NonNullable<Json>;
          status?: string;
          updated_at?: string;
        };
        Update: {
          compliance_state?: Database["public"]["Enums"]["compliance_state"];
          country?: string;
          created_at?: string;
          created_by?: string | null;
          display_name?: string;
          display_name_zh?: string | null;
          id?: string;
          legal_name?: string;
          org_type?: Database["public"]["Enums"]["org_type"];
          settings?: NonNullable<Json>;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_specifications: {
        Row: {
          attributes: NonNullable<Json>;
          brief_item_id: string | null;
          confirmed_at: string | null;
          confirmed_by: string | null;
          created_at: string;
          created_by: string | null;
          hard_attribute_codes: string[];
          id: string;
          owner_org_id: string | null;
          source_lang: string | null;
          taxonomy_id: string;
          text_en: string | null;
          text_zh: string | null;
          translation_run_id: string | null;
          variant_id: string | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          attributes: NonNullable<Json>;
          brief_item_id?: string | null;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          hard_attribute_codes?: string[];
          id?: string;
          owner_org_id?: string | null;
          source_lang?: string | null;
          taxonomy_id: string;
          text_en?: string | null;
          text_zh?: string | null;
          translation_run_id?: string | null;
          variant_id?: string | null;
          version?: number;
        };
        Update: {
          attributes?: NonNullable<Json>;
          brief_item_id?: string | null;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          hard_attribute_codes?: string[];
          id?: string;
          owner_org_id?: string | null;
          source_lang?: string | null;
          taxonomy_id?: string;
          text_en?: string | null;
          text_zh?: string | null;
          translation_run_id?: string | null;
          variant_id?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "product_specifications_brief_item_fk";
            columns: ["brief_item_id"];
            isOneToOne: false;
            referencedRelation: "brief_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_specifications_owner_org_id_fkey";
            columns: ["owner_org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_specifications_taxonomy_id_fkey";
            columns: ["taxonomy_id"];
            isOneToOne: false;
            referencedRelation: "product_taxonomy";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_specifications_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      product_taxonomy: {
        Row: {
          code: string;
          compliance_note: string | null;
          compliance_state: Database["public"]["Enums"]["compliance_state"];
          created_at: string;
          id: string;
          name_en: string;
          name_zh: string;
          parent_id: string | null;
          pilot_flag: boolean;
          search_terms_zh: string[];
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          compliance_note?: string | null;
          compliance_state?: Database["public"]["Enums"]["compliance_state"];
          created_at?: string;
          id?: string;
          name_en: string;
          name_zh: string;
          parent_id?: string | null;
          pilot_flag?: boolean;
          search_terms_zh?: string[];
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          code?: string;
          compliance_note?: string | null;
          compliance_state?: Database["public"]["Enums"]["compliance_state"];
          created_at?: string;
          id?: string;
          name_en?: string;
          name_zh?: string;
          parent_id?: string | null;
          pilot_flag?: boolean;
          search_terms_zh?: string[];
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_taxonomy_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "product_taxonomy";
            referencedColumns: ["id"];
          },
        ];
      };
      product_variants: {
        Row: {
          attributes: NonNullable<Json>;
          attributes_hash: string | null;
          created_at: string;
          id: string;
          owner_org_id: string | null;
          product_id: string;
          updated_at: string;
          variant_code: string | null;
        };
        ComputedFields: never;
        Insert: {
          attributes?: NonNullable<Json>;
          attributes_hash?: never;
          created_at?: string;
          id?: string;
          owner_org_id?: string | null;
          product_id: string;
          updated_at?: string;
          variant_code?: string | null;
        };
        Update: {
          attributes?: NonNullable<Json>;
          attributes_hash?: never;
          created_at?: string;
          id?: string;
          owner_org_id?: string | null;
          product_id?: string;
          updated_at?: string;
          variant_code?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_variants_owner_org_id_fkey";
            columns: ["owner_org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_variants_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          canonical_name_en: string;
          canonical_name_zh: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          owner_org_id: string | null;
          status: string;
          taxonomy_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          canonical_name_en: string;
          canonical_name_zh?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          owner_org_id?: string | null;
          status?: string;
          taxonomy_id: string;
          updated_at?: string;
        };
        Update: {
          canonical_name_en?: string;
          canonical_name_zh?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          owner_org_id?: string | null;
          status?: string;
          taxonomy_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_owner_org_id_fkey";
            columns: ["owner_org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_taxonomy_id_fkey";
            columns: ["taxonomy_id"];
            isOneToOne: false;
            referencedRelation: "product_taxonomy";
            referencedColumns: ["id"];
          },
        ];
      };
      project_assignments: {
        Row: {
          active: boolean;
          assigned_by: string;
          created_at: string;
          id: string;
          operator_user_id: string;
          org_id: string;
          project_id: string;
          role: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          assigned_by?: string;
          created_at?: string;
          id?: string;
          operator_user_id: string;
          org_id: string;
          project_id: string;
          role?: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          assigned_by?: string;
          created_at?: string;
          id?: string;
          operator_user_id?: string;
          org_id?: string;
          project_id?: string;
          role?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_assignments_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_assignments_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "sourcing_projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_suppliers: {
        Row: {
          added_by: string;
          created_at: string;
          id: string;
          org_id: string;
          project_id: string;
          reason: string | null;
          status: string;
          supplier_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          added_by?: string;
          created_at?: string;
          id?: string;
          org_id: string;
          project_id: string;
          reason?: string | null;
          status?: string;
          supplier_id: string;
          updated_at?: string;
        };
        Update: {
          added_by?: string;
          created_at?: string;
          id?: string;
          org_id?: string;
          project_id?: string;
          reason?: string | null;
          status?: string;
          supplier_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_suppliers_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_suppliers_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "sourcing_projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_suppliers_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_suppliers_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_public_profile_v";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_suppliers_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_verification_summary_v";
            referencedColumns: ["supplier_id"];
          },
        ];
      };
      prompt_templates: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          purpose: string;
          template_id: string;
          version: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          purpose: string;
          template_id: string;
          version: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          purpose?: string;
          template_id?: string;
          version?: string;
        };
        Relationships: [];
      };
      quotation_states: {
        Row: {
          group_id: string;
          is_current: boolean;
          quotation_id: string;
          state_version: number;
          status: Database["public"]["Enums"]["quote_status"];
          superseded_by: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          group_id: string;
          is_current?: boolean;
          quotation_id: string;
          state_version?: number;
          status: Database["public"]["Enums"]["quote_status"];
          superseded_by?: string | null;
          updated_at?: string;
        };
        Update: {
          group_id?: string;
          is_current?: boolean;
          quotation_id?: string;
          state_version?: number;
          status?: Database["public"]["Enums"]["quote_status"];
          superseded_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quotation_states_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "quote_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotation_states_quotation_id_fkey";
            columns: ["quotation_id"];
            isOneToOne: true;
            referencedRelation: "quotations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotation_states_superseded_by_fkey";
            columns: ["superseded_by"];
            isOneToOne: false;
            referencedRelation: "quotations";
            referencedColumns: ["id"];
          },
        ];
      };
      quotations: {
        Row: {
          basis_confirmed: boolean;
          brief_item_id: string | null;
          buyer_org_id: string | null;
          confirmed_at: string;
          confirmed_by: string;
          created_at: string;
          currency: string;
          document_id: string | null;
          extraction_id: string | null;
          group_id: string;
          id: string;
          incoterm_place: string | null;
          moq: number | null;
          notes: string | null;
          payment_terms: string | null;
          price_basis: Database["public"]["Enums"]["price_basis"];
          production_lead_days: number | null;
          quantity_unit: string;
          quote_date: string;
          quote_type: Database["public"]["Enums"]["quote_type"];
          rights_class: Database["public"]["Enums"]["rights_class"];
          source_type: Database["public"]["Enums"]["source_type"];
          specification_id: string | null;
          supplier_id: string;
          valid_until: string | null;
          version: number;
          visibility_scope: Database["public"]["Enums"]["visibility_scope"];
        };
        ComputedFields: never;
        Insert: {
          basis_confirmed?: boolean;
          brief_item_id?: string | null;
          buyer_org_id?: string | null;
          confirmed_at?: string;
          confirmed_by: string;
          created_at?: string;
          currency: string;
          document_id?: string | null;
          extraction_id?: string | null;
          group_id: string;
          id?: string;
          incoterm_place?: string | null;
          moq?: number | null;
          notes?: string | null;
          payment_terms?: string | null;
          price_basis?: Database["public"]["Enums"]["price_basis"];
          production_lead_days?: number | null;
          quantity_unit: string;
          quote_date: string;
          quote_type: Database["public"]["Enums"]["quote_type"];
          rights_class: Database["public"]["Enums"]["rights_class"];
          source_type: Database["public"]["Enums"]["source_type"];
          specification_id?: string | null;
          supplier_id: string;
          valid_until?: string | null;
          version: number;
          visibility_scope?: Database["public"]["Enums"]["visibility_scope"];
        };
        Update: {
          basis_confirmed?: boolean;
          brief_item_id?: string | null;
          buyer_org_id?: string | null;
          confirmed_at?: string;
          confirmed_by?: string;
          created_at?: string;
          currency?: string;
          document_id?: string | null;
          extraction_id?: string | null;
          group_id?: string;
          id?: string;
          incoterm_place?: string | null;
          moq?: number | null;
          notes?: string | null;
          payment_terms?: string | null;
          price_basis?: Database["public"]["Enums"]["price_basis"];
          production_lead_days?: number | null;
          quantity_unit?: string;
          quote_date?: string;
          quote_type?: Database["public"]["Enums"]["quote_type"];
          rights_class?: Database["public"]["Enums"]["rights_class"];
          source_type?: Database["public"]["Enums"]["source_type"];
          specification_id?: string | null;
          supplier_id?: string;
          valid_until?: string | null;
          version?: number;
          visibility_scope?: Database["public"]["Enums"]["visibility_scope"];
        };
        Relationships: [
          {
            foreignKeyName: "quotations_brief_item_id_fkey";
            columns: ["brief_item_id"];
            isOneToOne: false;
            referencedRelation: "brief_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotations_buyer_org_id_fkey";
            columns: ["buyer_org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotations_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotations_extraction_fk";
            columns: ["extraction_id"];
            isOneToOne: false;
            referencedRelation: "ai_extractions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotations_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "quote_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotations_specification_id_fkey";
            columns: ["specification_id"];
            isOneToOne: false;
            referencedRelation: "product_specifications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotations_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotations_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_public_profile_v";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotations_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_verification_summary_v";
            referencedColumns: ["supplier_id"];
          },
        ];
      };
      quote_fees: {
        Row: {
          amount: number;
          currency: string;
          fee_type: string;
          id: string;
          included_in_unit_price: boolean;
          is_one_time: boolean;
          notes: string | null;
          quotation_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          currency: string;
          fee_type: string;
          id?: string;
          included_in_unit_price?: boolean;
          is_one_time?: boolean;
          notes?: string | null;
          quotation_id: string;
        };
        Update: {
          amount?: number;
          currency?: string;
          fee_type?: string;
          id?: string;
          included_in_unit_price?: boolean;
          is_one_time?: boolean;
          notes?: string | null;
          quotation_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quote_fees_quotation_id_fkey";
            columns: ["quotation_id"];
            isOneToOne: false;
            referencedRelation: "quotations";
            referencedColumns: ["id"];
          },
        ];
      };
      quote_groups: {
        Row: {
          brief_item_id: string | null;
          buyer_org_id: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          quote_type: Database["public"]["Enums"]["quote_type"];
          supplier_id: string;
        };
        ComputedFields: never;
        Insert: {
          brief_item_id?: string | null;
          buyer_org_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          quote_type: Database["public"]["Enums"]["quote_type"];
          supplier_id: string;
        };
        Update: {
          brief_item_id?: string | null;
          buyer_org_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          quote_type?: Database["public"]["Enums"]["quote_type"];
          supplier_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quote_groups_brief_item_id_fkey";
            columns: ["brief_item_id"];
            isOneToOne: false;
            referencedRelation: "brief_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quote_groups_buyer_org_id_fkey";
            columns: ["buyer_org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quote_groups_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quote_groups_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_public_profile_v";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quote_groups_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_verification_summary_v";
            referencedColumns: ["supplier_id"];
          },
        ];
      };
      quote_status_events: {
        Row: {
          acting_as: string;
          actor_user_id: string | null;
          at: string;
          from_status: Database["public"]["Enums"]["quote_status"] | null;
          id: string;
          idempotency_key: string;
          quotation_id: string;
          reason: string;
          to_status: Database["public"]["Enums"]["quote_status"];
        };
        ComputedFields: never;
        Insert: {
          acting_as: string;
          actor_user_id?: string | null;
          at?: string;
          from_status?: Database["public"]["Enums"]["quote_status"] | null;
          id?: string;
          idempotency_key: string;
          quotation_id: string;
          reason: string;
          to_status: Database["public"]["Enums"]["quote_status"];
        };
        Update: {
          acting_as?: string;
          actor_user_id?: string | null;
          at?: string;
          from_status?: Database["public"]["Enums"]["quote_status"] | null;
          id?: string;
          idempotency_key?: string;
          quotation_id?: string;
          reason?: string;
          to_status?: Database["public"]["Enums"]["quote_status"];
        };
        Relationships: [
          {
            foreignKeyName: "quote_status_events_quotation_id_fkey";
            columns: ["quotation_id"];
            isOneToOne: false;
            referencedRelation: "quotations";
            referencedColumns: ["id"];
          },
        ];
      };
      quote_tiers: {
        Row: {
          id: string;
          max_qty: number | null;
          min_qty: number;
          price_includes: string[];
          quotation_id: string;
          unit_price: number;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          max_qty?: number | null;
          min_qty: number;
          price_includes?: string[];
          quotation_id: string;
          unit_price: number;
        };
        Update: {
          id?: string;
          max_qty?: number | null;
          min_qty?: number;
          price_includes?: string[];
          quotation_id?: string;
          unit_price?: number;
        };
        Relationships: [
          {
            foreignKeyName: "quote_tiers_quotation_id_fkey";
            columns: ["quotation_id"];
            isOneToOne: false;
            referencedRelation: "quotations";
            referencedColumns: ["id"];
          },
        ];
      };
      quote_visibility_grants: {
        Row: {
          created_at: string;
          expires_at: string | null;
          granted_at: string;
          granted_by: string;
          grantee_org_id: string;
          id: string;
          quotation_id: string;
          reason: string;
          revoke_reason: string | null;
          revoked_at: string | null;
          revoked_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          expires_at?: string | null;
          granted_at?: string;
          granted_by?: string;
          grantee_org_id: string;
          id?: string;
          quotation_id: string;
          reason: string;
          revoke_reason?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
        };
        Update: {
          created_at?: string;
          expires_at?: string | null;
          granted_at?: string;
          granted_by?: string;
          grantee_org_id?: string;
          id?: string;
          quotation_id?: string;
          reason?: string;
          revoke_reason?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "quote_visibility_grants_grantee_org_id_fkey";
            columns: ["grantee_org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quote_visibility_grants_quotation_id_fkey";
            columns: ["quotation_id"];
            isOneToOne: false;
            referencedRelation: "quotations";
            referencedColumns: ["id"];
          },
        ];
      };
      research_leads: {
        Row: {
          created_at: string;
          currency: string;
          id: string;
          notes: string | null;
          observed_at: string;
          observed_max_price: number | null;
          observed_min_price: number | null;
          observed_moq: number | null;
          observed_unit: string | null;
          recorded_by: string;
          reference_url: string | null;
          rights_class: Database["public"]["Enums"]["rights_class"];
          search_term_zh: string | null;
          source_system_id: string;
          taxonomy_id: string;
          title_zh: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          currency?: string;
          id?: string;
          notes?: string | null;
          observed_at?: string;
          observed_max_price?: number | null;
          observed_min_price?: number | null;
          observed_moq?: number | null;
          observed_unit?: string | null;
          recorded_by?: string;
          reference_url?: string | null;
          rights_class?: Database["public"]["Enums"]["rights_class"];
          search_term_zh?: string | null;
          source_system_id: string;
          taxonomy_id: string;
          title_zh?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          currency?: string;
          id?: string;
          notes?: string | null;
          observed_at?: string;
          observed_max_price?: number | null;
          observed_min_price?: number | null;
          observed_moq?: number | null;
          observed_unit?: string | null;
          recorded_by?: string;
          reference_url?: string | null;
          rights_class?: Database["public"]["Enums"]["rights_class"];
          search_term_zh?: string | null;
          source_system_id?: string;
          taxonomy_id?: string;
          title_zh?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "research_leads_source_system_id_fkey";
            columns: ["source_system_id"];
            isOneToOne: false;
            referencedRelation: "source_systems";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "research_leads_taxonomy_id_fkey";
            columns: ["taxonomy_id"];
            isOneToOne: false;
            referencedRelation: "product_taxonomy";
            referencedColumns: ["id"];
          },
        ];
      };
      review_tasks: {
        Row: {
          accept_idempotency_key: string | null;
          assigned_to: string | null;
          brief_item_id: string | null;
          created_at: string;
          document_id: string | null;
          due_at: string | null;
          id: string;
          kind: string;
          org_id: string;
          project_id: string | null;
          resolution_reason: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          result_quotation_id: string | null;
          status: Database["public"]["Enums"]["review_status"];
          subject_id: string;
          supplier_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          accept_idempotency_key?: string | null;
          assigned_to?: string | null;
          brief_item_id?: string | null;
          created_at?: string;
          document_id?: string | null;
          due_at?: string | null;
          id?: string;
          kind: string;
          org_id: string;
          project_id?: string | null;
          resolution_reason?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          result_quotation_id?: string | null;
          status?: Database["public"]["Enums"]["review_status"];
          subject_id: string;
          supplier_id?: string | null;
          updated_at?: string;
        };
        Update: {
          accept_idempotency_key?: string | null;
          assigned_to?: string | null;
          brief_item_id?: string | null;
          created_at?: string;
          document_id?: string | null;
          due_at?: string | null;
          id?: string;
          kind?: string;
          org_id?: string;
          project_id?: string | null;
          resolution_reason?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          result_quotation_id?: string | null;
          status?: Database["public"]["Enums"]["review_status"];
          subject_id?: string;
          supplier_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "review_tasks_brief_item_id_fkey";
            columns: ["brief_item_id"];
            isOneToOne: false;
            referencedRelation: "brief_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_tasks_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_tasks_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_tasks_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "sourcing_projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_tasks_result_quotation_id_fkey";
            columns: ["result_quotation_id"];
            isOneToOne: false;
            referencedRelation: "quotations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_tasks_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_tasks_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_public_profile_v";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_tasks_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_verification_summary_v";
            referencedColumns: ["supplier_id"];
          },
        ];
      };
      security_events: {
        Row: {
          actor_user_id: string | null;
          at: string;
          details: NonNullable<Json>;
          id: string;
          kind: string;
          org_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          actor_user_id?: string | null;
          at?: string;
          details?: NonNullable<Json>;
          id?: string;
          kind: string;
          org_id?: string | null;
        };
        Update: {
          actor_user_id?: string | null;
          at?: string;
          details?: NonNullable<Json>;
          id?: string;
          kind?: string;
          org_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "security_events_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      source_permissions: {
        Row: {
          created_at: string;
          evidence_document_id: string | null;
          expires_at: string | null;
          granted_at: string;
          id: string;
          notes: string | null;
          org_id: string | null;
          recorded_by: string;
          revoke_reason: string | null;
          revoked_at: string | null;
          revoked_by: string | null;
          rights_class: Database["public"]["Enums"]["rights_class"];
          scope: NonNullable<Json>;
          source_system_id: string | null;
          supplier_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          evidence_document_id?: string | null;
          expires_at?: string | null;
          granted_at?: string;
          id?: string;
          notes?: string | null;
          org_id?: string | null;
          recorded_by?: string;
          revoke_reason?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          rights_class: Database["public"]["Enums"]["rights_class"];
          scope?: NonNullable<Json>;
          source_system_id?: string | null;
          supplier_id?: string | null;
        };
        Update: {
          created_at?: string;
          evidence_document_id?: string | null;
          expires_at?: string | null;
          granted_at?: string;
          id?: string;
          notes?: string | null;
          org_id?: string | null;
          recorded_by?: string;
          revoke_reason?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          rights_class?: Database["public"]["Enums"]["rights_class"];
          scope?: NonNullable<Json>;
          source_system_id?: string | null;
          supplier_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "source_permissions_evidence_document_id_fkey";
            columns: ["evidence_document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "source_permissions_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "source_permissions_source_system_id_fkey";
            columns: ["source_system_id"];
            isOneToOne: false;
            referencedRelation: "source_systems";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "source_permissions_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "source_permissions_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_public_profile_v";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "source_permissions_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_verification_summary_v";
            referencedColumns: ["supplier_id"];
          },
        ];
      };
      source_systems: {
        Row: {
          capabilities: NonNullable<Json>;
          code: string;
          created_at: string;
          id: string;
          notes: string | null;
          provider: string;
          source_type: Database["public"]["Enums"]["source_type"];
          status: string;
          terms_url: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          capabilities?: NonNullable<Json>;
          code: string;
          created_at?: string;
          id?: string;
          notes?: string | null;
          provider: string;
          source_type: Database["public"]["Enums"]["source_type"];
          status?: string;
          terms_url?: string | null;
          updated_at?: string;
        };
        Update: {
          capabilities?: NonNullable<Json>;
          code?: string;
          created_at?: string;
          id?: string;
          notes?: string | null;
          provider?: string;
          source_type?: Database["public"]["Enums"]["source_type"];
          status?: string;
          terms_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      sourcing_projects: {
        Row: {
          compliance_hold: boolean;
          compliance_note: string | null;
          created_at: string;
          created_by: string | null;
          destination_country: string;
          destination_postal: string | null;
          id: string;
          lead_operator_id: string | null;
          name: string;
          org_id: string;
          status: string;
          target_date: string | null;
          target_incoterm: Database["public"]["Enums"]["price_basis"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          compliance_hold?: boolean;
          compliance_note?: string | null;
          created_at?: string;
          created_by?: string | null;
          destination_country?: string;
          destination_postal?: string | null;
          id?: string;
          lead_operator_id?: string | null;
          name: string;
          org_id: string;
          status?: string;
          target_date?: string | null;
          target_incoterm?: Database["public"]["Enums"]["price_basis"];
          updated_at?: string;
        };
        Update: {
          compliance_hold?: boolean;
          compliance_note?: string | null;
          created_at?: string;
          created_by?: string | null;
          destination_country?: string;
          destination_postal?: string | null;
          id?: string;
          lead_operator_id?: string | null;
          name?: string;
          org_id?: string;
          status?: string;
          target_date?: string | null;
          target_incoterm?: Database["public"]["Enums"]["price_basis"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sourcing_projects_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      supplier_contacts: {
        Row: {
          consent_note: string | null;
          contact_basis: string;
          created_at: string;
          created_by: string | null;
          email: string | null;
          id: string;
          is_active: boolean;
          name: string;
          org_id: string;
          phone: string | null;
          role_title: string | null;
          supplier_id: string;
          updated_at: string;
          wechat_handle: string | null;
        };
        ComputedFields: never;
        Insert: {
          consent_note?: string | null;
          contact_basis: string;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          org_id: string;
          phone?: string | null;
          role_title?: string | null;
          supplier_id: string;
          updated_at?: string;
          wechat_handle?: string | null;
        };
        Update: {
          consent_note?: string | null;
          contact_basis?: string;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          org_id?: string;
          phone?: string | null;
          role_title?: string | null;
          supplier_id?: string;
          updated_at?: string;
          wechat_handle?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "supplier_contacts_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_contacts_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_contacts_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_public_profile_v";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_contacts_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_verification_summary_v";
            referencedColumns: ["supplier_id"];
          },
        ];
      };
      supplier_documents: {
        Row: {
          claim_note_en: string | null;
          claim_note_zh: string | null;
          claimed_by_supplier: boolean;
          created_at: string;
          created_by: string | null;
          doc_kind: string;
          document_id: string;
          id: string;
          org_id: string;
          supplier_id: string;
          updated_at: string;
          verification_check_id: string | null;
          verified_at: string | null;
          verified_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          claim_note_en?: string | null;
          claim_note_zh?: string | null;
          claimed_by_supplier?: boolean;
          created_at?: string;
          created_by?: string | null;
          doc_kind: string;
          document_id: string;
          id?: string;
          org_id: string;
          supplier_id: string;
          updated_at?: string;
          verification_check_id?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          claim_note_en?: string | null;
          claim_note_zh?: string | null;
          claimed_by_supplier?: boolean;
          created_at?: string;
          created_by?: string | null;
          doc_kind?: string;
          document_id?: string;
          id?: string;
          org_id?: string;
          supplier_id?: string;
          updated_at?: string;
          verification_check_id?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "supplier_documents_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: true;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_documents_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_documents_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_documents_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_public_profile_v";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_documents_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_verification_summary_v";
            referencedColumns: ["supplier_id"];
          },
          {
            foreignKeyName: "supplier_documents_verification_check_id_fkey";
            columns: ["verification_check_id"];
            isOneToOne: false;
            referencedRelation: "supplier_verification_checks";
            referencedColumns: ["id"];
          },
        ];
      };
      supplier_facilities: {
        Row: {
          address_en: string | null;
          address_zh: string;
          created_at: string;
          created_by: string | null;
          evidence_document_id: string | null;
          facility_type: string;
          id: string;
          is_primary: boolean;
          notes: string | null;
          org_id: string;
          supplier_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          address_en?: string | null;
          address_zh: string;
          created_at?: string;
          created_by?: string | null;
          evidence_document_id?: string | null;
          facility_type: string;
          id?: string;
          is_primary?: boolean;
          notes?: string | null;
          org_id: string;
          supplier_id: string;
          updated_at?: string;
        };
        Update: {
          address_en?: string | null;
          address_zh?: string;
          created_at?: string;
          created_by?: string | null;
          evidence_document_id?: string | null;
          facility_type?: string;
          id?: string;
          is_primary?: boolean;
          notes?: string | null;
          org_id?: string;
          supplier_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "supplier_facilities_evidence_document_id_fkey";
            columns: ["evidence_document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_facilities_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_facilities_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_facilities_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_public_profile_v";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_facilities_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_verification_summary_v";
            referencedColumns: ["supplier_id"];
          },
        ];
      };
      supplier_profiles: {
        Row: {
          city: string | null;
          created_at: string;
          created_by: string | null;
          entity_kind: string;
          entity_kind_verified: boolean;
          export_ready_claimed: boolean;
          id: string;
          intro_en: string | null;
          intro_zh: string | null;
          legal_name_en: string | null;
          legal_name_zh: string;
          org_id: string;
          province: string | null;
          stage: Database["public"]["Enums"]["supplier_stage"];
          updated_at: string;
          uscc: string | null;
          website: string | null;
        };
        ComputedFields: never;
        Insert: {
          city?: string | null;
          created_at?: string;
          created_by?: string | null;
          entity_kind?: string;
          entity_kind_verified?: boolean;
          export_ready_claimed?: boolean;
          id?: string;
          intro_en?: string | null;
          intro_zh?: string | null;
          legal_name_en?: string | null;
          legal_name_zh: string;
          org_id: string;
          province?: string | null;
          stage?: Database["public"]["Enums"]["supplier_stage"];
          updated_at?: string;
          uscc?: string | null;
          website?: string | null;
        };
        Update: {
          city?: string | null;
          created_at?: string;
          created_by?: string | null;
          entity_kind?: string;
          entity_kind_verified?: boolean;
          export_ready_claimed?: boolean;
          id?: string;
          intro_en?: string | null;
          intro_zh?: string | null;
          legal_name_en?: string | null;
          legal_name_zh?: string;
          org_id?: string;
          province?: string | null;
          stage?: Database["public"]["Enums"]["supplier_stage"];
          updated_at?: string;
          uscc?: string | null;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "supplier_profiles_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      supplier_stage_requirements: {
        Row: {
          check_type: Database["public"]["Enums"]["check_type"];
          group_no: number;
          stage: Database["public"]["Enums"]["supplier_stage"];
        };
        ComputedFields: never;
        Insert: {
          check_type: Database["public"]["Enums"]["check_type"];
          group_no: number;
          stage: Database["public"]["Enums"]["supplier_stage"];
        };
        Update: {
          check_type?: Database["public"]["Enums"]["check_type"];
          group_no?: number;
          stage?: Database["public"]["Enums"]["supplier_stage"];
        };
        Relationships: [];
      };
      supplier_verification_checks: {
        Row: {
          check_type: Database["public"]["Enums"]["check_type"];
          checklist_version: string;
          created_at: string;
          evidence_document_id: string | null;
          id: string;
          notes: string | null;
          org_id: string;
          result: string;
          reviewed_at: string;
          reviewed_by: string;
          supplier_id: string;
          updated_at: string;
          valid_until: string | null;
        };
        ComputedFields: never;
        Insert: {
          check_type: Database["public"]["Enums"]["check_type"];
          checklist_version?: string;
          created_at?: string;
          evidence_document_id?: string | null;
          id?: string;
          notes?: string | null;
          org_id: string;
          result: string;
          reviewed_at?: string;
          reviewed_by?: string;
          supplier_id: string;
          updated_at?: string;
          valid_until?: string | null;
        };
        Update: {
          check_type?: Database["public"]["Enums"]["check_type"];
          checklist_version?: string;
          created_at?: string;
          evidence_document_id?: string | null;
          id?: string;
          notes?: string | null;
          org_id?: string;
          result?: string;
          reviewed_at?: string;
          reviewed_by?: string;
          supplier_id?: string;
          updated_at?: string;
          valid_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "supplier_verification_checks_evidence_document_id_fkey";
            columns: ["evidence_document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_verification_checks_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_verification_checks_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_verification_checks_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_public_profile_v";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_verification_checks_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_verification_summary_v";
            referencedColumns: ["supplier_id"];
          },
        ];
      };
      user_profiles: {
        Row: {
          created_at: string;
          full_name: string | null;
          locale: string;
          timezone: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          full_name?: string | null;
          locale?: string;
          timezone?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          full_name?: string | null;
          locale?: string;
          timezone?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      supplier_public_profile_v: {
        Row: {
          city: string | null;
          created_at: string;
          entity_kind: string;
          entity_kind_verified: boolean;
          export_ready_claimed: boolean;
          id: string;
          intro_en: string | null;
          intro_zh: string | null;
          legal_name_en: string | null;
          legal_name_zh: string;
          org_id: string;
          province: string | null;
          stage: Database["public"]["Enums"]["supplier_stage"];
          website: string | null;
        };
        ComputedFields: never;
        Insert: {
          city?: string | null;
          created_at?: string | null;
          entity_kind?: string | null;
          entity_kind_verified?: boolean | null;
          export_ready_claimed?: boolean | null;
          id?: string | null;
          intro_en?: string | null;
          intro_zh?: string | null;
          legal_name_en?: string | null;
          legal_name_zh?: string | null;
          org_id?: string | null;
          province?: string | null;
          stage?: Database["public"]["Enums"]["supplier_stage"] | null;
          website?: string | null;
        };
        Update: {
          city?: string | null;
          created_at?: string | null;
          entity_kind?: string | null;
          entity_kind_verified?: boolean | null;
          export_ready_claimed?: boolean | null;
          id?: string | null;
          intro_en?: string | null;
          intro_zh?: string | null;
          legal_name_en?: string | null;
          legal_name_zh?: string | null;
          org_id?: string | null;
          province?: string | null;
          stage?: Database["public"]["Enums"]["supplier_stage"] | null;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "supplier_profiles_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      supplier_verification_summary_v: {
        Row: {
          entity_kind: string;
          entity_kind_verified: boolean;
          expired_checks: Database["public"]["Enums"]["check_type"][] | null;
          last_passed_check_at: string | null;
          org_id: string;
          passed_checks: Database["public"]["Enums"]["check_type"][] | null;
          stage: Database["public"]["Enums"]["supplier_stage"];
          stage_evidenced: boolean | null;
          supplier_id: string;
          unverified_document_count: number | null;
          verified_document_count: number | null;
        };
        ComputedFields: never;
        Insert: {
          entity_kind?: string | null;
          entity_kind_verified?: boolean | null;
          expired_checks?: never;
          last_passed_check_at?: never;
          org_id?: string | null;
          passed_checks?: never;
          stage?: Database["public"]["Enums"]["supplier_stage"] | null;
          stage_evidenced?: never;
          supplier_id?: string | null;
          unverified_document_count?: never;
          verified_document_count?: never;
        };
        Update: {
          entity_kind?: string | null;
          entity_kind_verified?: boolean | null;
          expired_checks?: never;
          last_passed_check_at?: never;
          org_id?: string | null;
          passed_checks?: never;
          stage?: Database["public"]["Enums"]["supplier_stage"] | null;
          stage_evidenced?: never;
          supplier_id?: string | null;
          unverified_document_count?: never;
          verified_document_count?: never;
        };
        Relationships: [
          {
            foreignKeyName: "supplier_profiles_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      accept_invite: { Args: { p_token: string }; Returns: string };
      create_invite: {
        Args: {
          p_email: string;
          p_org: string;
          p_role: Database["public"]["Enums"]["member_role"];
        };
        Returns: string;
      };
      create_organization: {
        Args: {
          p_country?: string;
          p_display_name: string;
          p_display_name_zh?: string;
          p_legal_name: string;
          p_org_type: Database["public"]["Enums"]["org_type"];
        };
        Returns: string;
      };
      create_staff_invite: {
        Args: { p_email: string; p_role: Database["public"]["Enums"]["member_role"] };
        Returns: string;
      };
      list_org_members: {
        Args: { p_org: string };
        Returns: {
          accepted_at: string;
          created_at: string;
          email: string;
          full_name: string;
          membership_id: string;
          role: Database["public"]["Enums"]["member_role"];
          status: string;
          user_id: string;
        }[];
      };
      update_membership: {
        Args: {
          p_membership: string;
          p_role: Database["public"]["Enums"]["member_role"];
          p_status: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      check_type:
        | "business_license_reviewed"
        | "uscc_matched"
        | "address_corroborated"
        | "video_call_held"
        | "factory_visit"
        | "export_license_seen"
        | "bank_name_matches_entity"
        | "reference_checked";
      compliance_state: "clear" | "review_required" | "blocked";
      cost_line_status: "sourced" | "estimated" | "missing" | "not_applicable";
      document_status:
        | "uploaded"
        | "scanning"
        | "rejected"
        | "parsed"
        | "extracted"
        | "in_review"
        | "accepted"
        | "discarded";
      member_role:
        | "owner"
        | "admin"
        | "member"
        | "viewer"
        | "operator"
        | "compliance_reviewer"
        | "platform_admin";
      org_type: "buyer" | "supplier" | "internal";
      price_basis: "EXW" | "FCA" | "FOB" | "CFR" | "CIF" | "DAP" | "DPU" | "DDP" | "unknown";
      quote_status: "confirmed" | "superseded" | "expired" | "withdrawn";
      quote_type:
        "listing" | "supplier_catalog" | "negotiated_private" | "final_offer" | "estimate";
      review_status: "pending" | "in_review" | "accepted" | "rejected";
      rights_class:
        | "internal_market_observation"
        | "catalog_public_with_permission"
        | "customer_private_quote"
        | "buyer_uploaded_private"
        | "supplier_submitted_private";
      source_type:
        | "manual_research"
        | "operator_import"
        | "buyer_upload"
        | "supplier_portal"
        | "supplier_csv_feed"
        | "inbound_email"
        | "supplier_api"
        | "marketplace_api";
      supplier_stage:
        | "lead_identified"
        | "contact_confirmed"
        | "legal_identity_reviewed"
        | "capabilities_documented";
      visibility_scope: "internal_only" | "owning_org" | "named_orgs" | "platform_buyers";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      check_type: [
        "business_license_reviewed",
        "uscc_matched",
        "address_corroborated",
        "video_call_held",
        "factory_visit",
        "export_license_seen",
        "bank_name_matches_entity",
        "reference_checked",
      ],
      compliance_state: ["clear", "review_required", "blocked"],
      cost_line_status: ["sourced", "estimated", "missing", "not_applicable"],
      document_status: [
        "uploaded",
        "scanning",
        "rejected",
        "parsed",
        "extracted",
        "in_review",
        "accepted",
        "discarded",
      ],
      member_role: [
        "owner",
        "admin",
        "member",
        "viewer",
        "operator",
        "compliance_reviewer",
        "platform_admin",
      ],
      org_type: ["buyer", "supplier", "internal"],
      price_basis: ["EXW", "FCA", "FOB", "CFR", "CIF", "DAP", "DPU", "DDP", "unknown"],
      quote_status: ["confirmed", "superseded", "expired", "withdrawn"],
      quote_type: ["listing", "supplier_catalog", "negotiated_private", "final_offer", "estimate"],
      review_status: ["pending", "in_review", "accepted", "rejected"],
      rights_class: [
        "internal_market_observation",
        "catalog_public_with_permission",
        "customer_private_quote",
        "buyer_uploaded_private",
        "supplier_submitted_private",
      ],
      source_type: [
        "manual_research",
        "operator_import",
        "buyer_upload",
        "supplier_portal",
        "supplier_csv_feed",
        "inbound_email",
        "supplier_api",
        "marketplace_api",
      ],
      supplier_stage: [
        "lead_identified",
        "contact_confirmed",
        "legal_identity_reviewed",
        "capabilities_documented",
      ],
      visibility_scope: ["internal_only", "owning_org", "named_orgs", "platform_buyers"],
    },
  },
} as const;
