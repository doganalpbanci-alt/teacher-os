// Veli mesajı kurallarının saf hesap testi. Tarayıcı açmaz: telefon
// normalizasyonu, WhatsApp bağlantısı ve şablon üretimi veritabanına da
// ekrana da bağımlı değildir, doğrudan sınanır.
//
// Kurallar TypeScript'te yazılı olduğu için önce geçici bir dizine derlenir.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "parent-message-rules-"));
try {
  execFileSync("npx", [
    "tsc", "scripts/parent-message-rules/kurallar.ts",
    "--outDir", out,
    "--module", "commonjs", "--target", "es2022",
    "--moduleResolution", "node10", "--skipLibCheck",
  ], { stdio: ["ignore", "pipe", "inherit"] });
  execFileSync("node", [join(out, "scripts/parent-message-rules/kurallar.js")], { stdio: "inherit" });
} finally {
  rmSync(out, { recursive: true, force: true });
}
