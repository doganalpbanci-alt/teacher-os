// Ders sırasında öğrenci eklenmediği için form katlı durur. Testler de
// öğretmen gibi önce açar. Sayfa yenilendiğinde katlanma geri geldiği için
// her eklemeden önce çağrılır.
export async function ogrenciFormunuAc(sayfa) {
  const detay = sayfa.locator("details.katlanir");
  if ((await detay.count()) === 0) return;
  if (await detay.first().evaluate((e) => e.open)) return;
  await sayfa.locator("summary").first().click();
  await sayfa.getByLabel("Ad", { exact: true }).waitFor({ state: "visible", timeout: 5000 });
}
