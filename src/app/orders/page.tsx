"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  DataTable,
  DataTableHead,
  DataTableHeadRow,
  DataTableHeaderCell,
  DataTableBody,
  DataTableRow,
  DataTableCell,
} from "@/components/Table";

type OrderRow = {
  id: string;
  status: string;
  intent: string;
  codeText: string;
  authoredOn: string;
  orderNumber: string;
  specimenCount: number;
};

function formatDate(date?: string): string {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetch("/api/service-requests")
      .then(async (res) => {
        if (!active) return;
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const json = (await res.json()) as { data: OrderRow[] };
        setOrders(Array.isArray(json.data) ? json.data : []);
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        setError(message);
        setOrders([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const content = useMemo(() => {
    if (loading) {
      return Array.from({ length: 10 }, (_, i) => (
        <DataTableRow key={`ord-skel-${i}`}>
          <DataTableCell className="text-gray-400">&nbsp;</DataTableCell>
          <DataTableCell className="text-gray-400">&nbsp;</DataTableCell>
          <DataTableCell className="text-gray-400">&nbsp;</DataTableCell>
          <DataTableCell className="text-gray-400">&nbsp;</DataTableCell>
          <DataTableCell className="text-gray-400">&nbsp;</DataTableCell>
        </DataTableRow>
      ));
    }
    if (error) {
      return (
        <DataTableRow>
          <DataTableCell className="text-red-600" colSpan={5}>
            Fehler beim Laden: {error}
          </DataTableCell>
        </DataTableRow>
      );
    }
    if (orders.length === 0) {
      return (
        <DataTableRow>
          <DataTableCell className="text-gray-500" colSpan={5}>
            Keine Aufträge gefunden
          </DataTableCell>
        </DataTableRow>
      );
    }
    return orders.map((o) => (
      <DataTableRow key={o.id}>
        <DataTableCell title={o.orderNumber || o.id}>{o.orderNumber || o.id}</DataTableCell>
        <DataTableCell title={o.codeText}>{o.codeText || "-"}</DataTableCell>
        <DataTableCell>{o.status || "-"}</DataTableCell>
        <DataTableCell>{formatDate(o.authoredOn)}</DataTableCell>
        <DataTableCell>{o.specimenCount || 0}</DataTableCell>
      </DataTableRow>
    ));
  }, [loading, error, orders]);

  return (
    <div className="p-4">
      {/* Breadcrumb */}
      <nav className="mb-2 text-sm text-gray-600" aria-label="Brotkrumen">
        <ol className="flex items-center gap-2">
          <li>
            <Link href="/" className="text-blue-600 hover:underline">
              Startseite
            </Link>
          </li>
          <li className="text-gray-400">/</li>
          <li className="text-gray-700">Aufträge</li>
        </ol>
      </nav>

      <h1 className="text-2xl font-bold mb-4">Aufträge</h1>

      <DataTable>
        <DataTableHead>
          <DataTableHeadRow>
            <DataTableHeaderCell className="w-56">Auftrag</DataTableHeaderCell>
            <DataTableHeaderCell>Bezeichnung</DataTableHeaderCell>
            <DataTableHeaderCell className="w-32">Status</DataTableHeaderCell>
            <DataTableHeaderCell className="w-40">Datum</DataTableHeaderCell>
            <DataTableHeaderCell className="w-24">Proben</DataTableHeaderCell>
          </DataTableHeadRow>
        </DataTableHead>
        <DataTableBody>{content}</DataTableBody>
      </DataTable>
    </div>
  );
}
