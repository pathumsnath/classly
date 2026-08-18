// Hand-authored to match supabase/migrations/0001_init.sql.
// Once the Supabase project exists, regenerate with:
//   npx supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts
// and re-apply this header comment if you want to keep it in sync manually.

export type AppRole = "owner" | "admin_staff" | "tutor" | "student";
export type TutorStatus = "active" | "inactive";
export type EnrollmentStatus = "active" | "inactive";
export type AttendanceStatus = "present" | "absent" | "late";
export type FeeType = "monthly_flat" | "per_session";
export type TutorPaymentModel = "revenue_share" | "fixed" | "per_student" | "per_session";
export type PaymentStatus = "pending" | "partial" | "paid" | "overdue" | "waived";
export type PaymentMethod = "cash" | "bank_transfer" | "other" | "wallet_credit";
export type WalletTransactionType = "credit" | "debit";
export type SalaryStatus = "pending" | "paid";
export type NotificationType = "invite" | "receipt" | "attendance_alert";
export type GradeLevel =
  | "grade_1"
  | "grade_2"
  | "grade_3"
  | "grade_4"
  | "grade_5"
  | "grade_6"
  | "grade_7"
  | "grade_8"
  | "grade_9"
  | "grade_10"
  | "grade_11"
  | "grade_12"
  | "grade_13"
  | "ol"
  | "al";
export type ClassMedium = "sinhala" | "english" | "tamil";

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          auth_user_id: string | null;
          name: string;
          phone: string;
          email: string | null;
          parent_phone: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id?: string | null;
          name: string;
          phone: string;
          email?: string | null;
          parent_phone?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
        Relationships: [];
      };
      institutes: {
        Row: {
          id: string;
          name: string;
          address: string | null;
          owner_id: string;
          logo_url: string | null;
          onboarding_completed_at: string | null;
          revenue_share_commission_percent: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          address?: string | null;
          owner_id: string;
          logo_url?: string | null;
          onboarding_completed_at?: string | null;
          revenue_share_commission_percent?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["institutes"]["Insert"]>;
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          institute_id: string;
          role: AppRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          institute_id: string;
          role: AppRole;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_roles"]["Insert"]>;
        Relationships: [];
      };
      institute_tutors: {
        Row: {
          id: string;
          institute_id: string;
          tutor_id: string;
          joined_date: string | null;
          status: TutorStatus;
          commission_override_percent: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          institute_id: string;
          tutor_id: string;
          joined_date?: string | null;
          status?: TutorStatus;
          commission_override_percent?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["institute_tutors"]["Insert"]>;
        Relationships: [];
      };
      institute_students: {
        Row: {
          id: string;
          institute_id: string;
          student_id: string;
          joined_date: string | null;
          status: TutorStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          institute_id: string;
          student_id: string;
          joined_date?: string | null;
          status?: TutorStatus;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["institute_students"]["Insert"]>;
        Relationships: [];
      };
      class_cancellations: {
        Row: {
          id: string;
          institute_id: string;
          class_id: string;
          date: string;
          recorded_by: string;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          institute_id: string;
          class_id: string;
          date: string;
          recorded_by: string;
          recorded_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["class_cancellations"]["Insert"]>;
        Relationships: [];
      };
      classes: {
        Row: {
          id: string;
          institute_id: string;
          tutor_id: string;
          subject_id: string;
          grade: GradeLevel | null;
          medium: ClassMedium | null;
          schedule_days: string[];
          schedule_start_time: string | null;
          schedule_end_time: string | null;
          room: string | null;
          max_students: number | null;
          fee_amount: number;
          fee_type: FeeType;
          tutor_payment_model: TutorPaymentModel;
          tutor_payment_value: number;
          group_name: string | null;
          billing_cycle_sessions: number | null;
          cycle_started_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          institute_id: string;
          tutor_id: string;
          subject_id: string;
          grade?: GradeLevel | null;
          medium?: ClassMedium | null;
          schedule_days?: string[];
          schedule_start_time?: string | null;
          schedule_end_time?: string | null;
          room?: string | null;
          max_students?: number | null;
          fee_amount: number;
          fee_type: FeeType;
          tutor_payment_model: TutorPaymentModel;
          tutor_payment_value: number;
          group_name?: string | null;
          billing_cycle_sessions?: number | null;
          cycle_started_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["classes"]["Insert"]>;
        Relationships: [];
      };
      subjects: {
        Row: {
          id: string;
          institute_id: string;
          name: string;
          status: TutorStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          institute_id: string;
          name: string;
          status?: TutorStatus;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["subjects"]["Insert"]>;
        Relationships: [];
      };
      enrollments: {
        Row: {
          id: string;
          institute_id: string;
          student_id: string;
          class_id: string;
          status: EnrollmentStatus;
          enrolled_at: string;
        };
        Insert: {
          id?: string;
          institute_id: string;
          student_id: string;
          class_id: string;
          status?: EnrollmentStatus;
          enrolled_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["enrollments"]["Insert"]>;
        Relationships: [];
      };
      attendance: {
        Row: {
          id: string;
          institute_id: string;
          enrollment_id: string;
          class_id: string;
          date: string;
          status: AttendanceStatus;
          recorded_by: string;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          institute_id: string;
          enrollment_id: string;
          class_id: string;
          date: string;
          status: AttendanceStatus;
          recorded_by: string;
          recorded_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["attendance"]["Insert"]>;
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          institute_id: string;
          student_id: string;
          class_id: string;
          month: string;
          cycle_started_at: string;
          amount_due: number;
          amount_paid: number;
          balance: number;
          status: PaymentStatus;
          method: PaymentMethod | null;
          reference: string | null;
          paid_date: string | null;
          recorded_by: string | null;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          institute_id: string;
          student_id: string;
          class_id: string;
          month: string;
          cycle_started_at: string;
          amount_due: number;
          amount_paid?: number;
          status?: PaymentStatus;
          method?: PaymentMethod | null;
          reference?: string | null;
          paid_date?: string | null;
          recorded_by?: string | null;
          recorded_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
        Relationships: [];
      };
      salary_payments: {
        Row: {
          id: string;
          institute_id: string;
          tutor_id: string;
          month: string;
          amount: number;
          method: PaymentMethod | null;
          status: SalaryStatus;
          paid_date: string | null;
          recorded_by: string | null;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          institute_id: string;
          tutor_id: string;
          month: string;
          amount: number;
          method?: PaymentMethod | null;
          status?: SalaryStatus;
          paid_date?: string | null;
          recorded_by?: string | null;
          recorded_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["salary_payments"]["Insert"]>;
        Relationships: [];
      };
      tutor_advances: {
        Row: {
          id: string;
          institute_id: string;
          tutor_id: string;
          month: string;
          amount: number;
          reason: string;
          recorded_by: string;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          institute_id: string;
          tutor_id: string;
          month: string;
          amount: number;
          reason: string;
          recorded_by: string;
          recorded_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tutor_advances"]["Insert"]>;
        Relationships: [];
      };
      fee_reminder_sends: {
        Row: {
          id: string;
          institute_id: string;
          class_id: string;
          period_key: string;
          sent_at: string;
        };
        Insert: {
          id?: string;
          institute_id: string;
          class_id: string;
          period_key: string;
          sent_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["fee_reminder_sends"]["Insert"]>;
        Relationships: [];
      };
      wallet_transactions: {
        Row: {
          id: string;
          institute_id: string;
          student_id: string;
          amount: number;
          type: WalletTransactionType;
          payment_id: string | null;
          note: string | null;
          recorded_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          institute_id: string;
          student_id: string;
          amount: number;
          type: WalletTransactionType;
          payment_id?: string | null;
          note?: string | null;
          recorded_by: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["wallet_transactions"]["Insert"]>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          institute_id: string;
          type: NotificationType;
          message: string;
          sent_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          institute_id: string;
          type: NotificationType;
          message: string;
          sent_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_current_session: {
        Args: Record<string, never>;
        Returns: {
          user_id: string;
          name: string;
          phone: string;
          institute_id: string;
          institute_name: string;
          role: AppRole;
        }[];
      };
    };
  };
}
