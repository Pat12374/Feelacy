"use client";

import { useState } from "react";

export function ListingImageInput({ defaultValue = "", label }: { defaultValue?: string; label: string }) {
  const [url, setUrl] = useState(defaultValue);
  const [status, setStatus] = useState("");

  async function upload(file: File | undefined) {
    if (!file) return;
    setStatus("Preparing upload…");
    const response = await fetch("/api/media/upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contentType: file.type, size: file.size }),
    });
    if (!response.ok) {
      setStatus("Upload unavailable. Use an approved HTTPS image URL.");
      return;
    }
    const target = (await response.json()) as { uploadUrl: string; publicUrl: string };
    const uploaded = await fetch(target.uploadUrl, {
      method: "PUT",
      headers: { "content-type": file.type },
      body: file,
    });
    if (!uploaded.ok) {
      setStatus("Upload failed.");
      return;
    }
    setUrl(target.publicUrl);
    setStatus("Image uploaded.");
  }

  return (
    <div className="grid gap-2">
      <label className="wt-label">
        {label}
        <input className="wt-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void upload(event.target.files?.[0])} />
      </label>
      <label className="wt-label">
        Approved image URL
        <input className="wt-input" name="imageUrl" type="url" value={url} onChange={(event) => setUrl(event.target.value)} />
      </label>
      <p aria-live="polite" className="text-sm text-[var(--ink-soft)]">{status}</p>
    </div>
  );
}
