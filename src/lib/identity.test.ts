import { describe, expect, it } from "vitest";
import { isAtLeastAge } from "@/lib/identity";

describe("isAtLeastAge", () => {
  const today = new Date("2026-09-04T12:00:00Z");

  it("accepts a customer on their eighteenth birthday", () => {
    expect(isAtLeastAge({ year: 2008, month: 9, day: 4 }, 18, today)).toBe(true);
  });

  it("rejects a customer one day before their eighteenth birthday", () => {
    expect(isAtLeastAge({ year: 2008, month: 9, day: 5 }, 18, today)).toBe(false);
  });
});
