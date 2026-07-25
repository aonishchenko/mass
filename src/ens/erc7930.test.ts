/**
 * The one test that matters here: reproduce the worked example published in
 * ENSIP-25. If our encoding differs by a byte, the link we publish is
 * unverifiable and the whole standards claim is hollow.
 */

import { describe, it, expect } from "vitest";
import { agentRegistrationKey, encodeInteroperableAddress } from "./erc7930.js";

/** ENSIP-25's example: agent 42 in the mainnet ERC-8004 IdentityRegistry. */
const MAINNET_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const EXPECTED =
  "agent-registration[0x000100000101148004a169fb4a3325136eb29fa0ceb6d2e539a432][42]";

describe("ERC-7930 interoperable address", () => {
  it("matches the ENSIP-25 worked example exactly", () => {
    expect(agentRegistrationKey(1, MAINNET_REGISTRY, 42)).toBe(EXPECTED);
  });

  it("encodes the parts in the documented order", () => {
    const hex = encodeInteroperableAddress(1, MAINNET_REGISTRY);
    expect(hex.slice(0, 6)).toBe("0x0001"); // version
    expect(hex.slice(6, 10)).toBe("0000"); // chain type: eip155
    expect(hex.slice(10, 12)).toBe("01"); // chain ref length
    expect(hex.slice(12, 14)).toBe("01"); // chain id 1
    expect(hex.slice(14, 16)).toBe("14"); // address length, 20 bytes
    expect(hex.slice(16)).toBe(MAINNET_REGISTRY.slice(2).toLowerCase());
  });

  it("uses multi-byte chain references for Sepolia and Base Sepolia", () => {
    // Sepolia 11155111 = 0xaa36a7, three bytes.
    expect(encodeInteroperableAddress(11155111, MAINNET_REGISTRY)).toContain("03aa36a7");
    // Base Sepolia 84532 = 0x014a34, three bytes.
    expect(encodeInteroperableAddress(84532, MAINNET_REGISTRY)).toContain("03014a34");
  });

  it("is case-insensitive on input and lowercase on output", () => {
    expect(encodeInteroperableAddress(1, MAINNET_REGISTRY)).toBe(
      encodeInteroperableAddress(1, MAINNET_REGISTRY.toLowerCase())
    );
  });

  it("refuses anything that is not a 20-byte address", () => {
    expect(() => encodeInteroperableAddress(1, "0x1234")).toThrow();
    expect(() => encodeInteroperableAddress(1, "not-an-address")).toThrow();
  });
});
