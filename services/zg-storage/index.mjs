/**
 * 0G Storage sidecar.
 *
 * WHY THIS EXISTS: 0G storage nodes are served at http://<ip>:5678. Cloudflare
 * Workers only allow outbound fetch to an allowlist of ports which does not
 * include 5678, so `indexer.upload()` fails in production with "failed to get
 * status from the selected node". Miniflare does not enforce the allowlist,
 * which is why local dev passes and deployed does not.
 *
 * Everything else in MASS stays on Workers; this is the one piece that cannot.
 *
 * The Worker sends ALREADY-ENCRYPTED bytes (see src/zg/crypto.ts), so this
 * service never sees plaintext and never holds the session key.
 */

import { createServer } from "node:http";
import { Indexer, MemData } from "@0gfoundation/0g-storage-ts-sdk";
import { ethers } from "ethers";
import * as hedera from "./hedera.mjs";

const PORT = process.env.PORT || 8080;
const RPC = process.env.ZG_STORAGE_RPC || "https://evmrpc-testnet.0g.ai";
const INDEXER = process.env.ZG_STORAGE_INDEXER || "https://indexer-storage-testnet-turbo.0g.ai";
const PRIVATE_KEY = process.env.ZG_PRIVATE_KEY;
const AUTH = process.env.STORAGE_AUTH_TOKEN;

if (!PRIVATE_KEY) throw new Error("ZG_PRIVATE_KEY is required");
if (!AUTH) throw new Error("STORAGE_AUTH_TOKEN is required");

const provider = new ethers.JsonRpcProvider(RPC);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);
const indexer = new Indexer(INDEXER);

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const parts = [];
    req.on("data", (c) => parts.push(c));
    req.on("end", () => resolve(Buffer.concat(parts)));
    req.on("error", reject);
  });

const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      return json(res, 200, {
        ok: true,
        address: await signer.getAddress(),
        hedera: hedera.hederaConfigured(),
      });
    }

    if (req.headers.authorization !== `Bearer ${AUTH}`) {
      return json(res, 401, { error: "unauthorized" });
    }

    // POST /upload — raw encrypted bytes in, { rootHash } out.
    if (req.method === "POST" && req.url === "/upload") {
      const bytes = await readBody(req);
      if (bytes.length === 0) return json(res, 400, { error: "empty body" });

      const [tx, err] = await indexer.upload(new MemData(new Uint8Array(bytes)), RPC, signer);
      if (err) throw err;

      const rootHash = "rootHash" in tx ? tx.rootHash : tx.rootHashes?.[0];
      if (!rootHash) throw new Error("upload returned no rootHash");
      return json(res, 200, { rootHash });
    }

    // GET /download?root=0x... — returns the raw encrypted bytes.
    if (req.method === "GET" && req.url?.startsWith("/download")) {
      const root = new URL(req.url, "http://x").searchParams.get("root");
      if (!root) return json(res, 400, { error: "missing root" });

      const [blob, err] = await indexer.downloadToBlob(root);
      if (err) throw err;

      res.writeHead(200, { "content-type": "application/octet-stream" });
      return res.end(Buffer.from(await blob.arrayBuffer()));
    }

    // ---- Hedera writes (hedera-spec §2.1: gRPC, so it cannot live in a Worker)
    if (req.method === "POST" && req.url?.startsWith("/hedera/")) {
      if (!hedera.hederaConfigured()) {
        return json(res, 503, { error: "hedera not configured on the sidecar" });
      }
      const op = req.url.slice("/hedera/".length);
      const body = (await readBody(req)).toString() || "{}";
      const args = JSON.parse(body);

      const ops = {
        "create-topic": () => hedera.createTopic(args.memo),
        "submit-event": () => hedera.submitEvent(args.topicId, args.event),
        "pay-inference": () => hedera.payForInference(args),
        "payout-split": () => hedera.payoutSplit(args),
        "create-account": () => hedera.createAccount(args),
        "create-captable-token": () => hedera.createCapTableToken(args),
        "mint-captable": () => hedera.mintCapTable(args),
        "announce-identity": () => hedera.announceAgentIdentity(args.topicId, args.meta),
      };

      const handler = ops[op];
      if (!handler) return json(res, 404, { error: `unknown hedera op: ${op}` });
      return json(res, 200, await handler());
    }

    json(res, 404, { error: "not found" });
  } catch (err) {
    console.error("[zg-storage]", err);
    json(res, 500, { error: err?.message ?? String(err) });
  }
});

server.listen(PORT, () => console.log(`[zg-storage] listening on ${PORT}`));
