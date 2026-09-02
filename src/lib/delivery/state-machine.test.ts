import { describe, expect, it } from "vitest";
import { assertTransition, canTransition } from "./state-machine";

describe("delivery state machine", () => {
  it("permits the seller acceptance and courier path", () => {
    expect(canTransition("awaiting_seller_acceptance", "seller_accepted")).toBe(true);
    expect(canTransition("ready_for_pickup", "courier_requested")).toBe(true);
    expect(canTransition("in_transit", "delivered")).toBe(true);
  });
  it("rejects dispatch before seller readiness", () => {
    expect(() => assertTransition("awaiting_seller_acceptance", "courier_requested")).toThrow(/Invalid delivery transition/);
  });
  it("supports age-restricted return flow", () => {
    expect(canTransition("delivery_failed", "return_requested")).toBe(true);
    expect(canTransition("return_requested", "return_in_transit")).toBe(true);
    expect(canTransition("return_in_transit", "returned_to_seller")).toBe(true);
  });
});
