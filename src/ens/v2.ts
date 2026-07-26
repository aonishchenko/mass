/**
 * ENS v2 subname issuance — the contract layer.
 *
 * WHY THIS FILE EXISTS
 *
 * The ENS manager app shows no "add subname" control for mass-lisbon.eth, and
 * that is not a missing UI: on v2 a name has no children until it has its own
 * registry. Ownership of the parent is not enough. The chain state we read is:
 *
 *   mass-lisbon.eth  status=2 (REGISTERED)  owner=0x7B39…1236  subregistry=0x0
 *
 * So issuing `oleksiy.mass-lisbon.eth` takes three transactions, in order:
 *
 *   1. deployProxy   on the VerifiableFactory  — deploy a UserRegistry
 *   2. setSubregistry on the .eth registry     — attach it to mass-lisbon.eth
 *   3. register       on that new UserRegistry — mint each subname
 *
 * Steps 1 and 2 happen once for the whole parent. Step 3 repeats per seat, and
 * is the call the app itself can make later, once the registry exists and has
 * granted the registrar role.
 *
 * Every function here is PURE: it returns {to, data, value} and never signs.
 * The parent is owned by a human's wallet, so the transactions are built here
 * and signed in their browser — see web/src/EnsAdmin.tsx.
 *
 * Addresses are the ENS v2 Sepolia beta deployment, cross-checked against
 * ensdomains/ens-cli src/lib/contracts.ts.
 */

import {
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  stringToBytes,
  type Address,
  type Hex,
} from "viem";
import { labelhash, namehash } from "viem/ens";

export const ENS_V2_SEPOLIA = {
  /** The .eth registry — parent of every 2LD. */
  registry: "0xDEDB92913A25abE1f7BCDD85D8A344a43B398B67",
  /** VerifiableFactory: CREATE2 proxy deployer for registries and resolvers. */
  factory: "0xD2a632D8a8b67c2c4398c255CbD7aF8dd7236198",
  /** Implementation behind a per-name UserRegistry proxy. */
  subregistryImplementation: "0x0F99e7Ea74903AfCB7224d0354fD7428A6f92917",
  /** Minimal-proxy logic used to predict a wallet's OwnedResolver address. */
  resolverProxyLogic: "0x917C561a74Df398646e06f3FFAA51DB8e8330C5A",
} as const satisfies Record<string, Address>;

/**
 * ENS v2 packs roles into the low bit of each 4-bit nybble of a uint256 — it is
 * a grant bitmap, not a v1 fuse mask. These four are what a subname owner needs
 * to be a real owner rather than a tenant.
 */
export const ROLE_SET_SUBREGISTRY = 1n << 20n;
export const ROLE_SET_RESOLVER = 1n << 24n;
export const ROLE_UNREGISTER = 1n << 12n;
export const ROLE_RENEW = 1n << 16n;

/** The admin half of a role lives 128 bits up: holding it lets you re-grant it. */
const ADMIN = 128n;

export const OWNER_ROLES =
  ROLE_UNREGISTER |
  ROLE_RENEW |
  ROLE_SET_SUBREGISTRY |
  ROLE_SET_RESOLVER |
  (ROLE_UNREGISTER << ADMIN) |
  (ROLE_RENEW << ADMIN) |
  (ROLE_SET_SUBREGISTRY << ADMIN) |
  (ROLE_SET_RESOLVER << ADMIN);

/** Every role, for the account that owns the registry itself. */
export const ALL_ROLES = BigInt(
  "0x1111111111111111111111111111111111111111111111111111111111111111"
);

export const registryAbi = [
  {
    type: "function",
    name: "getSubregistry",
    stateMutability: "view",
    inputs: [{ name: "label", type: "string" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "getResolver",
    stateMutability: "view",
    inputs: [{ name: "label", type: "string" }],
    outputs: [{ type: "address" }],
  },
  {
    // NOTE the output order: (status, tokenId, latestOwner). Read back-to-front
    // it decodes cleanly into nonsense — an address that is really the low word
    // of a token id — so it is written out explicitly here rather than guessed.
    type: "function",
    name: "getState",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      { name: "status", type: "uint8" },
      { name: "tokenId", type: "uint256" },
      { name: "latestOwner", type: "address" },
      { name: "expiry", type: "uint64" },
    ],
  },
  {
    type: "function",
    name: "setSubregistry",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "registry", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [
      { name: "label", type: "string" },
      { name: "owner", type: "address" },
      { name: "registry", type: "address" },
      { name: "resolver", type: "address" },
      { name: "roleBitmap", type: "uint256" },
      { name: "expires", type: "uint64" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const factoryAbi = [
  {
    type: "function",
    name: "deployProxy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "implementation", type: "address" },
      { name: "salt", type: "uint256" },
      { name: "data", type: "bytes" },
    ],
    outputs: [{ type: "address" }],
  },
] as const;

export const userRegistryAbi = [
  {
    type: "function",
    name: "initialize",
    stateMutability: "nonpayable",
    inputs: [
      { name: "rootAccount", type: "address" },
      { name: "roleBitmap", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

export const V2_STATUS_REGISTERED = 2;

export interface Call {
  to: Address;
  data: Hex;
  value: "0";
}

const USER_REGISTRY_ID = keccak256(stringToBytes("UserRegistry"));

/**
 * The CREATE2 salt the ENS tooling uses for a name's UserRegistry. Matching it
 * matters: it makes the deployment reproducible, so anyone can recompute the
 * address we claim rather than taking our word for it.
 */
export function userRegistrySalt(name: string): bigint {
  return BigInt(
    keccak256(
      encodeAbiParameters(
        [{ type: "bytes32" }, { type: "bytes32" }, { type: "uint256" }],
        [USER_REGISTRY_ID, namehash(name), 0n]
      )
    )
  );
}

/** Step 1 — deploy the parent's own registry. */
export function deploySubregistryCall(parentName: string, rootAccount: Address): Call {
  const initializeData = encodeFunctionData({
    abi: userRegistryAbi,
    functionName: "initialize",
    args: [rootAccount, ALL_ROLES],
  });
  return {
    to: ENS_V2_SEPOLIA.factory,
    data: encodeFunctionData({
      abi: factoryAbi,
      functionName: "deployProxy",
      args: [
        ENS_V2_SEPOLIA.subregistryImplementation,
        userRegistrySalt(parentName),
        initializeData,
      ],
    }),
    value: "0",
  };
}

/** Step 2 — attach it, so the parent can have children at all. */
export function setSubregistryCall(tokenId: bigint, subregistry: Address): Call {
  return {
    to: ENS_V2_SEPOLIA.registry,
    data: encodeFunctionData({
      abi: registryAbi,
      functionName: "setSubregistry",
      args: [tokenId, subregistry],
    }),
    value: "0",
  };
}

/** Step 3 — mint one subname. Repeat per seat. */
export function registerSubnameCall(args: {
  subregistry: Address;
  label: string;
  owner: Address;
  resolver: Address;
  expires: bigint;
}): Call {
  return {
    to: args.subregistry,
    data: encodeFunctionData({
      abi: registryAbi,
      functionName: "register",
      args: [
        args.label,
        args.owner,
        // Zero: a seat's name needs no children of its own.
        "0x0000000000000000000000000000000000000000",
        args.resolver,
        OWNER_ROLES,
        args.expires,
      ],
    }),
    value: "0",
  };
}

export const labelId = (label: string) => BigInt(labelhash(label));
