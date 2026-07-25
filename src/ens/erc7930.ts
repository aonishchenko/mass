/**
 * ERC-7930 interoperable addresses — the encoding ENSIP-25 uses inside its
 * text-record key.
 *
 * ENSIP-25 links an ENS name to an agent in an ERC-8004 registry with a record
 * keyed `agent-registration[<registry>][<agentId>]`, where `<registry>` is the
 * registry's address in this binary form. Getting it wrong means the link is
 * unverifiable, so this is implemented against the specification's own worked
 * example and tested against it (see erc7930.test.ts).
 *
 * Layout:
 *   version              2 bytes   0x0001
 *   chain type           2 bytes   0x0000 for eip155 (EVM)
 *   chain ref length     1 byte    length of the chain id below
 *   chain reference      N bytes   chain id, big-endian, minimal length
 *   address length       1 byte    20 for an EVM address
 *   address              M bytes
 */

/** Minimal big-endian bytes for a non-negative integer (0 -> one 0x00 byte). */
function minimalBytes(n: number): string {
  if (!Number.isInteger(n) || n < 0) throw new Error(`chain id must be a non-negative integer: ${n}`);
  let hex = n.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  return hex;
}

const strip0x = (s: string) => (s.startsWith("0x") || s.startsWith("0X") ? s.slice(2) : s);

/**
 * Encode an EVM chain id + contract address as an ERC-7930 interoperable
 * address (lowercase hex, `0x`-prefixed).
 */
export function encodeInteroperableAddress(chainId: number, address: string): string {
  const addr = strip0x(address).toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(addr)) {
    throw new Error(`not a 20-byte EVM address: ${address}`);
  }

  const chainRef = minimalBytes(chainId);
  const chainRefLen = (chainRef.length / 2).toString(16).padStart(2, "0");
  const addrLen = (20).toString(16).padStart(2, "0"); // 0x14

  return `0x0001${"0000"}${chainRefLen}${chainRef}${addrLen}${addr}`;
}

/**
 * The ENSIP-25 text-record key that links an ENS name to one agent in one
 * ERC-8004 registry. Its value is `"1"` (any non-empty value confirms).
 */
export function agentRegistrationKey(
  chainId: number,
  registryAddress: string,
  agentId: string | number
): string {
  return `agent-registration[${encodeInteroperableAddress(chainId, registryAddress)}][${agentId}]`;
}
