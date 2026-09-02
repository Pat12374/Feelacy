import { describe, expect, it } from "vitest";
import { distanceMiles } from "./search";
describe("pickup perimeter search", () => {
  it("calculates nearby distance in miles", () => { expect(distanceMiles(52.52, 13.405, 52.53, 13.405)).toBeGreaterThan(.6); expect(distanceMiles(52.52, 13.405, 52.53, 13.405)).toBeLessThan(.8); });
  it("returns zero for the same location", () => expect(distanceMiles(52.52, 13.405, 52.52, 13.405)).toBe(0));
});
