// Testler için ortak oturum adımı. Uygulama artık giriş istiyor; her test
// önce hesabı kurar ya da var olan hesapla girer.
export const TEST_EPOSTA = "test@ornek.com";
export const TEST_PAROLA = "uzunparola1";

export async function oturumHazirla(sayfa, temel) {
  await sayfa.goto(temel, { waitUntil: "networkidle" });

  if (sayfa.url().includes("/kurulum")) {
    await sayfa.getByLabel("Adınız").fill("Test Öğretmeni");
    await sayfa.getByLabel("E-posta", { exact: true }).fill(TEST_EPOSTA);
    await sayfa.getByLabel("Parola", { exact: true }).fill(TEST_PAROLA);
    await sayfa.getByLabel("Parola tekrar").fill(TEST_PAROLA);
    await sayfa.getByRole("button", { name: "Hesabı oluştur" }).click();
    await sayfa.waitForURL(`${temel}/`, { timeout: 20000 });
    return;
  }

  if (sayfa.url().includes("/giris")) {
    await sayfa.getByLabel("E-posta").fill(TEST_EPOSTA);
    await sayfa.getByLabel("Parola").fill(TEST_PAROLA);
    await sayfa.getByRole("button", { name: "Giriş yap" }).click();
    await sayfa.waitForURL(`${temel}/`, { timeout: 20000 });
  }
}
