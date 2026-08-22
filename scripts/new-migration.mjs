#!/usr/bin/env node
// Yeni bir Prisma migration'i tamamen cevrimdisi uretir ve dogrular.
//
// Bu ortam Supabase'e baglanamadigi icin "prisma migrate dev" calismaz.
// Onun yerine yerel PostgreSQL'i shadow database olarak kullanip ayni isi yapariz:
//   1. Mevcut migration'lari shadow DB'ye uygular, schema.prisma ile farki alir
//   2. prisma/migrations/<zaman>_<ad>/migration.sql dosyasini yazar
//   3. Supabase SQL Editor'a yapistirilacak SQL'i uretir (Prisma kaydi dahil)
//   4. Tum migration'lari bos bir veritabaninda bastan oynatip dogrular
//
// Kullanim: npm run migration:new -- <ad> [--sql <dosya>]
//   --sql  Prisma semasinin ifade edemedigi SQL (CHECK kisiti, RLS, trigger)
//          uretilen migration'in sonuna eklenir ve birlikte dogrulanir.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync,
} from "node:fs";
import { join } from "node:path";

const PG_BIN = "/usr/lib/postgresql/16/bin";
const PG_ROOT = "/var/lib/postgresql/migration-shadow";
const PG_PORT = 15999;
const MIGRATIONS_DIR = "prisma/migrations";
const SCHEMA = "prisma/schema.prisma";
const PENDING_FILE = "prisma/pending-sql-editor.sql";

const log = (m) => console.log(m);
class MigrationError extends Error {}
const fail = (m) => { throw new MigrationError(m); };

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });

// Postgres root olarak calismayi reddeder; gerekirse postgres kullanicisina gec.
const asPostgres = (shellCmd) =>
  process.getuid?.() === 0
    ? run("su", ["postgres", "-c", `PATH=${PG_BIN}:$PATH ${shellCmd}`])
    : run("bash", ["-c", `PATH=${PG_BIN}:$PATH ${shellCmd}`]);

const psql = (db, args) =>
  run(`${PG_BIN}/psql`, ["-h", "127.0.0.1", "-p", String(PG_PORT), "-U", "postgres", "-d", db, ...args]);

const url = (db) => `postgresql://postgres@127.0.0.1:${PG_PORT}/${db}`;

function startShadowServer() {
  const data = `${PG_ROOT}/data`;
  try {
    asPostgres(`pg_ctl -D ${data} status`);
    log("  Yerel PostgreSQL zaten calisiyor.");
    return;
  } catch {}
  if (process.getuid?.() === 0) {
    mkdirSync(PG_ROOT, { recursive: true });
    run("chown", ["postgres:postgres", PG_ROOT]);
    run("chmod", ["700", PG_ROOT]);
  }
  if (!existsSync(data)) {
    log("  Yerel PostgreSQL kuruluyor (shadow database)...");
    asPostgres(`initdb -D ${data} -U postgres --auth=trust -E UTF8`);
  }
  asPostgres(`pg_ctl -D ${data} -o '-p ${PG_PORT} -h 127.0.0.1' -l ${PG_ROOT}/server.log start -w`);
  log("  Yerel PostgreSQL basladi.");
}

const stopShadowServer = () => {
  try { asPostgres(`pg_ctl -D ${PG_ROOT}/data stop -m fast`); } catch {}
};

const resetDb = (name) => {
  psql("postgres", ["-q", "-c", `DROP DATABASE IF EXISTS ${name};`]);
  psql("postgres", ["-q", "-c", `CREATE DATABASE ${name};`]);
};

const listMigrations = () =>
  existsSync(MIGRATIONS_DIR)
    ? readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
        .filter((e) => e.isDirectory() && existsSync(join(MIGRATIONS_DIR, e.name, "migration.sql")))
        .map((e) => e.name)
        .sort()
    : [];

const checksum = (sql) => createHash("sha256").update(sql).digest("hex");

// migration.sql + Prisma'nin migration kaydi -> SQL Editor'a yapistirilabilir tek parca.
function buildSqlEditorScript(name, sql) {
  return `-- Teacher OS - ${name}
-- Supabase Dashboard > SQL Editor'a yapistirip calistirin.
-- Sema degisikligini uygular ve Prisma'nin migration kaydini yazar.

BEGIN;

${sql}
-- ---------- Prisma migration kaydi ----------
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                  VARCHAR(36) PRIMARY KEY NOT NULL,
    "checksum"            VARCHAR(64) NOT NULL,
    "finished_at"         TIMESTAMPTZ,
    "migration_name"      VARCHAR(255) NOT NULL,
    "logs"                TEXT,
    "rolled_back_at"      TIMESTAMPTZ,
    "started_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);

INSERT INTO "_prisma_migrations"
  ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
SELECT gen_random_uuid()::text, '${checksum(sql)}', now(), '${name}', NULL, NULL, now(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = '${name}'
);

COMMIT;
`;
}

// ---------- 1. Ad kontrolu ----------
const rawName = process.argv[2];
if (!rawName) {
  console.error("\n  HATA: Migration adi gerekli.\n  Ornek: npm run migration:new -- add_lesson_unique\n");
  process.exit(1);
}
if (!/^[a-z0-9_]+$/.test(rawName)) {
  console.error(`\n  HATA: Gecersiz ad "${rawName}". Sadece kucuk harf, rakam ve alt cizgi kullanin.\n`);
  process.exit(1);
}

const sqlFlag = process.argv.indexOf("--sql");
const extraPath = sqlFlag !== -1 ? process.argv[sqlFlag + 1] : null;
if (sqlFlag !== -1 && !extraPath) {
  console.error("\n  HATA: --sql bir dosya yolu bekler.\n");
  process.exit(1);
}
if (extraPath && !existsSync(extraPath)) {
  console.error(`\n  HATA: --sql dosyasi bulunamadi: ${extraPath}\n`);
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
const migrationName = `${stamp}_${rawName}`;

let started = false;
let noChanges = false;
let createdDir = null;
try {
  startShadowServer();
  started = true;

  // ---------- 2. Fark al ----------
  log("  Sema farki hesaplaniyor...");
  resetDb("shadow");
  const diffArgs = [
    "prisma", "migrate", "diff",
    "--from-migrations", MIGRATIONS_DIR,
    "--to-schema-datamodel", SCHEMA,
    "--shadow-database-url", url("shadow"),
    "--script",
  ];
  let sql = run("npx", diffArgs, { env: { ...process.env } }).trim();
  const isEmpty = !sql || /^-- This is an empty migration\.?$/im.test(sql);

  if (extraPath) {
    const extra = readFileSync(extraPath, "utf8").trim();
    sql = isEmpty ? extra : `${sql}\n\n${extra}`;
    log(`  Ek SQL eklendi: ${extraPath}`);
  }

  if (!extraPath && isEmpty) {
    log("\n  Sema ile migration'lar zaten ayni. Yeni migration gerekmiyor.\n");
    noChanges = true;
  }

  if (!noChanges) {

  const dir = join(MIGRATIONS_DIR, migrationName);
  mkdirSync(dir, { recursive: true });
  createdDir = dir;
  const migrationFile = join(dir, "migration.sql");
  writeFileSync(migrationFile, `${sql}\n`, "utf8");
  log(`  Olusturuldu: ${migrationFile}`);

  // ---------- 3. Dogrulama: tum migration'lari bos bir DB'de bastan oynat ----------
  log("  Dogrulaniyor (tum migration'lar sifirdan uygulaniyor)...");
  resetDb("verify");
  const tmp = "/tmp/teacher-os-migration.sql";
  for (const name of listMigrations()) {
    const body = readFileSync(join(MIGRATIONS_DIR, name, "migration.sql"), "utf8");
    writeFileSync(tmp, buildSqlEditorScript(name, body), "utf8");
    try {
      psql("verify", ["-q", "-v", "ON_ERROR_STOP=1", "-f", tmp]);
    } catch (e) {
      fail(`"${name}" uygulanamadi:\n${e.stderr || e.message}`);
    }
  }
  rmSync(tmp, { force: true });

  const prismaEnv = { ...process.env, DATABASE_URL: url("verify"), DIRECT_URL: url("verify") };
  const status = run("npx", ["prisma", "migrate", "status"], { env: prismaEnv });
  if (!/up to date/i.test(status)) fail(`Prisma migration'lari uygulanmis saymadi:\n${status}`);

  // Checksum capraz kontrolu: Prisma'nin kendi yazdigi degerlerle bizimkileri karsilastir.
  // Kendi yazdigimiz kaydi yine kendi hesabimizla dogrulamak dongusel olurdu.
  resetDb("prismachk");
  const prismaOwn = { ...process.env, DATABASE_URL: url("prismachk"), DIRECT_URL: url("prismachk") };
  run("npx", ["prisma", "migrate", "deploy"], { env: prismaOwn });
  for (const name of listMigrations()) {
    const mine = checksum(readFileSync(join(MIGRATIONS_DIR, name, "migration.sql"), "utf8"));
    const theirs = psql("prismachk", ["-tAc",
      `SELECT checksum FROM "_prisma_migrations" WHERE migration_name='${name}'`]).trim();
    if (mine !== theirs) {
      fail(`"${name}" checksum'i Prisma'nin hesabiyla uyusmuyor.\n    prisma : ${theirs}\n    bizim  : ${mine}`);
    }
  }

  const drift = run("npx", [
    "prisma", "migrate", "diff",
    "--from-url", url("verify"),
    "--to-schema-datamodel", SCHEMA,
    "--script",
  ], { env: prismaEnv }).trim();
  if (!/^-- This is an empty migration\.?$/im.test(drift)) {
    fail(`Veritabani semadan farkli kaldi:\n${drift.slice(0, 800)}`);
  }

  // ---------- 4. Yapistirilacak dosyayi yaz ----------
  const pending = buildSqlEditorScript(migrationName, readFileSync(migrationFile, "utf8"));
  writeFileSync(PENDING_FILE, pending, "utf8");

  log(`
  Dogrulandi: migration'lar temiz uygulaniyor, sema ile fark yok.

  Migration : ${migrationName}
  Yapistir  : ${PENDING_FILE}

  Sirada: bu dosyanin icerigini Supabase Dashboard > SQL Editor'a yapistirip calistirin.
`);
    createdDir = null;
  }
} catch (e) {
  // Yarim kalan migration klasoru birikmesin.
  if (createdDir) rmSync(createdDir, { recursive: true, force: true });
  console.error(e instanceof MigrationError ? `\n  HATA: ${e.message}\n` : `\n  HATA: ${e.stderr || e.message}\n`);
  process.exitCode = 1;
} finally {
  if (started) stopShadowServer();
}
