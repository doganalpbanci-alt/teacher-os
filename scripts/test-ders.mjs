// Testler için ortak ders adımı. Bir sınıfın aynı anda tek dersi olur:
// süren ders varsa önce bitirilir, sonra yenisi başlatılır.
export async function dersBaslat(sayfa, beklenen = "Aktif ders:") {
  const bitir = sayfa.getByRole("button", { name: "Dersi bitir" });
  if ((await bitir.count()) > 0) {
    await bitir.click();
    await sayfa.waitForFunction(
      () => document.body.innerText.includes("Aktif ders yok"),
      null,
      { timeout: 10000 },
    );
  }

  const onceki = await sayfa.textContent("body");
  await sayfa.getByRole("button", { name: "Yeni ders başlat" }).click();
  await sayfa.waitForFunction(
    ([x, b]) => document.body.innerText !== x && document.body.innerText.includes(b),
    [onceki, beklenen],
    { timeout: 10000 },
  );
  await sayfa.waitForTimeout(400);
}
