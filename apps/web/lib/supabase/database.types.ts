export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          metadata: Json
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          metadata?: Json
          title: string
          type: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          metadata?: Json
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_approvals: {
        Row: {
          approved_at: string
          audio_version_id: string
          created_at: string
          customer_id: string
          id: string
        }
        Insert: {
          approved_at?: string
          audio_version_id: string
          created_at?: string
          customer_id: string
          id?: string
        }
        Update: {
          approved_at?: string
          audio_version_id?: string
          created_at?: string
          customer_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_approvals_audio_version_id_fkey"
            columns: ["audio_version_id"]
            isOneToOne: false
            referencedRelation: "audio_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_approvals_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_comments: {
        Row: {
          audio_version_id: string
          author_customer_id: string | null
          author_profile_id: string | null
          author_type: string
          comment: string
          created_at: string
          id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          timestamp_seconds: number
        }
        Insert: {
          audio_version_id: string
          author_customer_id?: string | null
          author_profile_id?: string | null
          author_type: string
          comment: string
          created_at?: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          timestamp_seconds: number
        }
        Update: {
          audio_version_id?: string
          author_customer_id?: string | null
          author_profile_id?: string | null
          author_type?: string
          comment?: string
          created_at?: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          timestamp_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "audio_comments_audio_version_id_fkey"
            columns: ["audio_version_id"]
            isOneToOne: false
            referencedRelation: "audio_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_comments_author_customer_id_fkey"
            columns: ["author_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_comments_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_comments_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_versions: {
        Row: {
          asset_id: string
          created_at: string
          deleted_at: string | null
          duration_seconds: number | null
          id: string
          notes: string | null
          project_id: string
          song_id: string | null
          status: string
          updated_at: string
          uploaded_by: string | null
          version_label: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          deleted_at?: string | null
          duration_seconds?: number | null
          id?: string
          notes?: string | null
          project_id: string
          song_id?: string | null
          status?: string
          updated_at?: string
          uploaded_by?: string | null
          version_label: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          deleted_at?: string | null
          duration_seconds?: number | null
          id?: string
          notes?: string | null
          project_id?: string
          song_id?: string | null
          status?: string
          updated_at?: string
          uploaded_by?: string | null
          version_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_versions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "project_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_versions_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "project_songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_versions_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          action_config: Json
          action_type: string
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          name: string
          trigger_event: string
          updated_at: string
        }
        Insert: {
          action_config?: Json
          action_type?: string
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          trigger_event: string
          updated_at?: string
        }
        Update: {
          action_config?: Json
          action_type?: string
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          trigger_event?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_statuses: {
        Row: {
          is_terminal: boolean
          label: string
          slug: string
          sort_order: number
        }
        Insert: {
          is_terminal?: boolean
          label: string
          slug: string
          sort_order: number
        }
        Update: {
          is_terminal?: boolean
          label?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      bookings: {
        Row: {
          created_at: string
          customer_id: string
          date: string
          deleted_at: string | null
          end_time: string | null
          external_square_booking_id: string | null
          id: string
          location: string | null
          membership_id: string | null
          notes: string | null
          payment_status: string
          service_id: string
          staff_id: string | null
          start_time: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          date: string
          deleted_at?: string | null
          end_time?: string | null
          external_square_booking_id?: string | null
          id?: string
          location?: string | null
          membership_id?: string | null
          notes?: string | null
          payment_status?: string
          service_id: string
          staff_id?: string | null
          start_time?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          date?: string
          deleted_at?: string | null
          end_time?: string | null
          external_square_booking_id?: string | null
          id?: string
          location?: string | null
          membership_id?: string | null
          notes?: string | null
          payment_status?: string
          service_id?: string
          staff_id?: string | null
          start_time?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_status_fkey"
            columns: ["status"]
            isOneToOne: false
            referencedRelation: "booking_statuses"
            referencedColumns: ["slug"]
          },
        ]
      }
      customer_tags: {
        Row: {
          created_at: string
          customer_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_tags_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          artist_name: string | null
          base44_id: string | null
          company: string | null
          created_at: string
          customer_type: string | null
          deleted_at: string | null
          display_name: string | null
          email: string | null
          external_square_customer_id: string | null
          first_name: string | null
          id: string
          instagram: string | null
          last_name: string | null
          location: string | null
          phone: string | null
          referral_code: string | null
          referral_source: string | null
          shopify_customer_id: string | null
          social_links: Json
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          artist_name?: string | null
          base44_id?: string | null
          company?: string | null
          created_at?: string
          customer_type?: string | null
          deleted_at?: string | null
          display_name?: string | null
          email?: string | null
          external_square_customer_id?: string | null
          first_name?: string | null
          id?: string
          instagram?: string | null
          last_name?: string | null
          location?: string | null
          phone?: string | null
          referral_code?: string | null
          referral_source?: string | null
          shopify_customer_id?: string | null
          social_links?: Json
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          artist_name?: string | null
          base44_id?: string | null
          company?: string | null
          created_at?: string
          customer_type?: string | null
          deleted_at?: string | null
          display_name?: string | null
          email?: string | null
          external_square_customer_id?: string | null
          first_name?: string | null
          id?: string
          instagram?: string | null
          last_name?: string | null
          location?: string | null
          phone?: string | null
          referral_code?: string | null
          referral_source?: string | null
          shopify_customer_id?: string | null
          social_links?: Json
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      delivery_link_versions: {
        Row: {
          audio_version_id: string
          delivery_link_id: string
        }
        Insert: {
          audio_version_id: string
          delivery_link_id: string
        }
        Update: {
          audio_version_id?: string
          delivery_link_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_link_versions_audio_version_id_fkey"
            columns: ["audio_version_id"]
            isOneToOne: false
            referencedRelation: "audio_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_link_versions_delivery_link_id_fkey"
            columns: ["delivery_link_id"]
            isOneToOne: false
            referencedRelation: "delivery_links"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_link_views: {
        Row: {
          delivery_link_id: string
          id: string
          viewed_at: string
        }
        Insert: {
          delivery_link_id: string
          id?: string
          viewed_at?: string
        }
        Update: {
          delivery_link_id?: string
          id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_link_views_delivery_link_id_fkey"
            columns: ["delivery_link_id"]
            isOneToOne: false
            referencedRelation: "delivery_links"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_links: {
        Row: {
          allow_downloads: boolean
          created_at: string
          created_by: string | null
          deleted_at: string | null
          expires_at: string | null
          id: string
          password_hash: string | null
          project_id: string
          slug: string
          song_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          allow_downloads?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          expires_at?: string | null
          id?: string
          password_hash?: string | null
          project_id: string
          slug: string
          song_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          allow_downloads?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          expires_at?: string | null
          id?: string
          password_hash?: string | null
          project_id?: string
          slug?: string
          song_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_links_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "project_songs"
            referencedColumns: ["id"]
          },
        ]
      }
      galleries: {
        Row: {
          allow_downloads: boolean
          cover_asset_id: string | null
          created_at: string
          customer_id: string
          deleted_at: string | null
          description: string | null
          expires_at: string | null
          id: string
          password_hash: string | null
          project_id: string | null
          published: boolean
          slug: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          allow_downloads?: boolean
          cover_asset_id?: string | null
          created_at?: string
          customer_id: string
          deleted_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          password_hash?: string | null
          project_id?: string | null
          published?: boolean
          slug: string
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          allow_downloads?: boolean
          cover_asset_id?: string | null
          created_at?: string
          customer_id?: string
          deleted_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          password_hash?: string | null
          project_id?: string | null
          published?: boolean
          slug?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "galleries_cover_asset_id_fkey"
            columns: ["cover_asset_id"]
            isOneToOne: false
            referencedRelation: "gallery_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "galleries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "galleries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_assets: {
        Row: {
          created_at: string
          gallery_id: string
          height: number | null
          id: string
          kind: string
          position: number
          storage_path: string
          thumbnail_path: string | null
          width: number | null
        }
        Insert: {
          created_at?: string
          gallery_id: string
          height?: number | null
          id?: string
          kind: string
          position?: number
          storage_path: string
          thumbnail_path?: string | null
          width?: number | null
        }
        Update: {
          created_at?: string
          gallery_id?: string
          height?: number | null
          id?: string
          kind?: string
          position?: number
          storage_path?: string
          thumbnail_path?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gallery_assets_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "galleries"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_views: {
        Row: {
          customer_id: string | null
          gallery_id: string
          id: string
          metadata: Json
          viewed_at: string
        }
        Insert: {
          customer_id?: string | null
          gallery_id: string
          id?: string
          metadata?: Json
          viewed_at?: string
        }
        Update: {
          customer_id?: string | null
          gallery_id?: string
          id?: string
          metadata?: Json
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gallery_views_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_views_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "galleries"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          connected_at: string | null
          created_at: string
          id: string
          last_checked_at: string | null
          metadata: Json
          provider: string
          status: string
          updated_at: string
        }
        Insert: {
          connected_at?: string | null
          created_at?: string
          id?: string
          last_checked_at?: string | null
          metadata?: Json
          provider: string
          status?: string
          updated_at?: string
        }
        Update: {
          connected_at?: string | null
          created_at?: string
          id?: string
          last_checked_at?: string | null
          metadata?: Json
          provider?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_statuses: {
        Row: {
          is_terminal: boolean
          label: string
          slug: string
          sort_order: number
        }
        Insert: {
          is_terminal?: boolean
          label: string
          slug: string
          sort_order: number
        }
        Update: {
          is_terminal?: boolean
          label?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      leads: {
        Row: {
          assigned_staff: string | null
          converted_customer_id: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          notes: string | null
          phone: string | null
          service_interest: string | null
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_staff?: string | null
          converted_customer_id?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          service_interest?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_staff?: string | null
          converted_customer_id?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          service_interest?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_staff_fkey"
            columns: ["assigned_staff"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_customer_id_fkey"
            columns: ["converted_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_status_fkey"
            columns: ["status"]
            isOneToOne: false
            referencedRelation: "lead_statuses"
            referencedColumns: ["slug"]
          },
        ]
      }
      membership_plans: {
        Row: {
          active: boolean
          benefits: Json
          billing_interval: string
          created_at: string
          currency: string
          deleted_at: string | null
          id: string
          included_hours: number | null
          name: string
          price: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          benefits?: Json
          billing_interval?: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          id?: string
          included_hours?: number | null
          name: string
          price?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          benefits?: Json
          billing_interval?: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          id?: string
          included_hours?: number | null
          name?: string
          price?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      membership_usage: {
        Row: {
          amount: number
          booking_id: string | null
          id: string
          membership_id: string
          recorded_at: string
          usage_type: string
        }
        Insert: {
          amount: number
          booking_id?: string | null
          id?: string
          membership_id: string
          recorded_at?: string
          usage_type: string
        }
        Update: {
          amount?: number
          booking_id?: string | null
          id?: string
          membership_id?: string
          recorded_at?: string
          usage_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_usage_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_usage_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          customer_id: string
          deleted_at: string | null
          external_payment_id: string | null
          id: string
          notes: string | null
          payment_provider: string | null
          plan_id: string
          renewal_date: string | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          deleted_at?: string | null
          external_payment_id?: string | null
          id?: string
          notes?: string | null
          payment_provider?: string | null
          plan_id: string
          renewal_date?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          deleted_at?: string | null
          external_payment_id?: string | null
          id?: string
          notes?: string | null
          payment_provider?: string | null
          plan_id?: string
          renewal_date?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          customer_id: string
          id: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          customer_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          customer_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          customer_id: string
          id: string
          metadata: Json
          paid_at: string | null
          provider: string
          provider_transaction_id: string
          related_id: string | null
          related_type: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          customer_id: string
          id?: string
          metadata?: Json
          paid_at?: string | null
          provider: string
          provider_transaction_id: string
          related_id?: string | null
          related_type?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          customer_id?: string
          id?: string
          metadata?: Json
          paid_at?: string | null
          provider?: string
          provider_transaction_id?: string
          related_id?: string | null
          related_type?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_assets: {
        Row: {
          asset_type: string
          created_at: string
          deleted_at: string | null
          file_name: string
          id: string
          mime_type: string | null
          project_id: string
          size_bytes: number | null
          song_id: string | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          asset_type: string
          created_at?: string
          deleted_at?: string | null
          file_name: string
          id?: string
          mime_type?: string | null
          project_id: string
          size_bytes?: number | null
          song_id?: string | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          asset_type?: string
          created_at?: string
          deleted_at?: string | null
          file_name?: string
          id?: string
          mime_type?: string | null
          project_id?: string
          size_bytes?: number | null
          song_id?: string | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assets_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "project_songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assets_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_deliveries: {
        Row: {
          created_at: string
          delivered_at: string
          delivered_by: string | null
          delivery_type: string
          gallery_id: string | null
          id: string
          notes: string | null
          project_id: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string
          delivered_by?: string | null
          delivery_type?: string
          gallery_id?: string | null
          id?: string
          notes?: string | null
          project_id: string
        }
        Update: {
          created_at?: string
          delivered_at?: string
          delivered_by?: string | null
          delivery_type?: string
          gallery_id?: string | null
          id?: string
          notes?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_deliveries_delivered_by_fkey"
            columns: ["delivered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_deliveries_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "galleries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_deliveries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          project_id: string
          staff_id: string
        }
        Insert: {
          created_at?: string
          project_id: string
          staff_id: string
        }
        Update: {
          created_at?: string
          project_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_revisions: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          notes: string | null
          project_id: string
          requested_at: string
          revision_number: number
          song_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          project_id: string
          requested_at?: string
          revision_number: number
          song_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          requested_at?: string
          revision_number?: number
          song_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_revisions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_revisions_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "project_songs"
            referencedColumns: ["id"]
          },
        ]
      }
      project_sessions: {
        Row: {
          booking_id: string | null
          created_at: string
          deleted_at: string | null
          ends_at: string | null
          engineer_id: string | null
          id: string
          notes: string | null
          project_id: string | null
          session_type: string
          song_id: string | null
          starts_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          deleted_at?: string | null
          ends_at?: string | null
          engineer_id?: string | null
          id?: string
          notes?: string | null
          project_id?: string | null
          session_type?: string
          song_id?: string | null
          starts_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          deleted_at?: string | null
          ends_at?: string | null
          engineer_id?: string | null
          id?: string
          notes?: string | null
          project_id?: string | null
          session_type?: string
          song_id?: string | null
          starts_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_sessions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_sessions_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_sessions_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "project_songs"
            referencedColumns: ["id"]
          },
        ]
      }
      project_songs: {
        Row: {
          bpm: number | null
          created_at: string
          deleted_at: string | null
          editing_status: string
          final_approval: boolean
          genre: string | null
          id: string
          mastering_status: string
          mixing_status: string
          notes: string | null
          project_id: string
          recording_status: string
          song_key: string | null
          status: string
          title: string
          track_number: number | null
          updated_at: string
        }
        Insert: {
          bpm?: number | null
          created_at?: string
          deleted_at?: string | null
          editing_status?: string
          final_approval?: boolean
          genre?: string | null
          id?: string
          mastering_status?: string
          mixing_status?: string
          notes?: string | null
          project_id: string
          recording_status?: string
          song_key?: string | null
          status?: string
          title: string
          track_number?: number | null
          updated_at?: string
        }
        Update: {
          bpm?: number | null
          created_at?: string
          deleted_at?: string | null
          editing_status?: string
          final_approval?: boolean
          genre?: string | null
          id?: string
          mastering_status?: string
          mixing_status?: string
          notes?: string | null
          project_id?: string
          recording_status?: string
          song_key?: string | null
          status?: string
          title?: string
          track_number?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_songs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_stages: {
        Row: {
          is_terminal: boolean
          label: string
          slug: string
          sort_order: number
        }
        Insert: {
          is_terminal?: boolean
          label: string
          slug: string
          sort_order: number
        }
        Update: {
          is_terminal?: boolean
          label?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      project_statuses: {
        Row: {
          is_terminal: boolean
          label: string
          slug: string
          sort_order: number
        }
        Insert: {
          is_terminal?: boolean
          label: string
          slug: string
          sort_order: number
        }
        Update: {
          is_terminal?: boolean
          label?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      projects: {
        Row: {
          artist_name: string | null
          completion_date: string | null
          created_at: string
          customer_id: string
          deleted_at: string | null
          description: string | null
          due_date: string | null
          estimated_revenue: number | null
          id: string
          name: string
          notes: string | null
          primary_engineer_id: string | null
          priority: string
          project_manager_id: string | null
          project_type: string
          service_id: string | null
          stage: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          artist_name?: string | null
          completion_date?: string | null
          created_at?: string
          customer_id: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          estimated_revenue?: number | null
          id?: string
          name: string
          notes?: string | null
          primary_engineer_id?: string | null
          priority?: string
          project_manager_id?: string | null
          project_type?: string
          service_id?: string | null
          stage?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          artist_name?: string | null
          completion_date?: string | null
          created_at?: string
          customer_id?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          estimated_revenue?: number | null
          id?: string
          name?: string
          notes?: string | null
          primary_engineer_id?: string | null
          priority?: string
          project_manager_id?: string | null
          project_type?: string
          service_id?: string | null
          stage?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_primary_engineer_id_fkey"
            columns: ["primary_engineer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_project_manager_id_fkey"
            columns: ["project_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_stage_fkey"
            columns: ["stage"]
            isOneToOne: false
            referencedRelation: "project_stages"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "projects_status_fkey"
            columns: ["status"]
            isOneToOne: false
            referencedRelation: "project_statuses"
            referencedColumns: ["slug"]
          },
        ]
      }
      referrals: {
        Row: {
          code: string | null
          created_at: string
          id: string
          qualification_status: string
          referred_customer_id: string
          referrer_customer_id: string
          related_payment_id: string | null
          source: string | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          qualification_status?: string
          referred_customer_id: string
          referrer_customer_id: string
          related_payment_id?: string | null
          source?: string | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          qualification_status?: string
          referred_customer_id?: string
          referrer_customer_id?: string
          related_payment_id?: string | null
          source?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_customer_id_fkey"
            columns: ["referred_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_customer_id_fkey"
            columns: ["referrer_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_related_payment_id_fkey"
            columns: ["related_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount: number
          created_at: string
          id: string
          payment_id: string
          provider_refund_id: string | null
          reason: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          payment_id: string
          provider_refund_id?: string | null
          reason?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payment_id?: string
          provider_refund_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_accounts: {
        Row: {
          balance: number
          created_at: string
          customer_id: string
          id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          customer_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          customer_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_accounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_transactions: {
        Row: {
          actor_id: string | null
          amount: number
          created_at: string
          customer_id: string
          id: string
          reason: string | null
          related_booking_id: string | null
          related_order_id: string | null
          related_referral_id: string | null
          type: string
        }
        Insert: {
          actor_id?: string | null
          amount: number
          created_at?: string
          customer_id: string
          id?: string
          reason?: string | null
          related_booking_id?: string | null
          related_order_id?: string | null
          related_referral_id?: string | null
          type: string
        }
        Update: {
          actor_id?: string | null
          amount?: number
          created_at?: string
          customer_id?: string
          id?: string
          reason?: string | null
          related_booking_id?: string | null
          related_order_id?: string | null
          related_referral_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_transactions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_transactions_related_booking_id_fkey"
            columns: ["related_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_transactions_related_referral_id_fkey"
            columns: ["related_referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          resource: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          resource: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          resource?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      services: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          currency: string
          deleted_at: string | null
          description: string | null
          duration_minutes: number | null
          external_square_service_id: string | null
          id: string
          internal_notes: string | null
          name: string
          price: number | null
          shopify_product_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          external_square_service_id?: string | null
          id?: string
          internal_notes?: string | null
          name: string
          price?: number | null
          shopify_product_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          external_square_service_id?: string | null
          id?: string
          internal_notes?: string | null
          name?: string
          price?: number | null
          shopify_product_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      task_statuses: {
        Row: {
          is_terminal: boolean
          label: string
          slug: string
          sort_order: number
        }
        Insert: {
          is_terminal?: boolean
          label: string
          slug: string
          sort_order: number
        }
        Update: {
          is_terminal?: boolean
          label?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assignee_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string
          related_id: string | null
          related_type: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          related_id?: string | null
          related_type?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          related_id?: string | null
          related_type?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_status_fkey"
            columns: ["status"]
            isOneToOne: false
            referencedRelation: "task_statuses"
            referencedColumns: ["slug"]
          },
        ]
      }
      webhook_events: {
        Row: {
          error: string | null
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          provider: string
          provider_event_id: string
          received_at: string
          status: string
        }
        Insert: {
          error?: string | null
          event_type: string
          id?: string
          payload: Json
          processed_at?: string | null
          provider: string
          provider_event_id: string
          received_at?: string
          status?: string
        }
        Update: {
          error?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          provider_event_id?: string
          received_at?: string
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      has_permission: {
        Args: {
          p_action: string
          p_resource: string
          p_role: Database["public"]["Enums"]["user_role"]
        }
        Returns: boolean
      }
    }
    Enums: {
      user_role:
        | "owner"
        | "admin"
        | "manager"
        | "staff"
        | "photographer"
        | "engineer"
        | "finance"
        | "marketing"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      user_role: [
        "owner",
        "admin",
        "manager",
        "staff",
        "photographer",
        "engineer",
        "finance",
        "marketing",
      ],
    },
  },
} as const
