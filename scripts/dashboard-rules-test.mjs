// Panel kurallarının saf hesap testi. Tarayıcı açmaz: eşikler ve "dikkat
// gereken öğrenci" kararı veritabanına da ekrana da bağımlı değildir,
// doğrudan sınanır. Eşiklerin tam sınırı (1'e karşı 2 ödev, %50'ye karşı
// %49.9) burada korunur.
//
// Kurallar TypeScript'te yazılı olduğu için önce geçici bir dizine derlenir.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "dashboard-rules-"));
try {
  execFileSync("npx", [
    "tsc", "scripts/dashboard-rules/kurallar.ts",
    "--outDir", out,
    "--module", "commonjs", "--target", "es2022",
    "--moduleResolution", "node10", "--skipLibCheck",
  ], { stdio: ["ignore", "pipe", "inherit"] });
  execFileSync("node", [join(out, "scripts/dashboard-rules/kurallar.js")], { stdio: "inherit" });
} finally {
  rmSync(out, { recursive: true, force: true });
}
