"use client";
import { useState } from "react";
import { ProximitySearch } from "@/components/proximity-search";

const proximityTypes = new Set(["SELLER_PICKUP", "EXPRESS", "ON_DEMAND"]);
const fulfillmentOptions = [
  { value: "STANDARD_SHIPPING", label: "Standard shipping", hint: "Seller ships through a standard carrier" },
  { value: "SELLER_PICKUP", label: "Seller pickup", hint: "Collect from an approved seller location" },
  { value: "EXPRESS", label: "Express delivery", hint: "Fast provider-neutral local courier delivery" },
  { value: "ON_DEMAND", label: "On-demand courier", hint: "DoorDash or Uber Direct when enabled and approved" },
  { value: "SCHEDULED", label: "Scheduled delivery", hint: "Choose an available future delivery window" },
] as const;

export function FulfillmentSearchControls({ fulfillmentType, latitude, longitude, radiusMiles }: { fulfillmentType?: string; latitude?: string; longitude?: string; radiusMiles?: string }) {
  const [type, setType] = useState(fulfillmentType ?? "STANDARD_SHIPPING");
  const showDistance = proximityTypes.has(type);
  return <>
    <label className="wt-label min-w-0 md:col-span-6">
      Type of buy
      <select className="wt-select" name="fulfillmentType" value={type} onChange={event => setType(event.target.value)}>
        {fulfillmentOptions.map(option => <option key={option.value} value={option.value}>{option.label} — {option.hint}</option>)}
      </select>
    </label>
    {showDistance && <>
      <label className="wt-label mt-3 min-w-0 md:col-span-2 md:col-start-1">
        Distance (optional)
        <select className="wt-select" name="radiusMiles" defaultValue={radiusMiles ?? (5 * 0.621371).toFixed(6)}>
          {Array.from({ length: 51 }, (_, kilometers) => {
            const miles = kilometers * 0.621371;
            return <option key={kilometers} value={miles.toFixed(6)}>{kilometers} km — {miles.toFixed(2)} mi</option>;
          })}
        </select>
        <span className="text-xs text-[var(--ink-soft)]">miles = kilometers × 0.621371</span>
      </label>
      <ProximitySearch latitude={latitude} longitude={longitude} />
    </>}
  </>;
}
