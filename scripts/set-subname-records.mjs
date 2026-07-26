/**
 * Write the records that make a subname mean something.
 *
 * Registering a name only creates the node. Until the resolver holds an addr
 * record it resolves to nothing, and until it holds the provenance text records
 * a citation pointing at it proves nothing.
 */
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { namehash } from "viem/ens";

const RPC = process.env.SEPOLIA_RPC ?? "https://ethereum-sepolia-rpc.publicnode.com";
const NAME = process.env.NAME ?? "oleksiy.mass-lisbon.eth";
// Read from chain rather than pinned: on ENS v2 each name has its own
// resolver proxy, and a hardcoded one goes stale the moment it changes.
const REGISTRY = "0xDEDB92913A25abE1f7BCDD85D8A344a43B398B67";

const abi = parseAbi([
  "function setAddr(bytes32 node, address addr) external",
  "function setText(bytes32 node, string key, string value) external",
  "function addr(bytes32 node) external view returns (address)",
  "function text(bytes32 node, string key) external view returns (string)",
]);

const account = privateKeyToAccount(
  process.env.KEY.startsWith("0x") ? process.env.KEY : `0x${process.env.KEY}`
);
const pub = createPublicClient({ chain: sepolia, transport: http(RPC) });
const wallet = createWalletClient({ account, chain: sepolia, transport: http(RPC) });

const registryAbi = parseAbi(["function getResolver(string label) external view returns (address)"]);
const RESOLVER = await pub.readContract({
  address: REGISTRY, abi: registryAbi, functionName: "getResolver",
  args: [NAME.split(".").slice(-3, -2)[0] ?? NAME.split(".")[0]],
});

const node = namehash(NAME);
console.log(`${NAME}\n  node     : ${node}\n  resolver : ${RESOLVER}\n`);

const send = async (label, req) => {
  const { request } = await pub.simulateContract({ ...req, account });
  const hash = await wallet.writeContract(request);
  const r = await pub.waitForTransactionReceipt({ hash });
  console.log(`  ${label.padEnd(28)} ${r.status}  ${hash}`);
};

await send("addr", { address: RESOLVER, abi, functionName: "setAddr", args: [node, account.address] });

const records = {
  "com.mass.tier": "T3",
  "com.mass.sybilBand": "high",
  "com.mass.contribCount": "0",
  description: "MASS crew seat — ETHGlobal Lisbon 2026",
};
for (const [k, v] of Object.entries(records)) {
  await send(`text ${k}`, { address: RESOLVER, abi, functionName: "setText", args: [node, k, v] });
}

console.log("\nread back:");
console.log("  addr :", await pub.readContract({ address: RESOLVER, abi, functionName: "addr", args: [node] }));
for (const k of Object.keys(records)) {
  console.log(`  ${k.padEnd(22)}:`, await pub.readContract({ address: RESOLVER, abi, functionName: "text", args: [node, k] }));
}
