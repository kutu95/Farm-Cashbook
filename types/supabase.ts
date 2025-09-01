export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          updated_at?: string
        }
      }
      parties: {
        Row: {
          id: string
          name: string
          electricity_account_number?: string | null
          created_at?: string
        }
        Insert: {
          id?: string
          name: string
          electricity_account_number?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          electricity_account_number?: string | null
          created_at?: string
        }
      }
      electricity_bills: {
        Row: {
          id: string
          bill_date: string
          bill_date_range_start: string
          bill_date_range_end: string
          total_units_consumed: number
          units_per_day?: number | null
          is_estimated: boolean
          account_number: string
          bill_amount: number
          meter_reading?: number | null
          pdf_file_path?: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          bill_date: string
          bill_date_range_start: string
          bill_date_range_end: string
          total_units_consumed: number
          units_per_day?: number | null
          is_estimated: boolean
          account_number: string
          bill_amount: number
          meter_reading?: number | null
          pdf_file_path?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          bill_date?: string
          bill_date_range_start?: string
          bill_date_range_end?: string
          total_units_consumed?: number
          units_per_day?: number | null
          is_estimated?: boolean
          account_number?: string
          bill_amount?: number
          meter_reading?: number | null
          pdf_file_path?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      user_roles: {
        Row: {
          user_id: string
          role: string
        }
        Insert: {
          user_id: string
          role: string
        }
        Update: {
          user_id?: string
          role?: string
        }
      }
      email_subscriptions: {
        Row: {
          user_id: string
          party_id: string
        }
        Insert: {
          user_id: string
          party_id: string
        }
        Update: {
          user_id?: string
          party_id?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
} 