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
      binding_options: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          rate: number
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          rate?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          rate?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      branches: {
        Row: {
          active: boolean
          address: string | null
          city: string | null
          code: string
          created_at: string
          currency: string
          email: string | null
          id: string
          manager_id: string | null
          name: string
          phone: string | null
          status: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          city?: string | null
          code: string
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          manager_id?: string | null
          name: string
          phone?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          city?: string | null
          code?: string
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          manager_id?: string | null
          name?: string
          phone?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          address: string | null
          currency: string
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          singleton: boolean
          timezone: string
          updated_at: string
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          currency?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          singleton?: boolean
          timezone?: string
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          currency?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          singleton?: boolean
          timezone?: string
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      ctp_plates: {
        Row: {
          active: boolean
          cost: number
          created_at: string
          id: string
          name: string
          plate_size: string | null
          supplier: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          cost?: number
          created_at?: string
          id?: string
          name: string
          plate_size?: string | null
          supplier?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          cost?: number
          created_at?: string
          id?: string
          name?: string
          plate_size?: string | null
          supplier?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          branch_id: string | null
          business_type: string | null
          city: string | null
          company_name: string
          created_at: string
          created_by: string | null
          customer_code: string
          customer_name: string
          email: string | null
          gst_ntn: string | null
          id: string
          mobile: string | null
          notes: string | null
          status: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          branch_id?: string | null
          business_type?: string | null
          city?: string | null
          company_name: string
          created_at?: string
          created_by?: string | null
          customer_code: string
          customer_name: string
          email?: string | null
          gst_ntn?: string | null
          id?: string
          mobile?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          branch_id?: string | null
          business_type?: string | null
          city?: string | null
          company_name?: string
          created_at?: string
          created_by?: string | null
          customer_code?: string
          customer_name?: string
          email?: string | null
          gst_ntn?: string | null
          id?: string
          mobile?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      finishing_options: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          rate: number
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          rate?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          rate?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          advance_payment: number
          created_at: string
          created_by: string | null
          current_balance: number
          discount: number
          due_date: string | null
          grand_total: number
          id: string
          invoice_date: string
          invoice_no: string
          order_id: string
          payment_status: Database["public"]["Enums"]["invoice_payment_status"]
          received_amount: number
          remaining_balance: number
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          terms: string | null
          updated_at: string
        }
        Insert: {
          advance_payment?: number
          created_at?: string
          created_by?: string | null
          current_balance?: number
          discount?: number
          due_date?: string | null
          grand_total?: number
          id?: string
          invoice_date?: string
          invoice_no: string
          order_id: string
          payment_status?: Database["public"]["Enums"]["invoice_payment_status"]
          received_amount?: number
          remaining_balance?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          terms?: string | null
          updated_at?: string
        }
        Update: {
          advance_payment?: number
          created_at?: string
          created_by?: string | null
          current_balance?: number
          discount?: number
          due_date?: string | null
          grand_total?: number
          id?: string
          invoice_date?: string
          invoice_no?: string
          order_id?: string
          payment_status?: Database["public"]["Enums"]["invoice_payment_status"]
          received_amount?: number
          remaining_balance?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          terms?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      labour_rates: {
        Row: {
          active: boolean
          created_at: string
          id: string
          labour_type: string
          rate: number
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          labour_type: string
          rate?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          labour_type?: string
          rate?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      machines: {
        Row: {
          branch_id: string | null
          colors: number | null
          cost_per_hour: number
          cost_per_sheet: number
          created_at: string
          electricity_cost: number
          id: string
          machine_type: string | null
          maintenance_cost: number
          manufacturer: string | null
          max_sheet_size: string | null
          min_sheet_size: string | null
          model: string | null
          name: string
          setup_time: number | null
          speed: number | null
          status: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          colors?: number | null
          cost_per_hour?: number
          cost_per_sheet?: number
          created_at?: string
          electricity_cost?: number
          id?: string
          machine_type?: string | null
          maintenance_cost?: number
          manufacturer?: string | null
          max_sheet_size?: string | null
          min_sheet_size?: string | null
          model?: string | null
          name: string
          setup_time?: number | null
          speed?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          colors?: number | null
          cost_per_hour?: number
          cost_per_sheet?: number
          created_at?: string
          electricity_cost?: number
          id?: string
          machine_type?: string | null
          maintenance_cost?: number
          manufacturer?: string | null
          max_sheet_size?: string | null
          min_sheet_size?: string | null
          model?: string | null
          name?: string
          setup_time?: number | null
          speed?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "machines_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      order_files: {
        Row: {
          created_at: string
          filename: string
          id: string
          mime: string | null
          order_id: string
          path: string
          size: number | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          mime?: string | null
          order_id: string
          path: string
          size?: number | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          mime?: string | null
          order_id?: string
          path?: string
          size?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_files_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          line_total: number
          order_id: string
          product_id: string | null
          quantity: number
          specs: Json
          unit: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          line_total?: number
          order_id: string
          product_id?: string | null
          quantity?: number
          specs?: Json
          unit?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          line_total?: number
          order_id?: string
          product_id?: string | null
          quantity?: number
          specs?: Json
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_timeline: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          note: string | null
          order_id: string
          status: Database["public"]["Enums"]["order_status"] | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          order_id: string
          status?: Database["public"]["Enums"]["order_status"] | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string
          status?: Database["public"]["Enums"]["order_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "order_timeline_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          binding_cost: number
          branch_id: string | null
          created_at: string
          created_by: string | null
          ctp_cost: number
          customer_id: string | null
          customer_remarks: string | null
          delivery_date: string | null
          die_cutting_cost: number
          finishing_cost: number
          id: string
          ink_cost: number
          internal_notes: string | null
          labour_cost: number
          misc_cost: number
          net_profit: number
          order_date: string
          order_no: string
          paper_cost: number
          printing_cost: number
          priority: Database["public"]["Enums"]["order_priority"]
          profit_pct: number
          quotation_ref: string | null
          sales_person_id: string | null
          selling_price: number
          status: Database["public"]["Enums"]["order_status"]
          total_cost: number
          transport_cost: number
          updated_at: string
        }
        Insert: {
          binding_cost?: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          ctp_cost?: number
          customer_id?: string | null
          customer_remarks?: string | null
          delivery_date?: string | null
          die_cutting_cost?: number
          finishing_cost?: number
          id?: string
          ink_cost?: number
          internal_notes?: string | null
          labour_cost?: number
          misc_cost?: number
          net_profit?: number
          order_date?: string
          order_no: string
          paper_cost?: number
          printing_cost?: number
          priority?: Database["public"]["Enums"]["order_priority"]
          profit_pct?: number
          quotation_ref?: string | null
          sales_person_id?: string | null
          selling_price?: number
          status?: Database["public"]["Enums"]["order_status"]
          total_cost?: number
          transport_cost?: number
          updated_at?: string
        }
        Update: {
          binding_cost?: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          ctp_cost?: number
          customer_id?: string | null
          customer_remarks?: string | null
          delivery_date?: string | null
          die_cutting_cost?: number
          finishing_cost?: number
          id?: string
          ink_cost?: number
          internal_notes?: string | null
          labour_cost?: number
          misc_cost?: number
          net_profit?: number
          order_date?: string
          order_no?: string
          paper_cost?: number
          printing_cost?: number
          priority?: Database["public"]["Enums"]["order_priority"]
          profit_pct?: number
          quotation_ref?: string | null
          sales_person_id?: string | null
          selling_price?: number
          status?: Database["public"]["Enums"]["order_status"]
          total_cost?: number
          transport_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      papers: {
        Row: {
          branch_id: string | null
          brand: string | null
          created_at: string
          current_stock: number
          gsm: number | null
          id: string
          minimum_stock: number
          name: string
          purchase_rate: number
          selling_rate: number
          sheet_size: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          brand?: string | null
          created_at?: string
          current_stock?: number
          gsm?: number | null
          id?: string
          minimum_stock?: number
          name: string
          purchase_rate?: number
          selling_rate?: number
          sheet_size?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          brand?: string | null
          created_at?: string
          current_stock?: number
          gsm?: number | null
          id?: string
          minimum_stock?: number
          name?: string
          purchase_rate?: number
          selling_rate?: number
          sheet_size?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "papers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
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
      products: {
        Row: {
          active: boolean
          category_id: string | null
          created_at: string
          default_formula: Json
          default_machine_id: string | null
          default_unit: string
          description: string | null
          id: string
          name: string
          paper_gsm: number | null
          paper_type: string | null
          product_size: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          default_formula?: Json
          default_machine_id?: string | null
          default_unit?: string
          description?: string | null
          id?: string
          name: string
          paper_gsm?: number | null
          paper_type?: string | null
          product_size?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          default_formula?: Json
          default_machine_id?: string | null
          default_unit?: string
          description?: string | null
          id?: string
          name?: string
          paper_gsm?: number | null
          paper_type?: string | null
          product_size?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_default_machine_id_fkey"
            columns: ["default_machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      transport_rates: {
        Row: {
          active: boolean
          created_at: string
          id: string
          rate: number
          transport_type: string
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          rate?: number
          transport_type: string
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          rate?: number
          transport_type?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_branches: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_branches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_branch_access: {
        Args: { _branch_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "sales"
        | "designer"
        | "production"
        | "delivery"
        | "accountant"
        | "branch_manager"
      invoice_payment_status: "unpaid" | "partial_paid" | "paid"
      invoice_status: "draft" | "issued" | "paid" | "cancelled"
      order_priority: "low" | "normal" | "high" | "urgent"
      order_status:
        | "new"
        | "artwork_pending"
        | "design"
        | "customer_approval"
        | "plate_making"
        | "printing"
        | "cutting"
        | "lamination"
        | "uv"
        | "foiling"
        | "binding"
        | "packing"
        | "ready"
        | "delivered"
        | "cancelled"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: [
        "super_admin",
        "admin",
        "sales",
        "designer",
        "production",
        "delivery",
        "accountant",
        "branch_manager",
      ],
      invoice_payment_status: ["unpaid", "partial_paid", "paid"],
      invoice_status: ["draft", "issued", "paid", "cancelled"],
      order_priority: ["low", "normal", "high", "urgent"],
      order_status: [
        "new",
        "artwork_pending",
        "design",
        "customer_approval",
        "plate_making",
        "printing",
        "cutting",
        "lamination",
        "uv",
        "foiling",
        "binding",
        "packing",
        "ready",
        "delivered",
        "cancelled",
      ],
    },
  },
} as const
