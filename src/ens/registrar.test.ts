/**
 * The registrar's contract with the rest of the app: it refuses to act when
 * unconfigured, it never reports success it did not get, and the ABI it calls
 * matches the ENS v2 interfaces we read off ensdomains/contracts-v2.
 */

import { describe, it, expect } from "vitest";
import {
  REGISTRY_ABI,
  RESOLVER_ABI,
  STATUS,
  registerSubname,
  registrarConfigured,
  writeTextRecords,
  type RegistrarEnv,
} from "./registrar.js";

const configured: RegistrarEnv = {
  ENS_PARENT_NAME: "mass-lisbon.eth",
  ENS_REGISTRY_ADDRESS: "0x0000000000000000000000000000000000000001",
  ENS_RESOLVER_ADDRESS: "0x0000000000000000000000000000000000000002",
  ENS_REGISTRAR_KEY: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  ENS_REGISTRY_RPC: "https://example.invalid",
};

describe("configuration gate", () => {
  it("is unconfigured until every piece is present", () => {
    expect(registrarConfigured({})).toBe(false);
    expect(registrarConfigured({ ...configured, ENS_REGISTRY_ADDRESS: undefined })).toBe(false);
    expect(registrarConfigured({ ...configured, ENS_REGISTRAR_KEY: undefined })).toBe(false);
    expect(registrarConfigured({ ...configured, ENS_REGISTRY_RPC: undefined })).toBe(false);
    expect(registrarConfigured(configured)).toBe(true);
  });

  it("refuses to register when unconfigured, rather than pretending", async () => {
    const r = await registerSubname({}, "alice");
    expect(r.txHash).toBeUndefined();
    expect(r.error).toMatch(/not configured/);
  });

  it("reports every record as failed when unconfigured", async () => {
    const { written, failed } = await writeTextRecords({}, "doc.mass-lisbon.eth", {
      "agent-endpoint[a2a]": "https://example.com/agent",
    });
    expect(written).toEqual([]);
    expect(failed["agent-endpoint[a2a]"]).toMatch(/not configured/);
  });
});

describe("the ABI matches the ENS v2 interfaces", () => {
  const fn = (name: string) => REGISTRY_ABI.find((f) => f.name === name)!;

  it("calls register with IStandardRegistry's exact parameter order", () => {
    // register(string label, address owner, IRegistry registry, address resolver,
    //          uint256 roleBitmap, uint64 expiry) returns (uint256 tokenId)
    expect(fn("register").inputs.map((i) => i.type)).toEqual([
      "string",
      "address",
      "address",
      "address",
      "uint256",
      "uint64",
    ]);
    expect(fn("register").outputs.map((o) => o.type)).toEqual(["uint256"]);
  });

  it("reads status through the polymorphic anyId, as the interface defines it", () => {
    expect(fn("getStatus").inputs.map((i) => i.type)).toEqual(["uint256"]);
    expect(fn("getStatus").outputs.map((o) => o.type)).toEqual(["uint8"]);
  });

  it("writes records with the ENSIP-5 setText signature", () => {
    const setText = RESOLVER_ABI.find((f) => f.name === "setText")!;
    expect(setText.inputs.map((i) => i.type)).toEqual(["bytes32", "string", "string"]);
  });

  it("mirrors IPermissionedRegistry.Status ordering", () => {
    // AVAILABLE, RESERVED, REGISTERED — order matters, we compare against it.
    expect([STATUS.AVAILABLE, STATUS.RESERVED, STATUS.REGISTERED]).toEqual([0, 1, 2]);
  });
});
