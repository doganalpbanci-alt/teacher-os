// Sinav kurallarinin saf hesap testi. Digerlerinden farkli olarak tarayici
// acmaz: agirlikli puan, net ve donem hesabi veritabanina da ekrana da
// bagimli degildir, dogrudan sinanir.
//
// Kurallar TypeScript'te yazili oldugu icin once gecici bir dizine derlenir.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "exam-rules-"));
try {
  execFileSync("npx", [
    "tsc", "scripts/exam-rules/kurallar.ts",
    "--outDir", out,
    "--module", "commonjs", "--target", "es2022",
    "--moduleResolution", "node10", "--skipLibCheck",
  ], { stdio: ["ignore", "pipe", "inherit"] });
  execFileSync("node", [join(out, "scripts/exam-rules/kurallar.js")], { stdio: "inherit" });
} finally {
  rmSync(out, { recursive: true, force: true });
}
