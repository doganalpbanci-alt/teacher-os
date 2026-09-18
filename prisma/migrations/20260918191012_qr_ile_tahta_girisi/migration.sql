-- CreateTable
CREATE TABLE "DevicePairing" (
    "id" TEXT NOT NULL,
    "verifierHash" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "teacherId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DevicePairing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DevicePairing_expiresAt_idx" ON "DevicePairing"("expiresAt");

-- AddForeignKey
ALTER TABLE "DevicePairing" ADD CONSTRAINT "DevicePairing_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Dogrulama kodu bicimi veritabaninda da korunur: 4 hane, yalnizca rakam.
ALTER TABLE "DevicePairing"
  ADD CONSTRAINT "DevicePairing_code_bicimi" CHECK ("code" ~ '^[0-9]{4}$');

-- Onaylanmamis bir eslesme kullanilmis olamaz. Durum kolonu tutulmadigi icin
-- tutarliligi bu kisit korur.
ALTER TABLE "DevicePairing"
  ADD CONSTRAINT "DevicePairing_onaysiz_kullanilamaz"
  CHECK ("consumedAt" IS NULL OR "approvedAt" IS NOT NULL);

-- Onaylanmis bir eslesmenin ogretmeni olmak zorunda: oturum onun icin acilir.
ALTER TABLE "DevicePairing"
  ADD CONSTRAINT "DevicePairing_onayda_ogretmen_zorunlu"
  CHECK ("approvedAt" IS NULL OR "teacherId" IS NOT NULL);

-- Diger tablolarla ayni: RLS acik, policy yok. Uygulama tablo sahibi olarak
-- baglanir ve RLS'i atlar; bu yalnizca anon REST API'sini kapatir.
ALTER TABLE "DevicePairing" ENABLE ROW LEVEL SECURITY;
