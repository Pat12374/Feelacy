#!/usr/bin/env node
/**
 * Ensures local .env has required keys for development.
 * Does not overwrite existing non-empty AUTH_SECRET.
 */
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

const envPath = path.join(process.cwd(), ".env");
const examplePath = path.join(process.cwd(), ".env.example");

let content = fs.existsSync(envPath)
  ? fs.readFileSync(envPath, "utf8")
  : fs.existsSync(examplePath)
    ? fs.readFileSync(examplePath, "utf8")
    : "";

function get(key) {
  const m = content.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return null;
  return m[1].replace(/^"|"$/g, "").trim();
}

function set(key, value) {
  const line = `${key}="${value}"`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(content)) content = content.replace(re, line);
  else
    content +=
      (content.endsWith("\n") || !content ? "" : "\n") + line + "\n";
}

if (!get("DATABASE_URL")) set("DATABASE_URL", "file:./dev.db");
if (!get("NEXT_PUBLIC_APP_URL"))
  set("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
if (!get("AUTH_URL")) set("AUTH_URL", "http://localhost:3000");

const secret = get("AUTH_SECRET");
if (!secret) {
  set("AUTH_SECRET", crypto.randomBytes(32).toString("base64"));
  console.log("Generated AUTH_SECRET");
}

if (get("ALLOW_DEMO_CHECKOUT") == null) set("ALLOW_DEMO_CHECKOUT", "true");
if (get("ALLOW_LOCAL_PLAN_UPGRADE") == null)
  set("ALLOW_LOCAL_PLAN_UPGRADE", "true");

fs.writeFileSync(envPath, content.endsWith("\n") ? content : content + "\n");
console.log("Ensured .env at", envPath);
