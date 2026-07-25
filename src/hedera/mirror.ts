/**
 * Mirror Node REST reads — hedera-spec.md §4.3.
 *
 * This is the ONE Hedera path that genuinely runs in the Worker (plain HTTPS,
 * no gRPC), and it is deliberately the path the demo claims: the ticker renders
 * what the network returns, not what we believe we sent. A number we computed
 * ourselves is a claim; a number the network returns is evidence.
 */

const MIRROR = "https://testnet.mirrornode.hedera.com/api/v1";

/**
 * Transaction ids arrive as `0.0.1234@1699999999.123456789` from the SDK and as
 * `0.0.1234-1699999999-123456789` from Mirror Node. HashScan accepts the dashed
 * form, so normalise to it.
 */
export const toHashscanTxId = (id: string) =>
  id.replace("@", "-").replace(/\.(\d+)$/, "-$1");

export const hashscan = {
  tx: (id: string) => `https://hashscan.io/testnet/transaction/${toHashscanTxId(id)}`,
  topic: (id: string) => `https://hashscan.io/testnet/topic/${id}`,
  token: (id: string) => `https://hashscan.io/testnet/token/${id}`,
  account: (id: string) => `https://hashscan.io/testnet/account/${id}`,
};

export interface AnchoredMessage {
  sequenceNumber: number;
  consensusTimestamp: string;
  /** The hash-only projection we submitted (§4.1). */
  payload: {
    id?: string;
    ts?: number;
    type?: string;
    actorTier?: string;
    payloadHash?: string;
  };
  raw: string;
}

async function mirror<T>(path: string): Promise<T> {
  const res = await fetch(`${MIRROR}${path}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`mirror node ${res.status}: ${(await res.text()).slice(0, 160)}`);
  }
  return res.json<T>();
}

/** Newest-first topic messages, decoded. */
export async function readTopicMessages(
  topicId: string,
  limit = 50
): Promise<AnchoredMessage[]> {
  const data = await mirror<{
    messages: {
      sequence_number: number;
      consensus_timestamp: string;
      message: string;
    }[];
  }>(`/topics/${topicId}/messages?limit=${limit}&order=desc`);

  return (data.messages ?? []).map((m) => {
    const raw = atob(m.message);
    let payload: AnchoredMessage["payload"] = {};
    try {
      payload = JSON.parse(raw);
    } catch {
      // A non-JSON message is still evidence something was anchored.
    }
    return {
      sequenceNumber: m.sequence_number,
      consensusTimestamp: m.consensus_timestamp,
      payload,
      raw,
    };
  });
}

export async function topicMessageCount(topicId: string): Promise<number> {
  const data = await mirror<{ messages: { sequence_number: number }[] }>(
    `/topics/${topicId}/messages?limit=1&order=desc`
  );
  // Sequence numbers start at 1, so the newest one IS the count.
  return data.messages?.[0]?.sequence_number ?? 0;
}

export async function accountBalance(accountId: string): Promise<number> {
  const data = await mirror<{ balance?: { balance: number } }>(`/accounts/${accountId}`);
  return (data.balance?.balance ?? 0) / 100_000_000;
}

/** Transactions involving an account, newest first. */
export async function accountTransactions(accountId: string, limit = 25) {
  const data = await mirror<{
    transactions: {
      transaction_id: string;
      name: string;
      result: string;
      consensus_timestamp: string;
      charged_tx_fee: number;
      transfers?: { account: string; amount: number }[];
    }[];
  }>(`/transactions?account.id=${accountId}&limit=${limit}&order=desc`);
  return data.transactions ?? [];
}
