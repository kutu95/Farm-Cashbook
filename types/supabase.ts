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