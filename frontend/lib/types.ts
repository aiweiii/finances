export interface Expense {
  id: string;
  txn_date: string;
  txn_type: string;
  category: string;
  merchant: string;
  amount: number;
  bank: string;
  is_deposit_account: boolean;
}

export interface MonthlyStats {
  total_spent: number;
  total_credited: number;
  transaction_count: number;
  top_category: string;
  top_category_amount: number;
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
