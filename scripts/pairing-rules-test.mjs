// QR ile tahta girişinin saf kural testi: süre sabitleri, kod biçimi,
// eşleşme durumunun üç zaman damgasından türetilmesi, izin verilen geçişler,
// çerez çözümü ve giriş sonrası dönüş adresinin açık yönlendirme koruması.
// Tarayıcı ve veritabanı açmaz.
//
// Kurallar TypeScript'te yazılı olduğu için önce geçici bir dizine derlenir.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "pairing-rules-"));
try {
  execFileSync("npx", [
    "tsc", "scripts/pairing-rules/kurallar.ts",
    "--outDir", out,
    "--module", "commonjs", "--target", "es2022",
    "--moduleResolution", "node10", "--skipLibCheck",
  ], { stdio: ["ignore", "pipe", "inherit"] });
  execFileSync("node", [join(out, "scripts/pairing-rules/kurallar.js")], { stdio: "inherit" });
} finally {
  rmSync(out, { recursive: true, force: true });
}
