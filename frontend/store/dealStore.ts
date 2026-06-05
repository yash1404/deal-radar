"use client";

import { create } from "zustand";

import { fetchDeal, fetchDealHealth } from "@/services/api";
import type { DealDetail, DealHealth } from "@/types/api";

interface DealState {
  selectedDealId: string | null;
  selectedEventId: string | null;
  deal: DealDetail | null;
  health: DealHealth | null;
  isLoading: boolean;
  error: string | null;
  loadDealInsights: (dealId: string, eventId?: string) => Promise<void>;
  clearSelection: () => void;
}

export const useDealStore = create<DealState>((set, get) => ({
  selectedDealId: null,
  selectedEventId: null,
  deal: null,
  health: null,
  isLoading: false,
  error: null,

  loadDealInsights: async (dealId, eventId) => {
    const requestId = eventId ?? get().selectedEventId;

    set({
      selectedDealId: dealId,
      selectedEventId: requestId ?? null,
      isLoading: true,
      error: null,
    });

    try {
      const [deal, health] = await Promise.all([
        fetchDeal(dealId),
        fetchDealHealth(dealId),
      ]);

      if (get().selectedDealId !== dealId) {
        return;
      }

      set({
        deal,
        health,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      if (get().selectedDealId !== dealId) {
        return;
      }

      let message = "Failed to load deal insights";
      if (error instanceof Error) {
        message = error.message;
      }
      if (typeof error === "object" && error !== null && "response" in error) {
        const response = (error as { response?: { data?: { message?: string } } })
          .response;
        if (response?.data?.message) {
          message = response.data.message;
        }
      }

      set({
        deal: null,
        health: null,
        isLoading: false,
        error: message,
      });
    }
  },

  clearSelection: () => {
    set({
      selectedDealId: null,
      selectedEventId: null,
      deal: null,
      health: null,
      isLoading: false,
      error: null,
    });
  },
}));
