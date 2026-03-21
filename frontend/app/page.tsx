"use client";

import { useEffect, useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import type { MonthlyStats, Expense, DailySpending } from "@/lib/types";
import {
  ArrowUpDown,
  Eye,
  EyeOff,
  Star,
  CreditCard,
  Landmark,
  LayoutGrid,
} from "lucide-react";

const CATEGORY_EMOJI: Record<string, string> = {
  food: "🍕",
  treat: "🎁",
  transport: "🚌",
  groceries: "🛒",
  shopping: "🛍️",
  entertainment: "🎬",
  health: "💊",
  travel: "✈️",
  education: "📚",
  subscription: "🔄",
  insurance: "🛡️",
  allowance: "💰",
  enrichment: "💡",
  investment: "📈",
  lifestyle: "🥾",
  medical: "🏥",
  misc: "🗂️",
  sports: "🎾",
  "N/A": "❓",
};

const CATEGORY_COLORS: Record<string, string> = {
  food: "border-rose-400 text-rose-700",
  transport: "border-blue-400 text-blue-700",
  groceries: "border-green-400 text-green-700",
  shopping: "border-purple-400 text-purple-700",
  entertainment: "border-yellow-400 text-yellow-700",
  health: "border-pink-400 text-pink-700",
  utilities: "border-orange-400 text-orange-700",
  travel: "border-cyan-400 text-cyan-700",
  education: "border-indigo-400 text-indigo-700",
  subscription: "border-teal-400 text-teal-700",
  gifts: "border-amber-400 text-amber-700",
  insurance: "border-slate-400 text-slate-700",
  allowance: "border-emerald-400 text-emerald-700",
  enrichment: "border-violet-400 text-violet-700",
  investment: "border-sky-400 text-sky-700",
  lifestyle: "border-lime-400 text-lime-700",
  medical: "border-red-400 text-red-700",
  misc: "border-zinc-400 text-zinc-700",
  sports: "border-green-500 text-green-800",
  "N/A": "border-gray-400 text-gray-500",
};

export default function Home() {
  const [months, setMonths] = useState<{ month_key: string; label: string }[]>(
    []
  );
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [spending, setSpending] = useState<DailySpending[]>([]);
  const [transactions, setTransactions] = useState<Expense[]>([]);
  const [accounts, setAccounts] = useState<
    { bank: string; is_deposit_account: boolean; label: string }[]
  >([]);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(
    new Set()
  );
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set()
  );
  const [excludedCategories, setExcludedCategories] = useState<Set<string>>(
    new Set()
  );
  const [editingTxnId, setEditingTxnId] = useState<string | null>(null);
  const [categorySearch, setCategorySearch] = useState("");
  const [sortKey, setSortKey] = useState<"txn_date" | "merchant" | "amount" | "category">("txn_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [hideIgnored, setHideIgnored] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch available months and accounts
  useEffect(() => {
    fetch("/api/months")
      .then((r) => r.json())
      .then((data) => {
        setMonths(data);
        if (data.length > 0) {
          setSelectedPeriod(data[0].month_key);
        }
      });

    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data: { bank: string; is_deposit_account: boolean }[]) => {
        const labeled = data.map((a) => ({
          ...a,
          label: a.is_deposit_account
            ? `${a.bank} Deposit`
            : `${a.bank} CC`,
        }));
        setAccounts(labeled);
      });

    fetch("/api/categories")
      .then((r) => r.json())
      .then((data: string[]) => setCategories(data));
  }, []);

  // Build query params from selected period
  const getParams = useCallback(() => {
    if (!selectedPeriod) return "";
    if (selectedPeriod.length === 4) {
      return `?year=${selectedPeriod}`;
    }
    return `?month=${selectedPeriod}`;
  }, [selectedPeriod]);

  const toggleAccount = (key: string) => {
    setSelectedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const toggleExcludedCategory = (cat: string) => {
    setExcludedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const toggleIgnored = async (txnId: string, currentIgnored: boolean) => {
    await fetch(`/api/transactions/${txnId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ignored: !currentIgnored }),
    });
    setTransactions((prev) =>
      prev.map((t) => (t.id === txnId ? { ...t, ignored: !currentIgnored } : t))
    );
  };

  const updateCategory = async (txnId: string, newCategory: string) => {
    await fetch(`/api/transactions/${txnId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: newCategory }),
    });
    setTransactions((prev) =>
      prev.map((t) => (t.id === txnId ? { ...t, category: newCategory } : t))
    );
    setEditingTxnId(null);
  };

  // Fetch data when period or excluded categories change
  useEffect(() => {
    if (!selectedPeriod) return;
    setLoading(true);
    const params = getParams();
    const excludeParam = excludedCategories.size > 0
      ? `${params ? "&" : "?"}excludeCategories=${[...excludedCategories].join(",")}`
      : "";

    Promise.all([
      fetch(`/api/stats${params}${excludeParam}`).then((r) => r.json()),
      fetch(`/api/spending${params}${excludeParam}`).then((r) => r.json()),
      fetch(`/api/transactions${params}`).then((r) => r.json()),
    ]).then(([statsData, spendingData, txnData]) => {
      setStats(statsData);
      setSpending(spendingData);
      setTransactions(txnData);
      setLoading(false);
    });
  }, [selectedPeriod, getParams, excludedCategories]);

  // Client-side filtered transactions
  const filteredTransactions = transactions.filter((t) => {
    if (selectedAccounts.size > 0 && !selectedAccounts.has(`${t.bank}_${t.is_deposit_account}`)) {
      return false;
    }
    if (selectedCategories.size > 0 && !selectedCategories.has(t.category)) {
      return false;
    }
    if (hideIgnored && t.ignored) {
      return false;
    }
    return true;
  });

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "amount" ? "desc" : "asc");
    }
  };

  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "txn_date":
        cmp = a.txn_date.localeCompare(b.txn_date);
        break;
      case "merchant":
        cmp = a.merchant.localeCompare(b.merchant);
        break;
      case "amount":
        cmp = a.amount - b.amount;
        break;
      case "category":
        cmp = a.category.localeCompare(b.category);
        break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  // Derive available years from months, group months by year
  const years = [...new Set(months.map((m) => m.month_key.slice(0, 4)))];
  const monthsByYear = years.map((year) => ({
    year,
    months: months.filter((m) => m.month_key.startsWith(year)),
  }));

  const monthChange =
    stats && stats.prev_month_total > 0
      ? ((stats.total_spent - stats.prev_month_total) / stats.prev_month_total) *
        100
      : 0;

  const formatCurrency = (n: number) =>
    `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="min-h-screen bg-background font-sans">
      <div className="flex">
        {/* Left Sidebar */}
        <aside className="w-[200px] shrink-0 border-r bg-muted/30 h-screen sticky top-0 overflow-y-auto px-3 py-6">
          <h2 className="mb-4 px-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Period
          </h2>
          <nav className="space-y-1">
            {monthsByYear.map(({ year, months: yMonths }) => (
              <div key={year}>
                <button
                  onClick={() => setSelectedPeriod(year)}
                  className={cn(
                    "w-full text-left px-2 py-1.5 text-sm font-bold rounded-md transition-colors",
                    selectedPeriod === year
                      ? "bg-slate-800 text-white"
                      : "hover:bg-accent/50"
                  )}
                >
                  {year}
                </button>
                {yMonths.map((m) => (
                  <button
                    key={m.month_key}
                    onClick={() => setSelectedPeriod(m.month_key)}
                    className={cn(
                      "w-full text-left pl-5 pr-2 py-1 text-sm rounded-md transition-colors",
                      selectedPeriod === m.month_key
                        ? "bg-slate-800 text-white font-medium"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0 px-6 py-10 max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight">
              Finance Tracker
            </h1>
          </div>

          <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
          </TabsList>

          <h2 className="text-lg font-semibold">
            {selectedPeriod.length === 4
              ? selectedPeriod
              : months.find((m) => m.month_key === selectedPeriod)?.label ?? selectedPeriod}
          </h2>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {categories.length > 0 && (
              <div className="rounded-lg border p-4">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Exclude Categories</span>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => {
                    const isExcluded = excludedCategories.has(cat);
                    const emoji = CATEGORY_EMOJI[cat] ?? "";
                    const colorClass = CATEGORY_COLORS[cat] ?? "";
                    return (
                      <Button
                        key={cat}
                        variant={isExcluded ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          "capitalize",
                          !isExcluded && colorClass
                        )}
                        onClick={() => toggleExcludedCategory(cat)}
                      >
                        {emoji && <span className="mr-1">{emoji}</span>}
                        {cat}
                      </Button>
                    );
                  })}
                  {excludedCategories.size > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExcludedCategories(new Set())}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            )}
            {/* Stats Cards */}
            {stats && !loading ? (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Total Spent
                      </CardTitle>
                      <span className="text-lg">💸</span>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatCurrency(stats.total_spent)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {monthChange >= 0 ? "+" : ""}
                        {monthChange.toFixed(1)}% vs previous period
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Total Credited
                      </CardTitle>
                      <span className="text-lg">💰</span>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-emerald-500">
                        +{formatCurrency(stats.total_credited)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        this period
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Top Categories
                      </CardTitle>
                      <span className="text-lg">👑</span>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {(stats.top_categories ?? []).map((cat, i) => (
                          <div key={cat.category} className="flex items-center justify-between">
                            <span className="text-sm capitalize">
                              <span className="text-muted-foreground mr-1.5">{i + 1}.</span>
                              {CATEGORY_EMOJI[cat.category || "N/A"] && <span className="mr-1">{CATEGORY_EMOJI[cat.category || "N/A"]}</span>}
                              {cat.category || "N/A"}
                            </span>
                            <span className="text-sm font-medium">{formatCurrency(cat.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Avg Daily Spend
                      </CardTitle>
                      <span className="text-lg">📅</span>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatCurrency(stats.avg_daily_spend)}
                      </div>
                      <p className="text-xs text-muted-foreground">per day</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Spending Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">
                      Spending Over Time
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {selectedPeriod.length === 4
                        ? "Monthly totals"
                        : "Daily totals"}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer
                      config={
                        {
                          amount: {
                            label: "Spent",
                            color: "var(--chart-1)",
                          },
                        } satisfies ChartConfig
                      }
                      className="h-[350px] w-full [&_.recharts-wrapper]:overflow-visible [&_.recharts-surface]:overflow-visible"
                    >
                      <LineChart
                        data={spending}
                        margin={{ top: 24, left: 12, right: 40 }}
                      >
                        <CartesianGrid vertical={false} />
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          tickFormatter={(v) => {
                            if (selectedPeriod.length === 4) return v;
                            return v.split("-")[2];
                          }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          tickFormatter={(v) => `$${v}`}
                          domain={[0, "auto"]}
                        />
                        <ChartTooltip
                          cursor={false}
                          content={
                            <ChartTooltipContent
                              indicator="line"
                              formatter={(value) => (
                                <span>
                                  Spent{" "}
                                  <span className="font-mono font-medium">
                                    {formatCurrency(value as number)}
                                  </span>
                                </span>
                              )}
                            />
                          }
                        />
                        <Line
                          dataKey="amount"
                          type="monotone"
                          stroke="var(--color-amount)"
                          strokeWidth={2}
                          dot={{ fill: "var(--color-amount)", r: 4 }}
                          activeDot={{ r: 6 }}
                        >
                          <LabelList
                            position="top"
                            offset={12}
                            className="fill-foreground"
                            fontSize={11}
                            formatter={(v: number) => `$${v.toLocaleString()}`}
                          />
                        </Line>
                      </LineChart>
                    </ChartContainer>
                    {stats && (
                      <div className="mt-4 flex items-center gap-2 text-sm">
                        {monthChange >= 0 ? (
                          <>
                            <span>📈</span>
                            <span>
                              Trending up {monthChange.toFixed(1)}% vs previous
                              period
                            </span>
                          </>
                        ) : (
                          <>
                            <span>📉</span>
                            <span>
                              Trending down{" "}
                              {Math.abs(monthChange).toFixed(1)}% vs previous
                              period
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="py-20 text-center text-muted-foreground">
                Loading...
              </div>
            )}
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions">
            <div className="rounded-lg border p-4 space-y-4 mb-4">
              {/* Account Filters */}
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Account</span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={selectedAccounts.size === 0 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedAccounts(new Set())}
                  >
                    <Star className="h-3.5 w-3.5 mr-1.5" />
                    All Accounts
                  </Button>
                  {accounts.map((acct) => {
                    const key = `${acct.bank}_${acct.is_deposit_account}`;
                    const isActive = selectedAccounts.has(key);
                    return (
                      <Button
                        key={key}
                        variant={isActive ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleAccount(key)}
                      >
                        {acct.is_deposit_account ? (
                          <Landmark className="h-3.5 w-3.5 mr-1.5" />
                        ) : (
                          <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        {acct.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Category Filters */}
              {categories.length > 0 && (
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Category</span>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={selectedCategories.size === 0 ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategories(new Set())}
                    >
                      <LayoutGrid className="h-3.5 w-3.5 mr-1.5" />
                      All
                    </Button>
                    {categories.map((cat) => {
                      const isActive = selectedCategories.has(cat);
                      const emoji = CATEGORY_EMOJI[cat] ?? "";
                      const colorClass = CATEGORY_COLORS[cat] ?? "";
                      return (
                        <Button
                          key={cat}
                          variant={isActive ? "default" : "outline"}
                          size="sm"
                          className={cn(
                            "capitalize",
                            !isActive && colorClass
                          )}
                          onClick={() => toggleCategory(cat)}
                        >
                          {emoji && <span className="mr-1">{emoji}</span>}
                          {cat}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Transaction summary row */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-6">
                <span className="text-sm font-medium">
                  Transactions ({filteredTransactions.length})
                </span>
                {filteredTransactions.length > 0 && (
                  <>
                    <span className="text-sm text-red-500 font-medium">
                      Debited: -{formatCurrency(
                        filteredTransactions
                          .filter((t) => t.txn_type === "DEBIT" && !t.ignored)
                          .reduce((sum, t) => sum + t.amount, 0)
                      )}
                    </span>
                    <span className="text-sm text-emerald-500 font-medium">
                      Credited: +{formatCurrency(
                        filteredTransactions
                          .filter((t) => t.txn_type === "CREDIT" && !t.ignored)
                          .reduce((sum, t) => sum + t.amount, 0)
                      )}
                    </span>
                    <span className="text-sm text-muted-foreground font-medium">
                      Net: {(() => {
                        const debited = filteredTransactions
                          .filter((t) => t.txn_type === "DEBIT" && !t.ignored)
                          .reduce((sum, t) => sum + t.amount, 0);
                        const credited = filteredTransactions
                          .filter((t) => t.txn_type === "CREDIT" && !t.ignored)
                          .reduce((sum, t) => sum + t.amount, 0);
                        const net = credited - debited;
                        return `${net >= 0 ? "+" : "-"}${formatCurrency(Math.abs(net))}`;
                      })()}
                    </span>
                  </>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHideIgnored((v) => !v)}
              >
                {hideIgnored ? <EyeOff className="h-3.5 w-3.5 mr-1.5" /> : <Eye className="h-3.5 w-3.5 mr-1.5" />}
                {hideIgnored ? "Show Ignored" : "Hide Ignored"}
              </Button>
            </div>

            <Card>
              <CardContent className="pt-4 overflow-visible [&_[data-slot=table-container]]:overflow-visible">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {([["txn_date", "Date"], ["merchant", "Merchant"], ["amount", "Amount"], ["category", "Category"]] as const).map(([key, label]) => (
                        <TableHead key={key}>
                          <button
                            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                            onClick={() => toggleSort(key)}
                          >
                            {label}
                            <ArrowUpDown className={cn("h-3 w-3", sortKey === key ? "text-foreground" : "text-muted-foreground/50")} />
                          </button>
                        </TableHead>
                      ))}
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedTransactions.map((txn) => (
                      <TableRow key={txn.id} className={txn.ignored ? "opacity-40" : ""}>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {txn.txn_date}
                        </TableCell>
                        <TableCell className="font-medium max-w-[300px] truncate" title={txn.merchant}>
                          {txn.merchant}
                        </TableCell>
                        <TableCell
                          className={`font-medium whitespace-nowrap ${
                            txn.ignored
                              ? "text-muted-foreground line-through"
                              : txn.txn_type === "CREDIT"
                                ? "text-emerald-500"
                                : "text-red-500"
                          }`}
                        >
                          {txn.txn_type === "CREDIT" ? "+" : "-"}
                          {formatCurrency(txn.amount)}
                        </TableCell>
                        <TableCell className="overflow-visible">
                          <div className="relative inline-block">
                            <button
                              onClick={() => {
                                if (editingTxnId === txn.id) {
                                  setEditingTxnId(null);
                                  setCategorySearch("");
                                } else {
                                  setEditingTxnId(txn.id);
                                  setCategorySearch("");
                                }
                              }}
                              className="cursor-pointer"
                            >
                              <Badge
                                variant="outline"
                                className={cn(
                                  "capitalize",
                                  CATEGORY_COLORS[txn.category] ?? ""
                                )}
                              >
                                {CATEGORY_EMOJI[txn.category] && (
                                  <span className="mr-1">{CATEGORY_EMOJI[txn.category]}</span>
                                )}
                                {txn.category}
                              </Badge>
                            </button>
                            {editingTxnId === txn.id && (
                              <>
                                <div
                                  className="fixed inset-0 z-40"
                                  onClick={() => { setEditingTxnId(null); setCategorySearch(""); }}
                                />
                                <div className="absolute right-0 z-50 mt-1 w-48 rounded-md border bg-popover shadow-md flex flex-col">
                                  <input
                                    autoFocus
                                    type="text"
                                    placeholder="Search categories..."
                                    value={categorySearch}
                                    onChange={(e) => setCategorySearch(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Escape") {
                                        setEditingTxnId(null);
                                        setCategorySearch("");
                                      }
                                      if (e.key === "Enter") {
                                        const filtered = categories.filter((c) =>
                                          c.toLowerCase().includes(categorySearch.toLowerCase())
                                        );
                                        if (filtered.length > 0) {
                                          updateCategory(txn.id, filtered[0]);
                                          setCategorySearch("");
                                        }
                                      }
                                    }}
                                    className="w-full px-3 py-2 text-sm border-b bg-transparent outline-none placeholder:text-muted-foreground"
                                  />
                                  <div className="max-h-48 overflow-y-auto p-1">
                                    {categories
                                      .filter((c) =>
                                        c.toLowerCase().includes(categorySearch.toLowerCase())
                                      )
                                      .map((cat) => (
                                        <button
                                          key={cat}
                                          className={cn(
                                            "block w-full text-left px-3 py-1.5 text-sm rounded-sm capitalize hover:bg-accent",
                                            cat === txn.category && "font-medium bg-accent"
                                          )}
                                          onClick={() => {
                                            updateCategory(txn.id, cat);
                                            setCategorySearch("");
                                          }}
                                        >
                                          {CATEGORY_EMOJI[cat] && <span className="mr-1">{CATEGORY_EMOJI[cat]}</span>}
                                          {cat}
                                        </button>
                                      ))}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => toggleIgnored(txn.id, txn.ignored)}
                          >
                            {txn.ignored ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
                            {txn.ignored ? "Restore" : "Ignore"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {sortedTransactions.length === 0 && !loading && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="py-10 text-center text-muted-foreground"
                        >
                          No transactions found for this period.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          </Tabs>
        </div>
      </div>

    </div>
  );
}
