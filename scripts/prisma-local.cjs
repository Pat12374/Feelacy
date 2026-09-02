#!/usr/bin/env node

/**
 * Runs Prisma against the local SQLite database while keeping PostgreSQL as
 * the canonical production schema and migration provider.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const prismaDir = path.join(process.cwd(), "prisma");
const sourcePath = path.join(prismaDir, "schema.prisma");
const localPath = path.join(prismaDir, ".schema.local.prisma");
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Usage: node scripts/prisma-local.cjs <prisma command...>");
  process.exit(1);
}

const source = fs.readFileSync(sourcePath, "utf8");
const localSchema = source
  .replace('provider = "postgresql"', 'provider = "sqlite"')
  .replace("payload     Json?", "payload     String?");

if (localSchema === source || !localSchema.includes('provider = "sqlite"')) {
  console.error("Could not derive the local SQLite Prisma schema.");
  process.exit(1);
}

fs.writeFileSync(localPath, localSchema);

try {
  const prismaBin = path.join(
    process.cwd(),
    "node_modules",
    ".bin",
    process.platform === "win32" ? "prisma.cmd" : "prisma",
  );
  const result = spawnSync(prismaBin, [...args, "--schema", localPath], {
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  fs.rmSync(localPath, { force: true });
}
