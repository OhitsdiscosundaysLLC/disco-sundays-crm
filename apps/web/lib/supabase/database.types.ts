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
          referral_source?: string | null
          shopify_customer_id?: string | null
          social_links?: Json
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
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
          completion_date: string | null
          created_at: string
          customer_id: string
          deleted_at: string | null
          due_date: string | null
          id: string
          name: string
          notes: string | null
          service_id: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completion_date?: string | null
          created_at?: string
          customer_id: string
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          name: string
          notes?: string | null
          service_id?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completion_date?: string | null
          created_at?: string
          customer_id?: string
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          service_id?: string | null
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
            foreignKeyName: "projects_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
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
