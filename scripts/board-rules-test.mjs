// Tahta bildiriminin saf kural testi. Tarayıcı açmaz, sunucu gerektirmez:
// bildirim metni ve ekranda kalma süresi veritabanına da ekrana da bağlı
// değildir, doğrudan sınanır.
//
// Süre kuralının SIRA BASKISI kısmı burada korunur: tarayıcıda üç kartın
// aynı yoklamaya düşmesini garanti etmek mümkün değil, burada kesin.
//
// Kurallar TypeScript'te yazılı olduğu için önce geçici bir dizine derlenir.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "board-rules-"));
try {
  execFileSync("npx", [
    "tsc", "scripts/board-rules/kurallar.ts",
    "--outDir", out,
    "--module", "commonjs", "--target", "es2022",
    "--moduleResolution", "node10", "--skipLibCheck",
  ], { stdio: ["ignore", "pipe", "inherit"] });
  execFileSync("node", [join(out, "scripts/board-rules/kurallar.js")], { stdio: "inherit" });
} finally {
  rmSync(out, { recursive: true, force: true });
}
