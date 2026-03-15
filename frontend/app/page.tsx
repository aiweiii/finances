"use client";

import { useEffect, useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  TrendingDown,
  TrendingUp,
  ArrowRightLeft,
  Crown,
  CalendarDays,
} from "lucide-react";

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
        const bankCounts = new Map<string, number>();
        data.forEach((a) =>
          bankCounts.set(a.bank, (bankCounts.get(a.bank) || 0) + 1)
        );

        const labeled = data.map((a) => ({
          ...a,
          label: a.is_deposit_account
            ? `${a.bank} Deposit`
            : `${a.bank} CC`,
        }));
        setAccounts(labeled);
      });
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

  // Fetch data when period changes
  useEffect(() => {
    if (!selectedPeriod) return;
    setLoading(true);
    const params = getParams();

    Promise.all([
      fetch(`/api/stats${params}`).then((r) => r.json()),
      fetch(`/api/spending${params}`).then((r) => r.json()),
      fetch(`/api/transactions${params}`).then((r) => r.json()),
    ]).then(([statsData, spendingData, txnData]) => {
      setStats(statsData);
      setSpending(spendingData);
      setTransactions(txnData);
      setLoading(false);
    });
  }, [selectedPeriod, getParams]);

  // Client-side filtered transactions
  const filteredTransactions =
    selectedAccounts.size === 0
      ? transactions
      : transactions.filter((t) =>
          selectedAccounts.has(`${t.bank}_${t.is_deposit_account}`)
        );

  // Derive available years from months
  const years = [...new Set(months.map((m) => m.month_key.slice(0, 4)))];

  const monthChange =
    stats && stats.prev_month_total > 0
      ? ((stats.total_spent - stats.prev_month_total) / stats.prev_month_total) *
        100
      : 0;

  const formatCurrency = (n: number) =>
    `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="min-h-screen bg-background font-sans">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">
            Finance Tracker
          </h1>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y}>
                  {y} (Full Year)
                </SelectItem>
              ))}
              {months.map((m) => (
                <SelectItem key={m.month_key} value={m.month_key}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats Cards */}
            {stats && !loading ? (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Total Spent
                      </CardTitle>
                      {monthChange >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-destructive" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-emerald-500" />
                      )}
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
                      <ArrowRightLeft className="h-4 w-4 text-emerald-500" />
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
                        Top Category
                      </CardTitle>
                      <Crown className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold capitalize">
                        {stats.top_category}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(stats.top_category_amount)} spent
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Avg Daily Spend
                      </CardTitle>
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
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
                      className="h-[350px] w-full"
                    >
                      <LineChart
                        data={spending}
                        margin={{ top: 24, left: 12, right: 12 }}
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
                          type="natural"
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
                            <TrendingUp className="h-4 w-4 text-destructive" />
                            <span>
                              Trending up {monthChange.toFixed(1)}% vs previous
                              period
                            </span>
                          </>
                        ) : (
                          <>
                            <TrendingDown className="h-4 w-4 text-emerald-500" />
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
            {accounts.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
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
                      {acct.label}
                    </Button>
                  );
                })}
                {selectedAccounts.size > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedAccounts(new Set())}
                  >
                    Clear
                  </Button>
                )}
              </div>
            )}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Transactions ({filteredTransactions.length})
                </CardTitle>
                {filteredTransactions.length > 0 && (
                  <div className="flex gap-6 pt-2 text-sm">
                    <span className="text-red-500 font-medium">
                      Debited: -{formatCurrency(
                        filteredTransactions
                          .filter((t) => t.txn_type === "DEBIT")
                          .reduce((sum, t) => sum + t.amount, 0)
                      )}
                    </span>
                    <span className="text-emerald-500 font-medium">
                      Credited: +{formatCurrency(
                        filteredTransactions
                          .filter((t) => t.txn_type === "CREDIT")
                          .reduce((sum, t) => sum + t.amount, 0)
                      )}
                    </span>
                    <span className="text-muted-foreground font-medium">
                      Net: {(() => {
                        const debited = filteredTransactions
                          .filter((t) => t.txn_type === "DEBIT")
                          .reduce((sum, t) => sum + t.amount, 0);
                        const credited = filteredTransactions
                          .filter((t) => t.txn_type === "CREDIT")
                          .reduce((sum, t) => sum + t.amount, 0);
                        const net = credited - debited;
                        return `${net >= 0 ? "+" : "-"}${formatCurrency(Math.abs(net))}`;
                      })()}
                    </span>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Merchant</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Category</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((txn) => (
                      <TableRow key={txn.id}>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {txn.txn_date}
                        </TableCell>
                        <TableCell className="font-medium break-words">
                          {txn.merchant}
                        </TableCell>
                        <TableCell
                          className={`font-medium whitespace-nowrap ${
                            txn.txn_type === "CREDIT"
                              ? "text-emerald-500"
                              : "text-red-500"
                          }`}
                        >
                          {txn.txn_type === "CREDIT" ? "+" : "-"}
                          {formatCurrency(txn.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {txn.category}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredTransactions.length === 0 && !loading && (
                      <TableRow>
                        <TableCell
                          colSpan={4}
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
  );
}
