/**
 * Issue a subname of the crew's parent name on ENS v2 (Sepolia).
 *
 * On ENS v2 a name has no children until it owns a registry — which is why the
 * ENS manager app shows no "add subname" control for a fresh 2LD. This does the
 * three steps that fixes, each skipped if already done:
 *
 *   1. deployProxy    — give the parent its own UserRegistry (once per parent)
 *   2. setSubregistry — attach it, so the parent can have children at all
 *   3. register       — mint the subname
 *
 * Run:
 *   KEY=<parent owner private key> LABEL=doc OWNER=0x… \
 *     node scripts/issue-subname.mjs
 *
 * KEY never appears in this repo. It must own the parent, and the script stops
 * if it does not rather than sending a transaction that can only revert.
 * Records are written separately — a registered name with no addr record still
 * resolves to nothing.
 */
import { createPublicClient, createWalletClient, http, parseAbi, zeroAddress, decodeEventLog, encodeFunctionData, encodeAbiParameters, keccak256, stringToBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { labelhash, namehash } from "viem/ens";

const RPC = process.env.SEPOLIA_RPC ?? "https://ethereum-sepolia-rpc.publicnode.com";
const KEY = process.env.KEY;
const PARENT = "mass-lisbon.eth";
const PARENT_LABEL = "mass-lisbon";
const LABEL = process.env.LABEL ?? "oleksiy";
const OWNER = process.env.OWNER;  // defaults to the signer
const DRY = process.env.DRY === "1";

const V2 = {
  registry: "0xDEDB92913A25abE1f7BCDD85D8A344a43B398B67",
  factory: "0xD2a632D8a8b67c2c4398c255CbD7aF8dd7236198",
  userRegistryImpl: "0x0F99e7Ea74903AfCB7224d0354fD7428A6f92917",
};

const registryAbi = parseAbi([
  "function getState(uint256 anyId) external view returns ((uint8 status, uint64 expiry, address latestOwner, uint256 tokenId, uint256 resource))",
  "function getSubregistry(string label) external view returns (address)",
  "function getResolver(string label) external view returns (address)",
  "function register(string label, address owner, address registry, address resolver, uint256 roleBitmap, uint64 expires) external returns (uint256 tokenId)",
  "function setSubregistry(uint256 tokenId, address registry) external",
]);
const factoryAbi = parseAbi(["function deployProxy(address implementation, uint256 salt, bytes data) external returns (address)"]);
const userRegistryAbi = parseAbi(["function initialize(address rootAccount, uint256 roleBitmap) external"]);

const ALL_ROLES = BigInt("0x1111111111111111111111111111111111111111111111111111111111111111");
const ROLE_UNREGISTER = 1n << 12n;
const ROLE_RENEW = 1n << 16n;
const ROLE_SET_SUBREGISTRY = 1n << 20n;
const ROLE_SET_RESOLVER = 1n << 24n;
const ADMIN = 128n;
const OWNER_ROLES =
  ROLE_UNREGISTER | ROLE_RENEW | ROLE_SET_SUBREGISTRY | ROLE_SET_RESOLVER |
  (ROLE_UNREGISTER << ADMIN) | (ROLE_RENEW << ADMIN) |
  (ROLE_SET_SUBREGISTRY << ADMIN) | (ROLE_SET_RESOLVER << ADMIN);

const account = privateKeyToAccount(KEY.startsWith("0x") ? KEY : `0x${KEY}`);
const pub = createPublicClient({ chain: sepolia, transport: http(RPC) });
const wallet = createWalletClient({ account, chain: sepolia, transport: http(RPC) });

const salt = BigInt(
  keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "bytes32" }, { type: "uint256" }],
      [keccak256(stringToBytes("UserRegistry")), namehash(PARENT), 0n]
    )
  )
);

const send = async (label, req) => {
  if (DRY) { console.log(`   [dry run] would send ${label}`); return null; }
  const hash = await wallet.writeContract(req);
  console.log(`   tx ${hash}`);
  const r = await pub.waitForTransactionReceipt({ hash });
  console.log(`   mined in block ${r.blockNumber} — status ${r.status}`);
  if (r.status !== "success") throw new Error(`${label} reverted`);
  return r;
};

console.log(`signer  : ${account.address}`);
console.log(`balance : ${Number(await pub.getBalance({ address: account.address })) / 1e18} SepoliaETH\n`);

const state = await pub.readContract({
  address: V2.registry, abi: registryAbi, functionName: "getState", args: [BigInt(labelhash(PARENT_LABEL))],
});
console.log(`${PARENT}`);
console.log(`  status      : ${state.status} (2 = REGISTERED)`);
console.log(`  owner       : ${state.latestOwner}`);
console.log(`  tokenId     : ${state.tokenId}`);
console.log(`  expiry      : ${state.expiry} (${new Date(Number(state.expiry) * 1000).toISOString()})`);
if (state.latestOwner.toLowerCase() !== account.address.toLowerCase()) {
  throw new Error("signer does not own the parent");
}

const resolver = await pub.readContract({ address: V2.registry, abi: registryAbi, functionName: "getResolver", args: [PARENT_LABEL] });
console.log(`  resolver    : ${resolver}`);

let sub = await pub.readContract({ address: V2.registry, abi: registryAbi, functionName: "getSubregistry", args: [PARENT_LABEL] });
console.log(`  subregistry : ${sub}\n`);

// ---- 1. deploy the parent's UserRegistry -----------------------------------
if (sub === zeroAddress) {
  console.log("1. deploying UserRegistry via VerifiableFactory…");
  const initData = encodeFunctionData({ abi: userRegistryAbi, functionName: "initialize", args: [account.address, ALL_ROLES] });
  const receipt = await send("deployProxy", {
    address: V2.factory, abi: factoryAbi, functionName: "deployProxy",
    args: [V2.userRegistryImpl, salt, initData],
  });
  if (receipt) {
    for (const log of receipt.logs) {
      try {
        const ev = decodeEventLog({
          abi: parseAbi(["event ProxyDeployed(address indexed sender, address indexed proxyAddress, uint256 salt, address implementation)"]),
          data: log.data, topics: log.topics,
        });
        sub = ev.args.proxyAddress;
      } catch { /* not our event */ }
    }
    console.log(`   UserRegistry: ${sub}`);
  }

  console.log("2. setSubregistry…");
  await send("setSubregistry", {
    address: V2.registry, abi: registryAbi, functionName: "setSubregistry",
    args: [state.tokenId, sub],
  });
} else {
  console.log(`1-2. subregistry already attached at ${sub} — skipping\n`);
}

// ---- 3. register the subname ------------------------------------------------
const existing = await pub.readContract({ address: sub, abi: registryAbi, functionName: "getState", args: [BigInt(labelhash(LABEL))] }).catch(() => null);
if (existing && Number(existing.status) === 2) {
  console.log(`3. ${LABEL}.${PARENT} already registered to ${existing.latestOwner} — skipping`);
} else {
  console.log(`3. register ${LABEL}.${PARENT} -> ${OWNER ?? account.address}`);
  // Never outlive the parent: a child that expires later than its parent is a
  // promise the registry cannot keep.
  await send("register", {
    address: sub, abi: registryAbi, functionName: "register",
    args: [LABEL, OWNER ?? account.address, zeroAddress, resolver, OWNER_ROLES, state.expiry],
  });
}

const after = await pub.readContract({ address: sub, abi: registryAbi, functionName: "getState", args: [BigInt(labelhash(LABEL))] });
console.log(`\nfinal: ${LABEL}.${PARENT} status=${after.status} owner=${after.latestOwner}`);
console.log(`subregistry: ${sub}`);
