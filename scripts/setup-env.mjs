#!/usr/bin/env node
// .env dosyasindaki DATABASE_URL'i Supabase + Prisma icin duzenler:
//  - DATABASE_URL (pooler, 6543) sonuna pgbouncer=true&connection_limit=1 ekler
//  - Ayni baglantidan portu 5432 olan DIRECT_URL'i turetir (migration icin)
// Idempotent: birden fazla calistirmak dosyayi bozmaz. Deger iceriklerini ekrana yazmaz.

import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";

const ENV_PATH = resolve(process.cwd(), ".env");
const POOLED_PARAMS = "pgbouncer=true&connection_limit=1";

const fail = (msg) => {
  console.error(`\n  HATA: ${msg}\n`);
  process.exit(1);
};

if (!existsSync(ENV_PATH)) {
  fail(`.env bulunamadi: ${ENV_PATH}\n  Once ".env.example" dosyasini ".env" olarak kopyalayin.`);
}

const original = readFileSync(ENV_PATH, "utf8");
const lines = original.split(/\r?\n/);

// KEY="deger" / KEY=deger satirini bulur, tirnak bilgisini korur.
const findVar = (key) => {
  const re = new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=\\s*(.*)$`);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(re);
    if (!m) continue;
    const raw = m[1].trim();
    const quote = raw.startsWith('"') ? '"' : raw.startsWith("'") ? "'" : "";
    const value = quote ? raw.slice(1, raw.lastIndexOf(quote)) : raw;
    return { index: i, value, quote };
  }
  return null;
};

const dbUrl = findVar("DATABASE_URL");
if (!dbUrl) fail(".env icinde DATABASE_URL satiri yok.");
if (!dbUrl.value) fail("DATABASE_URL bos.");

let url;
try {
  url = new URL(dbUrl.value);
} catch {
  fail("DATABASE_URL gecerli bir baglanti adresi degil.");
}

const isPooler = url.hostname.includes("pooler.supabase.com");
if (!isPooler) {
  console.warn(
    `\n  UYARI: DATABASE_URL host'u pooler.supabase.com degil (${url.hostname}).` +
      `\n  Bu script Supabase pooler baglantisi icin yazildi; degisiklik yapilmadi.\n`
  );
  process.exit(0);
}

// Migration icin dogrudan baglanti: ayni adres, port 5432, query parametresi yok.
const directUrl = new URL(url.toString());
directUrl.port = "5432";
directUrl.search = "";

// Uygulama icin havuzlanmis baglanti: port 6543 + pgbouncer parametreleri.
const pooledUrl = new URL(url.toString());
pooledUrl.port = "6543";
pooledUrl.search = POOLED_PARAMS;

const changes = [];
const q = dbUrl.quote || '"';

if (pooledUrl.toString() !== dbUrl.value) {
  lines[dbUrl.index] = `DATABASE_URL=${q}${pooledUrl.toString()}${q}`;
  changes.push("DATABASE_URL guncellendi (port 6543 + pgbouncer=true&connection_limit=1)");
} else {
  console.log("  DATABASE_URL zaten dogru, dokunulmadi.");
}

const existingDirect = findVar("DIRECT_URL");
if (existingDirect && existingDirect.value) {
  console.log("  DIRECT_URL zaten tanimli, dokunulmadi.");
} else if (existingDirect) {
  lines[existingDirect.index] = `DIRECT_URL=${q}${directUrl.toString()}${q}`;
  changes.push("DIRECT_URL dolduruldu (port 5432, migration icin)");
} else {
  const insertAt = dbUrl.index + 1;
  lines.splice(
    insertAt,
    0,
    "",
    "# Migration icin dogrudan baglanti (session pooler, port 5432).",
    "# Transaction pooler DDL ve advisory lock desteklemez.",
    `DIRECT_URL=${q}${directUrl.toString()}${q}`
  );
  changes.push("DIRECT_URL eklendi (port 5432, migration icin)");
}

if (changes.length === 0) {
  console.log("\n  .env zaten hazir, degisiklik gerekmedi.\n");
  process.exit(0);
}

copyFileSync(ENV_PATH, `${ENV_PATH}.backup`);
writeFileSync(ENV_PATH, lines.join("\n"), "utf8");

console.log("\n  .env guncellendi (yedek: .env.backup)");
for (const c of changes) console.log(`   - ${c}`);
console.log("\n  Sirada: npx prisma migrate dev --name init\n");
