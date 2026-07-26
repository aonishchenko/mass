/**
 * Subname issuance console for the parent name.
 *
 * The ENS manager app offers no way to add a subname to mass-lisbon.eth,
 * because on v2 a name cannot have children until it owns a registry. This page
 * does the three steps that fixes:
 *
 *   1. deploy a UserRegistry for the parent
 *   2. attach it (setSubregistry)
 *   3. register each seat's subname into it
 *
 * The parent is owned by a wallet, not by the server, so every transaction is
 * built here and signed in the browser. The page reads live chain state first
 * and disables any step that is already done, so it is safe to reopen and
 * re-run: it will simply show green.
 */

import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  encodeFunctionData,
  decodeEventLog,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import { sepolia } from "viem/chains";
import { namehash } from "viem/ens";
import {
  ENS_V2_SEPOLIA,
  deploySubregistryCall,
  labelId,
  registerSubnameCall,
  registryAbi,
  setSubregistryCall,
  userRegistrySalt,
  V2_STATUS_REGISTERED,
} from "../../src/ens/v2.js";
import "./index.css";

const PARENT = "mass-lisbon.eth";
const PARENT_LABEL = "mass-lisbon";
const RPC = "https://ethereum-sepolia-rpc.publicnode.com";

/** One year. Long enough to outlive a hackathon by a wide margin. */
const DURATION = 365n * 24n * 60n * 60n;

const pub = createPublicClient({ chain: sepolia, transport: http(RPC) });

interface SeatPlan {
  label: string;
  owner: string;
  records: Record<string, string>;
}

/**
 * The seats to issue. `oleksiy` is the only one with a confirmed address; the
 * rest are left blank on purpose rather than pointed at a placeholder, because
 * a subname resolving to the wrong wallet is worse than one that does not exist
 * — the whole point of the citation check is that resolution means something.
 */
const SEATS: SeatPlan[] = [
  {
    label: "oleksiy",
    owner: "0x7B397A473162f6D23c03E436c500C3C050911236",
    records: { "com.mass.tier": "T2", "com.mass.sybilBand": "high" },
  },
  { label: "doc", owner: "", records: { "com.mass.tier": "T2" } },
  { label: "niek", owner: "", records: { "com.mass.tier": "T2" } },
];

type Status = "idle" | "pending" | "done" | "error";

const Row: React.FC<{
  n: number;
  title: string;
  detail: React.ReactNode;
  status: Status;
  disabled?: boolean;
  action?: string;
  onClick?: () => void;
}> = ({ n, title, detail, status, disabled, action, onClick }) => (
  <div className="flex items-start gap-3 border-b border-black/8 py-3">
    <span
      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] ${
        status === "done"
          ? "bg-emerald-600 text-white"
          : status === "error"
            ? "bg-red-600 text-white"
            : "bg-black/8"
      }`}
    >
      {status === "done" ? "✓" : n}
    </span>
    <div className="min-w-0 flex-1">
      <div className="text-[13px] font-medium">{title}</div>
      <div className="mt-0.5 text-[11.5px] break-all text-black/55">{detail}</div>
    </div>
    {action && (
      <button
        onClick={onClick}
        disabled={disabled || status === "pending" || status === "done"}
        className="shrink-0 rounded-md border border-black/25 px-2.5 py-1 text-[12px] hover:bg-black/5 disabled:opacity-35"
      >
        {status === "pending" ? "confirm in wallet…" : status === "done" ? "done" : action}
      </button>
    )}
  </div>
);

const App: React.FC = () => {
  const [account, setAccount] = useState<Address | null>(null);
  const [chainOk, setChainOk] = useState(true);
  const [tokenId, setTokenId] = useState<bigint | null>(null);
  const [owner, setOwner] = useState<Address | null>(null);
  const [subregistry, setSubregistry] = useState<Address>(zeroAddress);
  const [resolver, setResolver] = useState<Address>(zeroAddress);
  const [predicted, setPredicted] = useState<Address | null>(null);
  const [existing, setExisting] = useState<Record<string, Address>>({});
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [log, setLog] = useState<string[]>([]);
  const [seats, setSeats] = useState(SEATS);

  const say = (m: string) => setLog((l) => [...l.slice(-40), m]);

  const refresh = useCallback(async () => {
    const st = await pub.readContract({
      address: ENS_V2_SEPOLIA.registry,
      abi: registryAbi,
      functionName: "getState",
      args: [labelId(PARENT_LABEL)],
    });
    if (Number(st[0]) !== V2_STATUS_REGISTERED) {
      say(`${PARENT} is not registered (status ${st[0]})`);
      return;
    }
    setTokenId(st[1]);
    setOwner(st[2]);

    const [sub, res] = await Promise.all([
      pub.readContract({
        address: ENS_V2_SEPOLIA.registry,
        abi: registryAbi,
        functionName: "getSubregistry",
        args: [PARENT_LABEL],
      }),
      pub.readContract({
        address: ENS_V2_SEPOLIA.registry,
        abi: registryAbi,
        functionName: "getResolver",
        args: [PARENT_LABEL],
      }),
    ]);
    setSubregistry(sub);
    setResolver(res);

    if (sub !== zeroAddress) {
      // Which seats already exist? Re-registering a live subname reverts, and
      // a page that offers a button which cannot succeed is a page that lies.
      const found: Record<string, Address> = {};
      for (const s of SEATS) {
        try {
          const state = await pub.readContract({
            address: sub,
            abi: registryAbi,
            functionName: "getState",
            args: [labelId(s.label)],
          });
          if (Number(state[0]) === V2_STATUS_REGISTERED) found[s.label] = state[2];
        } catch {
          /* not registered */
        }
      }
      setExisting(found);
    }
  }, []);

  useEffect(() => {
    refresh().catch((e) => say(String(e).slice(0, 200)));
  }, [refresh]);

  const connect = async () => {
    const eth = (window as unknown as { ethereum?: { request(a: unknown): Promise<unknown> } })
      .ethereum;
    if (!eth) return say("No wallet found.");
    const accs = (await eth.request({ method: "eth_requestAccounts" })) as Address[];
    setAccount(accs[0]);
    const cid = (await eth.request({ method: "eth_chainId" })) as string;
    if (parseInt(cid, 16) !== sepolia.id) {
      setChainOk(false);
      try {
        await eth.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0xaa36a7" }],
        });
        setChainOk(true);
      } catch {
        say("Switch MetaMask to Sepolia.");
      }
    } else setChainOk(true);
  };

  const wallet = () =>
    createWalletClient({
      chain: sepolia,
      transport: custom(
        (window as unknown as { ethereum: NonNullable<unknown> }).ethereum as never
      ),
    });

  const send = async (key: string, call: { to: Address; data: Hex }) => {
    if (!account) return say("Connect a wallet first.");
    setStatus((s) => ({ ...s, [key]: "pending" }));
    try {
      const hash = await wallet().sendTransaction({ account, to: call.to, data: call.data });
      say(`sent ${key}: ${hash}`);
      const receipt = await pub.waitForTransactionReceipt({ hash });
      say(`mined ${key} in block ${receipt.blockNumber}`);
      setStatus((s) => ({ ...s, [key]: "done" }));
      await refresh();
      return receipt;
    } catch (e) {
      setStatus((s) => ({ ...s, [key]: "error" }));
      say(`${key} failed: ${String((e as Error).message ?? e).slice(0, 240)}`);
      return undefined;
    }
  };

  /** Step 1. The factory returns the proxy address; read it back from the logs. */
  const deploy = async () => {
    if (!account) return say("Connect a wallet first.");
    const call = deploySubregistryCall(PARENT, account);
    const receipt = await send("deploy", call);
    if (!receipt) return;
    for (const l of receipt.logs) {
      try {
        const ev = decodeEventLog({
          abi: [
            {
              type: "event",
              name: "ProxyDeployed",
              inputs: [
                { name: "sender", type: "address", indexed: true },
                { name: "proxyAddress", type: "address", indexed: true },
                { name: "salt", type: "uint256", indexed: false },
                { name: "implementation", type: "address", indexed: false },
              ],
            },
          ],
          data: l.data,
          topics: l.topics,
        });
        setPredicted((ev.args as { proxyAddress: Address }).proxyAddress);
        say(`registry deployed at ${(ev.args as { proxyAddress: Address }).proxyAddress}`);
      } catch {
        /* not our event */
      }
    }
  };

  const attach = async () => {
    const addr = predicted ?? (prompt("UserRegistry address:") as Address | null);
    if (!addr || tokenId == null) return;
    await send("attach", setSubregistryCall(tokenId, addr));
  };

  const issue = async (s: SeatPlan) => {
    if (subregistry === zeroAddress) return say("Attach a subregistry first.");
    if (!s.owner) return say(`${s.label}: needs an owner address.`);
    const block = await pub.getBlock();
    await send(
      `seat:${s.label}`,
      registerSubnameCall({
        subregistry,
        label: s.label,
        owner: s.owner as Address,
        // The parent's own resolver, reused: it is already owned by this wallet,
        // so the same account can write the subname's records afterwards.
        resolver,
        expires: block.timestamp + DURATION,
      })
    );
  };

  /** Records are what make a citation checkable — a bare name proves nothing. */
  const writeRecords = async (s: SeatPlan) => {
    if (resolver === zeroAddress) return say("Parent has no resolver.");
    const node = namehash(`${s.label}.${PARENT}`);
    const entries = Object.entries(s.records);
    for (const [k, v] of entries) {
      await send(`rec:${s.label}:${k}`, {
        to: resolver,
        data: encodeFunctionData({
          abi: [
            {
              type: "function",
              name: "setText",
              stateMutability: "nonpayable",
              inputs: [
                { name: "node", type: "bytes32" },
                { name: "key", type: "string" },
                { name: "value", type: "string" },
              ],
              outputs: [],
            },
          ],
          functionName: "setText",
          args: [node, k, v],
        }),
      });
    }
    if (s.owner) {
      await send(`rec:${s.label}:addr`, {
        to: resolver,
        data: encodeFunctionData({
          abi: [
            {
              type: "function",
              name: "setAddr",
              stateMutability: "nonpayable",
              inputs: [
                { name: "node", type: "bytes32" },
                { name: "coinType", type: "uint256" },
                { name: "a", type: "bytes" },
              ],
              outputs: [],
            },
          ],
          functionName: "setAddr",
          args: [node, 60n, s.owner as Hex],
        }),
      });
    }
  };

  const isOwner = account && owner && account.toLowerCase() === owner.toLowerCase();

  return (
    <div className="mx-auto max-w-3xl p-6 font-sans text-[13px] text-[#1a1a18]">
      <h1 className="text-[18px] font-semibold">Subnames for {PARENT}</h1>
      <p className="mt-1 text-[12px] text-black/55">
        ENS v2 · Sepolia. A v2 name has no children until it owns a registry — which is why the
        manager app shows no “add subname” button. These three steps create one.
      </p>

      <div className="mt-4 rounded-lg border border-black/12 bg-black/[0.02] p-3 text-[11.5px]">
        <div>
          parent owner · <span className="font-mono">{owner ?? "…"}</span>
        </div>
        <div>
          token id · <span className="font-mono">{tokenId?.toString() ?? "…"}</span>
        </div>
        <div>
          subregistry ·{" "}
          <span className="font-mono">
            {subregistry === zeroAddress ? "none" : subregistry}
          </span>
        </div>
        <div>
          resolver · <span className="font-mono">{resolver}</span>
        </div>
        <div className="mt-1">
          salt · <span className="font-mono">{userRegistrySalt(PARENT).toString()}</span>
        </div>
      </div>

      {!account ? (
        <button
          onClick={connect}
          className="mt-4 rounded-md bg-[#1a1a18] px-3 py-1.5 text-[12.5px] text-white"
        >
          Connect wallet
        </button>
      ) : (
        <div className="mt-4 text-[12px]">
          connected <span className="font-mono">{account}</span>
          {!isOwner && (
            <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-900">
              not the parent owner — these transactions will revert
            </span>
          )}
          {!chainOk && (
            <span className="ml-2 rounded bg-red-500/20 px-1.5 py-0.5 text-red-900">
              wrong network
            </span>
          )}
        </div>
      )}

      <div className="mt-5">
        <Row
          n={1}
          title="Deploy a UserRegistry for the parent"
          detail={
            <>
              VerifiableFactory <span className="font-mono">{ENS_V2_SEPOLIA.factory}</span> ·
              deterministic address from the salt above
            </>
          }
          status={subregistry !== zeroAddress ? "done" : (status.deploy ?? "idle")}
          disabled={!account}
          action="Deploy"
          onClick={deploy}
        />
        <Row
          n={2}
          title="Attach it to the name"
          detail={
            predicted
              ? `setSubregistry(tokenId, ${predicted})`
              : "setSubregistry — run step 1 first, or paste an address"
          }
          status={subregistry !== zeroAddress ? "done" : (status.attach ?? "idle")}
          disabled={!account || tokenId == null}
          action="Attach"
          onClick={attach}
        />
      </div>

      <h2 className="mt-6 text-[14px] font-semibold">Seats</h2>
      <p className="mt-0.5 text-[11.5px] text-black/55">
        Each row mints <span className="font-mono">label.{PARENT}</span> to an address, then writes
        the text records the citation tooltip reads.
      </p>

      {seats.map((s, i) => (
        <div key={s.label} className="mt-3 rounded-lg border border-black/12 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[13px]">
              {s.label}.{PARENT}
            </span>
            {existing[s.label] && (
              <span className="rounded bg-emerald-600/12 px-1.5 py-0.5 text-[11px] text-emerald-800">
                exists
              </span>
            )}
          </div>
          <input
            value={s.owner}
            onChange={(e) =>
              setSeats((prev) =>
                prev.map((p, j) => (j === i ? { ...p, owner: e.target.value.trim() } : p))
              )
            }
            placeholder="0x… owner address"
            className="mt-2 w-full rounded border border-black/15 px-2 py-1 font-mono text-[11.5px]"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => issue(s)}
              disabled={!account || subregistry === zeroAddress || !!existing[s.label]}
              className="rounded-md border border-black/25 px-2.5 py-1 text-[12px] hover:bg-black/5 disabled:opacity-35"
            >
              {status[`seat:${s.label}`] === "pending" ? "confirm…" : "Register subname"}
            </button>
            <button
              onClick={() => writeRecords(s)}
              disabled={!account || !existing[s.label]}
              className="rounded-md border border-black/25 px-2.5 py-1 text-[12px] hover:bg-black/5 disabled:opacity-35"
            >
              Write records
            </button>
          </div>
        </div>
      ))}

      <h2 className="mt-6 text-[14px] font-semibold">Log</h2>
      <pre className="mt-1 max-h-64 overflow-auto rounded-lg bg-black/[0.03] p-2 text-[11px] whitespace-pre-wrap">
        {log.join("\n") || "—"}
      </pre>
    </div>
  );
};

createRoot(document.getElementById("root")!).render(<App />);
