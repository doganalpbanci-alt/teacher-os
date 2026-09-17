// EXP kurallarının saf hesap testi. Tarayıcı açmaz: EXP sabitleri ve seviye
// formülü veritabanına da ekrana da bağımlı değildir, doğrudan sınanır.
//
// Kurallar TypeScript'te yazılı olduğu için önce geçici bir dizine derlenir.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "exp-rules-"));
try {
  execFileSync("npx", [
    "tsc", "scripts/exp-rules/kurallar.ts",
    "--outDir", out,
    "--module", "commonjs", "--target", "es2022",
    "--moduleResolution", "node10", "--skipLibCheck",
  ], { stdio: ["ignore", "pipe", "inherit"] });
  execFileSync("node", [join(out, "scripts/exp-rules/kurallar.js")], { stdio: "inherit" });
} finally {
  rmSync(out, { recursive: true, force: true });
}
