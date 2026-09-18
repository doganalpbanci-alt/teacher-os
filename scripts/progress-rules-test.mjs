// Gelişim görünümünün saf kural testi: eşiklerin tam sınırı, "iyi yön"
// mantığı (eksi düşünce iyileşme sayılır), eksik veride ok uydurulmaması ve
// ders başına normalleştirme. Tarayıcı ve veritabanı açmaz.
//
// Kurallar TypeScript'te yazılı olduğu için önce geçici bir dizine derlenir.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "progress-rules-"));
try {
  execFileSync("npx", [
    "tsc", "scripts/progress-rules/kurallar.ts",
    "--outDir", out,
    "--module", "commonjs", "--target", "es2022",
    "--moduleResolution", "node10", "--skipLibCheck",
  ], { stdio: ["ignore", "pipe", "inherit"] });
  execFileSync("node", [join(out, "scripts/progress-rules/kurallar.js")], { stdio: "inherit" });
} finally {
  rmSync(out, { recursive: true, force: true });
}
