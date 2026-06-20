"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ConnectButton, useSignAndExecuteTransaction } from "@/lib/wallet";
import { useQuery } from "@tanstack/react-query";
import { api, KeelApiError } from "@/lib/fetcher";
import { useAddress, useManager, useOracles } from "@/hooks/useKeel";
import type { Oracle, QuoteResp, BuildMintResp, ConfirmMintResp } from "@/hooks/types";
import { CreateAccount } from "@/components/CreateAccount";
import { Card, Stat, Button, Field, inputStyle, Spinner, ErrorBox, ConnectPrompt } from "@/components/ui";
import { fmtUsd, fmtPct, countdownToTs, fmtDate, usdFromBaseUnits } from "@/components/format";

function errMsg(e: unknown) {
  return e instanceof KeelApiError ? e.message : (e as Error)?.message ?? "Something went wrong";
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function BuyCoverPage() {
  const address = useAddress();
  const manager = useManager();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [oracle, setOracle] = useState<Oracle | null>(null);

  // configure inputs
  const [sumInsured, setSumInsured] = useState("");
  const [triggerPrice, setTriggerPrice] = useState("");
  const [floorPrice, setFloorPrice] = useState("");
  const [rungs, setRungs] = useState("6");

  if (!address) {
    return (
      <div>
        <h1 style={{ fontSize: 28 }}>Buy cover</h1>
        <ConnectPrompt>
          <div style={{ marginBottom: 16 }}>Connect your wallet to buy cover.</div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <ConnectButton />
          </div>
        </ConnectPrompt>
      </div>
    );
  }

  const managerId = manager.data?.managerId ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 760 }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>Buy cover</h1>
      <Steps step={step} />

      {step !== 3 && manager.data?.needsCreation && manager.data.creationTxBytes && (
        <Card title="Create your Keel account first">
          <CreateAccount address={address} creationTxBytes={manager.data.creationTxBytes} />
        </Card>
      )}

      {step === 1 && (
        <SelectMarket
          onPick={(o) => {
            setOracle(o);
            // Protection runs from the current price (trigger) down to a crash target (floor).
            // Default the floor to the deepest level this market actually supports.
            const spot = o.spotPrice > 0 ? o.spotPrice : 0;
            setTriggerPrice(spot > 0 ? Math.round(spot).toString() : "");
            const defaultFloor = o.protectDownTo ?? (spot > 0 ? spot * 0.88 : 0);
            setFloorPrice(defaultFloor > 0 ? Math.round(defaultFloor).toString() : "");
            setStep(2);
          }}
        />
      )}

      {step === 2 && oracle && (
        <Configure
          oracle={oracle}
          sumInsured={sumInsured}
          setSumInsured={setSumInsured}
          triggerPrice={triggerPrice}
          setTriggerPrice={setTriggerPrice}
          floorPrice={floorPrice}
          setFloorPrice={setFloorPrice}
          rungs={rungs}
          setRungs={setRungs}
          onBack={() => setStep(1)}
          onContinue={() => setStep(3)}
        />
      )}

      {step === 3 && oracle && (
        <Review
          address={address}
          managerId={managerId}
          oracle={oracle}
          sumInsured={Number(sumInsured)}
          triggerPrice={Number(triggerPrice)}
          floorPrice={floorPrice ? Number(floorPrice) : 0}
          rungs={Number(rungs)}
          onBack={() => setStep(2)}
          onDone={(policyId) => router.push(`/policy/${policyId}`)}
        />
      )}
    </div>
  );
}

function Steps({ step }: { step: number }) {
  const labels = ["Select market", "Configure", "Review & buy"];
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {labels.map((l, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <div
            key={l}
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: 8,
              fontSize: 13,
              textAlign: "center",
              background: active ? "var(--accent)" : "var(--panel)",
              color: active ? "#06210f" : done ? "var(--accent)" : "var(--muted)",
              border: "1px solid var(--border)",
              fontWeight: 600,
            }}
          >
            {n}. {l}
          </div>
        );
      })}
    </div>
  );
}

function SelectMarket({ onPick }: { onPick: (o: Oracle) => void }) {
  const oracles = useOracles();
  if (oracles.isLoading) return <Spinner label="Loading markets…" />;
  if (oracles.isError) return <ErrorBox message={errMsg(oracles.error)} />;
  const list = oracles.data?.oracles ?? [];
  if (list.length === 0)
    return (
      <Card>
        <div style={{ color: "var(--muted)" }}>No active markets available right now.</div>
      </Card>
    );

  const spot = list.find((o) => o.spotPrice > 0)?.spotPrice ?? 0;
  return (
    <Card title="Choose how long you want protection">
      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
        All markets cover <strong style={{ color: "var(--text)" }}>{list[0]?.underlying ?? "BTC"}</strong>{" "}
        at today’s spot of{" "}
        <strong style={{ color: "var(--text)" }}>{spot > 0 ? fmtUsd(spot) : "n/a"}</strong>. Pick a{" "}
        <strong style={{ color: "var(--text)" }}>term</strong> — longer protection costs a higher premium and
        lets you set a deeper trigger. You’ll see the exact premium next.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {list.map((o) => (
          <button
            key={o.oracleId}
            onClick={() => onPick(o)}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 14px",
              border: "1px solid var(--border)",
              borderRadius: 10,
              background: "var(--bg)",
              color: "var(--text)",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>
                {o.underlying} cover · {termLabel(o.expiryTimestamp)}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                {o.protectDownTo == null ? (
                  <>Protection depth loading… · expires in {countdownToTs(o.expiryTimestamp)}</>
                ) : o.spotPrice > 0 && o.protectDownTo <= o.spotPrice * 0.98 ? (
                  <>
                    Insure down to{" "}
                    <strong style={{ color: "var(--text)" }}>{fmtUsd(o.protectDownTo)}</strong>{" "}
                    ({Math.round((1 - o.protectDownTo / o.spotPrice) * 100)}% drop) · expires in{" "}
                    {countdownToTs(o.expiryTimestamp)}
                  </>
                ) : (
                  <>Too short to insure a meaningful drop · expires in {countdownToTs(o.expiryTimestamp)}</>
                )}
              </div>
            </div>
            <span style={{ color: "var(--accent)", fontSize: 13, whiteSpace: "nowrap" }}>Select →</span>
          </button>
        ))}
      </div>
    </Card>
  );
}

/** Friendly protection-window label from an expiry timestamp. */
function termLabel(expiryMs: number): string {
  const mins = Math.max(0, Math.round((expiryMs - Date.now()) / 60000));
  if (mins < 60) return `${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

function Configure({
  oracle,
  sumInsured,
  setSumInsured,
  triggerPrice,
  setTriggerPrice,
  floorPrice,
  setFloorPrice,
  rungs,
  setRungs,
  onBack,
  onContinue,
}: {
  oracle: Oracle;
  sumInsured: string;
  setSumInsured: (s: string) => void;
  triggerPrice: string;
  setTriggerPrice: (s: string) => void;
  floorPrice: string;
  setFloorPrice: (s: string) => void;
  rungs: string;
  setRungs: (s: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const address = useAddress();
  const debouncedSum = useDebounced(sumInsured, 500);
  const debouncedTrigger = useDebounced(triggerPrice, 500);
  const debouncedFloor = useDebounced(floorPrice, 500);
  const debouncedRungs = useDebounced(rungs, 500);

  const canQuote =
    Number(debouncedSum) > 0 && Number(debouncedTrigger) > 0 && Number(debouncedRungs) >= 1;

  const body = useMemo(
    () => ({
      oracleId: oracle.oracleId,
      sumInsured: Number(debouncedSum),
      triggerPrice: Number(debouncedTrigger),
      ...(Number(debouncedFloor) > 0 ? { floorPrice: Number(debouncedFloor) } : {}),
      rungs: Number(debouncedRungs),
    }),
    [oracle.oracleId, debouncedSum, debouncedTrigger, debouncedFloor, debouncedRungs],
  );

  const quote = useQuery({
    queryKey: ["quote", body],
    enabled: !!address && canQuote,
    retry: false,
    queryFn: () => api.post<QuoteResp>("/quote", body),
  });

  const q = quote.data;
  const hasError = quote.isError;
  const canContinue = !!q && !hasError && q.perLeg.some((l) => l.mintable);

  const spot = oracle.spotPrice;
  return (
    <Card title={`Insure your ${oracle.underlying} against a crash`}>
      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
        {oracle.underlying} is <strong style={{ color: "var(--text)" }}>{spot > 0 ? fmtUsd(spot) : "n/a"}</strong>{" "}
        now. Protection runs from the current price down to your crash target — you get paid more the
        further it falls, and the full amount if it reaches your target.
        {oracle.protectDownTo && oracle.protectDownTo <= spot * 0.98 ? (
          <>
            {" "}This market can insure down to about{" "}
            <strong style={{ color: "var(--text)" }}>{fmtUsd(oracle.protectDownTo)}</strong>.
          </>
        ) : null}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Field label="Coverage amount ($)" hint="What you receive if it falls to your target.">
          <input
            style={inputStyle}
            type="number"
            min={0}
            value={sumInsured}
            onChange={(e) => setSumInsured(e.target.value)}
            placeholder="1000"
          />
        </Field>
        <Field label="Protect down to ($)" hint="Your crash target — full payout at this price.">
          <input
            style={inputStyle}
            type="number"
            min={0}
            value={floorPrice}
            onChange={(e) => setFloorPrice(e.target.value)}
            placeholder={spot > 0 ? Math.round(spot * 0.88).toString() : "56000"}
          />
        </Field>
        <Field label="Start protecting below ($)" hint="Default: current price. Lower = cheaper, you absorb the first drop.">
          <input
            style={inputStyle}
            type="number"
            min={0}
            value={triggerPrice}
            onChange={(e) => setTriggerPrice(e.target.value)}
            placeholder={spot > 0 ? Math.round(spot).toString() : "trigger"}
          />
        </Field>
        <Field label="Steps (1–12)" hint="More steps = smoother payout as it falls.">
          <input
            style={inputStyle}
            type="number"
            min={1}
            max={12}
            value={rungs}
            onChange={(e) => setRungs(e.target.value)}
          />
        </Field>
      </div>

      <div style={{ marginTop: 8, marginBottom: 16 }}>
        {!canQuote ? (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            Enter coverage amount and trigger price to see a quote.
          </div>
        ) : quote.isLoading || quote.isFetching ? (
          <Spinner label="Pricing…" />
        ) : hasError ? (
          <ErrorBox message={errMsg(quote.error)} />
        ) : q ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
              <Stat label="Premium" value={fmtUsd(usdFromBaseUnits(q.totalPremium))} />
              <Stat label="Max payout" value={fmtUsd(usdFromBaseUnits(q.totalMaxPayout))} />
              <Stat label="Premium %" value={fmtPct(q.premiumPctOfCoverage)} />
            </div>
            <div
              style={{
                background: "rgba(74,222,128,.07)",
                border: "1px solid rgba(74,222,128,.3)",
                borderRadius: 8,
                padding: "12px 14px",
                fontSize: 14,
              }}
            >
              If {oracle.underlying} falls to <strong>{fmtUsd(q.snappedFloorPrice)}</strong>, you receive{" "}
              <strong style={{ color: "var(--accent)" }}>{fmtUsd(usdFromBaseUnits(q.totalMaxPayout))}</strong> —
              with partial payouts along the way down from {fmtUsd(q.snappedTriggerPrice)}.
            </div>

            {(() => {
              const bets = q.perLeg.filter((l) => l.mintable);
              if (bets.length === 0) return null;
              return (
                <div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
                    The actual bets placed ({bets.length}) — each pays out if {oracle.underlying} settles below it:
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {bets.map((l) => (
                      <div
                        key={l.legIndex}
                        style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", borderBottom: "1px solid var(--border)" }}
                      >
                        <span>
                          {oracle.underlying} below <strong>{fmtUsd(l.strike)}</strong>{" "}
                          <span style={{ color: "var(--muted)" }}>({(l.perShareAsk * 100).toFixed(0)}% chance)</span>
                        </span>
                        <span style={{ color: "var(--accent)" }}>pays {fmtUsd(usdFromBaseUnits(l.maxPayout))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              Expires {fmtDate(q.expiryTimestamp)}
            </div>
            {!q.exposureCheck.withinVaultCapacity && (
              <ErrorBox message={`Exposure: ${q.exposureCheck.note}`} />
            )}
            {q.warnings.length > 0 && (
              <div
                style={{
                  background: "rgba(250,204,21,.08)",
                  border: "1px solid rgba(250,204,21,.35)",
                  color: "#facc15",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontSize: 13,
                }}
              >
                {q.warnings.map((w, i) => (
                  <div key={i}>{w}</div>
                ))}
              </div>
            )}
            {!q.perLeg.some((l) => l.mintable) && (
              <ErrorBox message="No mintable legs for these parameters. Adjust trigger/coverage." />
            )}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Button variant="secondary" onClick={onBack}>
          ← Back
        </Button>
        <Button onClick={onContinue} disabled={!canContinue}>
          Continue
        </Button>
      </div>
    </Card>
  );
}

function Review({
  address,
  managerId,
  oracle,
  sumInsured,
  triggerPrice,
  floorPrice,
  rungs,
  onBack,
  onDone,
}: {
  address: string;
  managerId: string | null;
  oracle: Oracle;
  sumInsured: number;
  triggerPrice: number;
  floorPrice: number;
  rungs: number;
  onBack: () => void;
  onDone: (policyId: string) => void;
}) {
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const manager = useManager();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const body = useMemo(
    () => ({
      oracleId: oracle.oracleId,
      sumInsured,
      triggerPrice,
      ...(floorPrice > 0 ? { floorPrice } : {}),
      rungs,
    }),
    [oracle.oracleId, sumInsured, triggerPrice, floorPrice, rungs],
  );

  const quote = useQuery({
    queryKey: ["quote-review", body],
    retry: false,
    queryFn: () => api.post<QuoteResp>("/quote", body),
  });

  async function buy() {
    if (!managerId) {
      setError("Create your Keel account before buying.");
      return;
    }
    const q = quote.data;
    if (!q) return;
    setBusy(true);
    setError(null);
    try {
      setStep("Building transaction…");
      const built = await api.post<BuildMintResp>("/build-mint", {
        userAddress: address,
        managerId,
        oracleId: oracle.oracleId,
        legs: q.legs,
        totalPremium: q.totalPremium,
        sumInsured,
        // use the quote's authoritative snapped values (floor is optional in the form)
        triggerPrice: q.snappedTriggerPrice,
        floorPrice: q.snappedFloorPrice,
      });

      setStep("Awaiting wallet signature…");
      const res = await signAndExecute({ transaction: built.unsignedTxBytes });

      setStep("Confirming policy…");
      const confirmed = await api.post<ConfirmMintResp>("/confirm-mint", {
        userAddress: address,
        managerId,
        mintTxDigest: res.digest,
        oracleId: oracle.oracleId,
        underlyingAsset: oracle.underlying,
        expiryTimestamp: q.expiryTimestamp,
        triggerPrice: q.snappedTriggerPrice,
        legs: q.legs,
        sumInsured,
        premiumPaid: usdFromBaseUnits(q.totalPremium),
      });
      onDone(confirmed.policyId);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
      setStep("");
    }
  }

  if (quote.isLoading) return <Spinner label="Pricing…" />;
  if (quote.isError)
    return (
      <Card title="Review">
        <ErrorBox message={errMsg(quote.error)} />
        <div style={{ marginTop: 16 }}>
          <Button variant="secondary" onClick={onBack}>
            ← Back
          </Button>
        </div>
      </Card>
    );

  const q = quote.data!;

  return (
    <Card title="Review & buy">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20, marginBottom: 16 }}>
        <Stat label="Asset" value={oracle.underlying} />
        <Stat label="Coverage" value={fmtUsd(sumInsured)} />
        <Stat label="Trigger" value={fmtUsd(q.snappedTriggerPrice)} />
        <Stat label="Premium" value={fmtUsd(usdFromBaseUnits(q.totalPremium))} />
        <Stat label="Max payout" value={fmtUsd(usdFromBaseUnits(q.totalMaxPayout))} />
        <Stat label="Expires" value={fmtDate(q.expiryTimestamp)} />
      </div>

      {q.warnings.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {q.warnings.map((w, i) => (
            <div key={i} style={{ color: "#facc15", fontSize: 13 }}>
              {w}
            </div>
          ))}
        </div>
      )}

      {!managerId && manager.data?.needsCreation && manager.data.creationTxBytes && (
        <div style={{ marginBottom: 16 }}>
          <Card title="One-time: create your Keel account">
            <CreateAccount address={address} creationTxBytes={manager.data.creationTxBytes} />
          </Card>
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 16 }}>
          <ErrorBox message={error} />
        </div>
      )}
      {busy && step && (
        <div style={{ marginBottom: 16, color: "var(--muted)", fontSize: 13 }}>{step}</div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Button variant="secondary" onClick={onBack} disabled={busy}>
          ← Back
        </Button>
        <Button onClick={buy} disabled={busy || !managerId}>
          {busy ? "Processing…" : `Buy cover · ${fmtUsd(usdFromBaseUnits(q.totalPremium))}`}
        </Button>
      </div>
    </Card>
  );
}
