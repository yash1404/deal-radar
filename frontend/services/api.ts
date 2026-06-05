import axios from "axios";

import type { DealDetail, DealHealth } from "@/types/api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:5000";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30_000,
});

export async function fetchDeal(dealId: string): Promise<DealDetail> {
  const { data } = await apiClient.get<DealDetail>(`/deals/${dealId}`);
  return data;
}

export async function fetchDealHealth(dealId: string): Promise<DealHealth> {
  const { data } = await apiClient.get<DealHealth>(`/deals/${dealId}/health`);
  return data;
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}
