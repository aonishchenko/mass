/**
 * Hedera write operations — hedera-spec.md §2.1.
 *
 * These live in the sidecar rather than the Worker because @hashgraph/sdk uses
 * gRPC for consensus and transactions, which Cloudflare Workers cannot open.
 * The READ path (Mirror Node REST) stays in the Worker, which matters: the demo
 * claim is that the ticker renders from what the network returns, and that is
 * literally true.
 *
 * No Solidity anywhere. Native services only, by design.
 */

import {
  AccountCreateTransaction,
  Client,
  CustomFractionalFee,
  Hbar,
  HbarUnit,
  PrivateKey,
  TokenAssociateTransaction,
  TokenCreateTransaction,
  TokenSupplyType,
  TokenType,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  TransferTransaction,
} from "@hashgraph/sdk";

const OPERATOR_ID = process.env.HEDERA_OPERATOR_ID;
const OPERATOR_KEY = process.env.HEDERA_OPERATOR_KEY;

export const hederaConfigured = () => Boolean(OPERATOR_ID && OPERATOR_KEY);

let client = null;
let operatorKey = null;

function getClient() {
  if (!hederaConfigured()) throw new Error("HEDERA_OPERATOR_ID / _KEY not set");
  if (client) return client;

  // The portal shows the same key three ways (DER, hex-ECDSA, and ED25519 for
  // ED25519 accounts) and offers both account types. Guessing wrong produces an
  // opaque INVALID_SIGNATURE at execute time, a long way from the cause — so try
  // each encoding here instead of making setup a coin flip.
  const raw = OPERATOR_KEY.trim();
  operatorKey = (() => {
    const attempts = [
      () => PrivateKey.fromStringDer(raw),
      () => PrivateKey.fromStringECDSA(raw),
      () => PrivateKey.fromStringED25519(raw),
    ];
    for (const attempt of attempts) {
      try {
        return attempt();
      } catch {
        /* try the next encoding */
      }
    }
    throw new Error(
      "HEDERA_OPERATOR_KEY is not a recognised key (tried DER, ECDSA hex, ED25519 hex)"
    );
  })();

  client = Client.forTestnet().setOperator(OPERATOR_ID, operatorKey);
  return client;
}

const txIdString = (response) => response.transactionId.toString();

// ---------------------------------------------------------------------------
// HCS — provenance ledger (§4)
// ---------------------------------------------------------------------------

export async function createTopic(memo = "MASS agent provenance log") {
  const c = getClient();
  const res = await new TopicCreateTransaction()
    .setTopicMemo(memo)
    .setAdminKey(operatorKey.publicKey)
    .setSubmitKey(operatorKey.publicKey)
    .execute(c);
  const receipt = await res.getReceipt(c);
  return { topicId: receipt.topicId.toString(), txId: txIdString(res) };
}

/**
 * Submits the hash-only projection and NOTHING else (§4.1).
 *
 * The projection is built by picking fields, never by deleting them: a new
 * event field cannot leak onto a public ledger by being forgotten in a
 * blocklist.
 */
export async function submitEvent(topicId, event) {
  const c = getClient();
  const projection = {
    id: event.id,
    ts: event.ts,
    type: event.type,
    actorTier: event.actor?.tier ?? (event.actor?.agent ? "agent" : "system"),
    payloadHash: event.payloadHash,
  };

  const res = await new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(JSON.stringify(projection))
    .execute(c);
  const receipt = await res.getReceipt(c);

  return {
    txId: txIdString(res),
    sequenceNumber: receipt.topicSequenceNumber?.toString() ?? null,
  };
}

// ---------------------------------------------------------------------------
// Payments (§5)
// ---------------------------------------------------------------------------

/**
 * Pay-per-canonical-inference. The memo is the inference request hash (x402
 * pattern), which is what lets anyone match an HCS payloadHash to the payment
 * that settled it.
 */
export async function payForInference({ to, amountHbar, requestHash }) {
  const c = getClient();
  const amount = Hbar.from(amountHbar, HbarUnit.Hbar);

  const res = await new TransferTransaction()
    .addHbarTransfer(OPERATOR_ID, amount.negated())
    .addHbarTransfer(to, amount)
    .setTransactionMemo(`x402:${requestHash}`.slice(0, 100))
    .execute(c);
  await res.getReceipt(c);

  return { txId: txIdString(res), amountHbar };
}

/**
 * The payroll split (§5.2) — ONE atomic transaction, many recipients.
 *
 * Atomicity is the whole point: either every contributor is paid or nobody is,
 * and a judge sees a single HashScan entry fanning out to several named humans.
 * N sequential transfers would be weaker evidence and partially failable.
 *
 * `transfers` is [{ accountId, amountTinybar }]. Dust filtering happens in the
 * caller (Worker), which owns the split maths and the pooled remainder.
 */
export async function payoutSplit({ transfers, memo }) {
  if (!transfers.length) throw new Error("no transfers");
  const c = getClient();

  const tx = new TransferTransaction().setTransactionMemo((memo ?? "mass:payout").slice(0, 100));

  let total = 0n;
  for (const t of transfers) {
    const amount = BigInt(t.amountTinybar);
    if (amount <= 0n) continue;
    total += amount;
    tx.addHbarTransfer(t.accountId, Hbar.fromTinybars(amount));
  }
  if (total === 0n) throw new Error("all transfers were dust");

  // Single debit balancing every credit — this is what makes it one transaction.
  tx.addHbarTransfer(OPERATOR_ID, Hbar.fromTinybars(-total));

  const res = await tx.execute(c);
  await res.getReceipt(c);

  return { txId: txIdString(res), totalTinybar: total.toString() };
}

// ---------------------------------------------------------------------------
// Accounts (§8 — measurable account growth, and payouts need real destinations)
// ---------------------------------------------------------------------------

export async function createAccount({ initialHbar = 1 } = {}) {
  const c = getClient();
  const key = PrivateKey.generateED25519();

  const res = await new AccountCreateTransaction()
    .setKeyWithoutAlias(key.publicKey)
    .setInitialBalance(Hbar.from(initialHbar, HbarUnit.Hbar))
    .execute(c);
  const receipt = await res.getReceipt(c);

  return {
    accountId: receipt.accountId.toString(),
    privateKey: key.toStringDer(),
    txId: txIdString(res),
  };
}

// ---------------------------------------------------------------------------
// HTS cap table (§6)
// ---------------------------------------------------------------------------

/**
 * FUNGIBLE_COMMON with a CustomFractionalFee.
 *
 * NOT CustomRoyaltyFee — that is valid only on NON_FUNGIBLE_UNIQUE (§2.2). The
 * fractional fee is the fungible equivalent and achieves the stated intent: a
 * cut of every cap-table transfer routes back to the treasury for holders.
 */
export async function createCapTableToken({
  name = "MASS Crew Contribution Receipt",
  symbol = "MASSCR",
  feeNumerator = 5,
  feeDenominator = 100,
} = {}) {
  const c = getClient();

  const fee = new CustomFractionalFee()
    .setFeeCollectorAccountId(OPERATOR_ID)
    .setNumerator(feeNumerator)
    .setDenominator(feeDenominator)
    .setAllCollectorsAreExempt(true);

  const res = await new TokenCreateTransaction()
    .setTokenName(name)
    .setTokenSymbol(symbol)
    .setTokenType(TokenType.FungibleCommon)
    .setSupplyType(TokenSupplyType.Infinite)
    .setDecimals(0)
    .setInitialSupply(0)
    .setTreasuryAccountId(OPERATOR_ID)
    .setAdminKey(operatorKey.publicKey)
    .setSupplyKey(operatorKey.publicKey)
    .setFeeScheduleKey(operatorKey.publicKey)
    .setCustomFees([fee])
    .execute(c);

  const receipt = await res.getReceipt(c);
  return {
    tokenId: receipt.tokenId.toString(),
    txId: txIdString(res),
    fee: `${feeNumerator}/${feeDenominator}`,
  };
}

/**
 * Mints the derived allocation and distributes it.
 *
 * `allocations` is [{ accountId, units, privateKey? }]. A holder without an
 * account keeps their units in the treasury rather than blocking the mint.
 */
export async function mintCapTable({ tokenId, allocations }) {
  const c = getClient();
  const { TokenMintTransaction } = await import("@hashgraph/sdk");

  const total = allocations.reduce((n, a) => n + a.units, 0);
  if (total <= 0) throw new Error("empty cap table");

  const mintRes = await new TokenMintTransaction()
    .setTokenId(tokenId)
    .setAmount(total)
    .execute(c);
  await mintRes.getReceipt(c);

  const distributed = [];
  for (const a of allocations) {
    if (!a.accountId || !a.privateKey || a.units <= 0) continue;

    // A holder must associate before they can receive units.
    const holderKey = PrivateKey.fromStringDer(a.privateKey);
    try {
      const assoc = await (
        await new TokenAssociateTransaction()
          .setAccountId(a.accountId)
          .setTokenIds([tokenId])
          .freezeWith(c)
          .sign(holderKey)
      ).execute(c);
      await assoc.getReceipt(c);
    } catch (err) {
      // Already associated is fine; anything else leaves units in treasury.
      if (!String(err).includes("TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT")) {
        console.error("[hedera] associate failed", a.accountId, String(err).slice(0, 120));
        continue;
      }
    }

    const xfer = await new TransferTransaction()
      .addTokenTransfer(tokenId, OPERATOR_ID, -a.units)
      .addTokenTransfer(tokenId, a.accountId, a.units)
      .execute(c);
    await xfer.getReceipt(c);
    distributed.push({ accountId: a.accountId, units: a.units });
  }

  return { tokenId, mintTxId: txIdString(mintRes), totalUnits: total, distributed };
}

// ---------------------------------------------------------------------------
// Bonus (§7)
// ---------------------------------------------------------------------------

/** HCS-14 style identity announcement — one message, nearly free. */
export async function announceAgentIdentity(topicId, meta) {
  const c = getClient();
  const res = await new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(JSON.stringify({ std: "hcs-14", op: "register", ...meta }))
    .execute(c);
  await res.getReceipt(c);
  return { txId: txIdString(res) };
}
