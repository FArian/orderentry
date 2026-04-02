"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Order } from "@/domain/entities/Order";
import { ServiceFactory } from "@/infrastructure/ServiceFactory";
import { FhirOrderRepository } from "@/infrastructure/repositories/FhirOrderRepository";
import type { OrderSearchQuery } from "@/application/interfaces/repositories/IOrderRepository";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OrdersState {
  orders: Order[];
  total: number;
  loading: boolean;
  error: string | null;
}

export interface UseOrdersReturn extends OrdersState {
  reload: () => void;
  deleteOrder: (id: string) => Promise<void>;
}

// ── Module-level singletons (DI via ServiceFactory) ───────────────────────────

const _service = ServiceFactory.orderService();
// Repository reference needed for delete (not exposed through service for now).
const _repo = new FhirOrderRepository();

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Presentation hook: loads ServiceRequest data through the CA stack.
 *
 *   useOrders → ServiceFactory.orderService()
 *            → OrderService → GetOrders use case
 *            → FhirOrderRepository → /api/service-requests
 */
export function useOrders(initial: OrderSearchQuery = {}): UseOrdersReturn {
  const [query] = useState<OrderSearchQuery>(initial);

  const [state, setState] = useState<OrdersState>({
    orders: [],
    total: 0,
    loading: true,
    error: null,
  });

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async (q: OrderSearchQuery) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const paged = await _service.list(q);
      if (!mountedRef.current) return;
      setState({
        orders: paged.data,
        total: paged.total,
        loading: false,
        error: null,
      });
    } catch (e: unknown) {
      if (!mountedRef.current) return;
      setState((prev) => ({
        ...prev,
        loading: false,
        error: e instanceof Error ? e.message : String(e),
      }));
    }
  }, []);

  useEffect(() => {
    load(query);
  }, [load, query]);

  const reload = useCallback(() => {
    load(query);
  }, [load, query]);

  const deleteOrder = useCallback(async (id: string) => {
    await _repo.delete(id);
  }, []);

  return { ...state, reload, deleteOrder };
}
