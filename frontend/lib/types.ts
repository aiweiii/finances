export interface Expense {
  transaction_id: string;
  transaction_base_id: string;
  occurrence_index: number;
  txn_date: string;
  txn_type: string;
  category: string;
  merchant: string;
  amount: number;
  bank: string;
  is_deposit_account: boolean;
  ignored: boolean;
  duplicate_count: number;
}

export interface MonthlyStats {
  total_spent: number;
  total_credited: number;
  transaction_count: number;
  top_category: string;
  top_category_amount: number;
  top_categories: { category: string; amount: number }[];
  avg_daily_spend: number;
  prev_month_total: number;
}

export interface DailySpending {
  date: string;
  amount: number;
}

export interface MonthlySpending {
  month: string;
  amount: number;
}

export interface CoverageColumn {
  key: string;
  label: string;
}

export interface CoverageMonth {
  month_key: string;
  label: string;
  imported: Record<string, boolean>;
}

export interface CoverageResponse {
  years: string[];
  year: string | null;
  columns: CoverageColumn[];
  months: CoverageMonth[];
}
