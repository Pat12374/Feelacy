import type { DeliveryStatus } from "./types";

const transitions: Record<DeliveryStatus, readonly DeliveryStatus[]> = {
  quote_requested: ["quoted", "cancelled"], quoted: ["quote_expired", "awaiting_payment", "cancelled"],
  quote_expired: ["quote_requested", "cancelled"], awaiting_payment: ["awaiting_seller_acceptance", "cancelled"],
  awaiting_seller_acceptance: ["seller_accepted", "seller_rejected", "cancelled"],
  seller_accepted: ["preparing", "ready_for_pickup", "cancelled"], seller_rejected: ["cancelled"],
  preparing: ["ready_for_pickup", "cancelled"], ready_for_pickup: ["courier_requested", "cancelled"],
  courier_requested: ["courier_assigned", "delivery_failed", "cancelled"],
  courier_assigned: ["courier_arriving", "picked_up", "delivery_failed", "cancelled"],
  courier_arriving: ["picked_up", "delivery_failed", "cancelled"],
  picked_up: ["in_transit", "delivered", "delivery_failed"],
  in_transit: ["delivered", "delivery_failed"], delivered: [],
  delivery_failed: ["return_requested", "cancelled"], return_requested: ["return_in_transit", "cancelled"],
  return_in_transit: ["returned_to_seller"], returned_to_seller: [], cancelled: [],
};

export function canTransition(from: DeliveryStatus, to: DeliveryStatus) {
  return from === to || transitions[from].includes(to);
}

export function assertTransition(from: DeliveryStatus, to: DeliveryStatus) {
  if (!canTransition(from, to)) throw new Error(`Invalid delivery transition: ${from} → ${to}`);
}

export function statusRank(status: DeliveryStatus) {
  return ["quote_requested", "quoted", "awaiting_payment", "awaiting_seller_acceptance", "seller_accepted", "preparing", "ready_for_pickup", "courier_requested", "courier_assigned", "courier_arriving", "picked_up", "in_transit", "delivered"].indexOf(status);
}
