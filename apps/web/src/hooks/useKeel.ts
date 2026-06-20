"use client";

import { useQuery } from "@tanstack/react-query";
import { useCurrentAccount } from "@/lib/wallet";
import { api } from "@/lib/fetcher";
import type {
  ManagerResp,
  HoldingsResp,
  OracleStateResp,
  PoliciesResp,
  PolicyDto,
  StatsResp,
  VaultResp,
  LpPositionResp,
  LpHistoryResp,
} from "./types";

export function useAddress() {
  const account = useCurrentAccount();
  return account?.address ?? null;
}

export function useManager() {
  const address = useAddress();
  return useQuery({
    queryKey: ["manager", address],
    enabled: !!address,
    queryFn: () => api.post<ManagerResp>("/manager", { userAddress: address }),
  });
}

export function useHoldings() {
  const address = useAddress();
  return useQuery({
    queryKey: ["holdings", address],
    enabled: !!address,
    queryFn: () => api.post<HoldingsResp>("/holdings", { userAddress: address }),
  });
}

export function useOracles() {
  return useQuery({
    queryKey: ["oracle-state"],
    queryFn: () => api.get<OracleStateResp>("/oracle-state"),
    // refetch fairly often so the background-computed "insure down to" depth appears
    refetchInterval: 8_000,
  });
}

export function usePolicies(statusFilter?: string[]) {
  const address = useAddress();
  return useQuery({
    queryKey: ["policies", address, statusFilter ?? "all"],
    enabled: !!address,
    queryFn: () =>
      api.post<PoliciesResp>("/policies", {
        userAddress: address,
        ...(statusFilter ? { statusFilter } : {}),
      }),
  });
}

export function usePolicy(policyId: string, poll = false) {
  return useQuery({
    queryKey: ["policy", policyId],
    enabled: !!policyId,
    queryFn: () => api.get<PolicyDto>(`/policies/${policyId}`),
    refetchInterval: poll ? 10_000 : false,
  });
}

export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: () => api.get<StatsResp>("/stats"),
    refetchInterval: 30_000,
  });
}

export function useVault() {
  return useQuery({
    queryKey: ["vault"],
    queryFn: () => api.get<VaultResp>("/vault"),
  });
}

export function useLpPosition() {
  const address = useAddress();
  return useQuery({
    queryKey: ["lp-position", address],
    enabled: !!address,
    queryFn: () => api.post<LpPositionResp>("/lp/position", { userAddress: address }),
  });
}

export function useLpHistory() {
  const address = useAddress();
  return useQuery({
    queryKey: ["lp-history", address],
    enabled: !!address,
    queryFn: () => api.post<LpHistoryResp>("/lp/history", { userAddress: address }),
  });
}
