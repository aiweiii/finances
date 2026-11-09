"use client";

import { useEffect, useState } from "react";
import { CircleCheck, CircleMinus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import type { CoverageResponse } from "@/lib/types";

export function StatementCoverage() {
  const [data, setData] = useState<CoverageResponse | null>(null);
  const [year, setYear] = useState<string>("");

  useEffect(() => {
    fetch(`/api/coverage${year ? `?year=${year}` : ""}`)
      .then((r) => r.json())
      .then(setData);
  }, [year]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Statement Coverage</CardTitle>
        <p className="text-sm text-muted-foreground">
          See which months and accounts have been imported.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Import overview</h3>
          {data && data.years.length > 0 && (
            <div className="flex gap-1">
              {data.years.map((y) => (
                <Button
                  key={y}
                  size="sm"
                  variant={y === data.year ? "default" : "ghost"}
                  onClick={() => setYear(y)}
                >
                  {y}
                </Button>
              ))}
            </div>
          )}
        </div>

        {!data ? (
          <div className="py-10 text-center text-muted-foreground">Loading...</div>
        ) : data.months.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            No statements imported yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                {data.columns.map((c) => (
                  <TableHead key={c.key} className="text-center">
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.months.map((m) => (
                <TableRow key={m.month_key}>
                  <TableCell className="font-medium">{m.label}</TableCell>
                  {data.columns.map((c) => (
                    <TableCell key={c.key} className="text-center">
                      {m.imported[c.key] ? (
                        <CircleCheck
                          className="mx-auto h-5 w-5 fill-green-700 text-white"
                          aria-label="Imported"
                        />
                      ) : (
                        <CircleMinus
                          className="mx-auto h-5 w-5 text-muted-foreground"
                          aria-label="Not uploaded"
                        />
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CircleCheck className="h-4 w-4 fill-green-700 text-white" /> Imported
          </span>
          <span className="flex items-center gap-1.5">
            <CircleMinus className="h-4 w-4" /> Not uploaded
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
