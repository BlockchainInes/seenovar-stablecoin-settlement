import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canTransition,
} from "../src/settlement-state.js";

describe("settlement state machine", () => {
  it("allows the complete successful settlement lifecycle", () => {
    expect(canTransition("CREATED", "COMPLIANCE_PENDING")).toBe(true);
    expect(canTransition("COMPLIANCE_PENDING", "APPROVED")).toBe(true);
    expect(canTransition("APPROVED", "SUBMITTED")).toBe(true);
    expect(canTransition("SUBMITTED", "CONFIRMED")).toBe(true);
    expect(canTransition("CONFIRMED", "RECONCILED")).toBe(true);
  });

  it("allows failure from operational states", () => {
    expect(canTransition("COMPLIANCE_PENDING", "FAILED")).toBe(true);
    expect(canTransition("APPROVED", "FAILED")).toBe(true);
    expect(canTransition("SUBMITTED", "FAILED")).toBe(true);
    expect(canTransition("CONFIRMED", "FAILED")).toBe(true);
  });

  it("rejects invalid state transitions", () => {
    expect(canTransition("CREATED", "CONFIRMED")).toBe(false);
    expect(canTransition("APPROVED", "RECONCILED")).toBe(false);
    expect(canTransition("RECONCILED", "SUBMITTED")).toBe(false);
  });

  it("throws when an invalid transition is attempted", () => {
    expect(() => {
      assertTransition("CREATED", "CONFIRMED");
    }).toThrow(
      "Invalid settlement transition: CREATED -> CONFIRMED",
    );
  });

  it("makes terminal states immutable", () => {
    expect(canTransition("RECONCILED", "FAILED")).toBe(false);
    expect(canTransition("FAILED", "CREATED")).toBe(false);
  });
});