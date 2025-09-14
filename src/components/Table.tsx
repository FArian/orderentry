"use client";

import React from "react";

type PropsWithChildren = { children: React.ReactNode };

export function DataTable({ children }: PropsWithChildren) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full table-fixed divide-y divide-gray-200">
        {children}
      </table>
    </div>
  );
}

export function DataTableHead({ children }: PropsWithChildren) {
  return <thead className="border-b border-gray-200">{children}</thead>;
}

export function DataTableHeadRow({ children }: PropsWithChildren) {
  return <tr>{children}</tr>;
}

export function DataTableHeaderCell({
  children,
  className = "",
}: { children: React.ReactNode; className?: string }) {
  const base =
    "sticky top-0 z-20 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-white/85 backdrop-blur-sm shadow-sm";
  return (
    <th scope="col" className={`${base} ${className}`.trim()}>
      {children}
    </th>
  );
}

export function DataTableBody({ children }: PropsWithChildren) {
  return <tbody className="divide-y divide-gray-200">{children}</tbody>;
}

export function DataTableRow({ children, className = "", ...rest }: React.HTMLAttributes<HTMLTableRowElement> & PropsWithChildren) {
  const base = "odd:bg-white even:bg-gray-50 h-14";
  return (
    <tr className={`${base} ${className}`.trim()} {...rest}>
      {children}
    </tr>
  );
}

export function DataTableCell({ children, className = "", ...rest }: React.TdHTMLAttributes<HTMLTableCellElement> & { children: React.ReactNode }) {
  const base = "px-6 py-0 align-middle truncate";
  return (
    <td className={`${base} ${className}`.trim()} {...rest}>
      {children}
    </td>
  );
}
