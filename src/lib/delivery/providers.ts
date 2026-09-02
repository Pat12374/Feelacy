import type { DeliveryProvider } from "./types";
import { MockDeliveryProvider } from "./mock-provider";

export function getDeliveryProvider(code: string): DeliveryProvider {
  if (code === "mock") return new MockDeliveryProvider();
  throw new Error("Delivery provider is not configured");
}
