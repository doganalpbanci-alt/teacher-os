"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTeacher } from "@/lib/current-teacher";
import type { FormState } from "@/lib/form-state";
import { dersBaslat, dersBitir, DersHatasi } from "@/lib/lesson";
import {
  davranisKaydet,
  eylemGecerliMi,
  sonKaydiGeriAl,
  DavranisHatasi,
} from "@/lib/behavior";
import { yazmaKilitli } from "@/lib/lock";
import { parolaDogru } from "@/lib/auth";
import { hesapVerisiniSifirla } from "@/lib/account-reset";

const AD_SINIRI = 60;
const TELEFON_SINIRI = 30;

function metin(deger: FormDataEntryValue | null): string {
  return typeof deger === "string" ? deger.trim() : "";
}

function bosIseNull(deger: string): string | null {
  return deger.length > 0 ? deger : null;
}

function hata(
  onceki: FormState,
  mesaj: string,
  degerler: Record<string, string>,
): FormState {
  return { hata: mesaj, deneme: onceki.deneme + 1, degerler };
}

function basarili(onceki: FormState): FormState {
  return { hata: null, deneme: onceki.deneme + 1, degerler: {} };
}

const KILIT_MESAJI = "Tahta kilitli. Önce PIN ile açın.";

/**
 * Ders ekranından ulaşılabilen her yazma işleminin başında durur.
 *
 * Middleware kilitli cihazı zaten tek sayfaya hapsediyor, ama düğmeyi
 * gizlemek kuralın kendisi değildir: açık kalmış bir sekme ya da geri
 * gönderilen bir form kilidi delmemeli. Kural yazmanın yanında durur.
 */
async function kilitliyseDur(onceki: FormState): Promise<FormState | null> {
  return (await yazmaKilitli()) ? hata(onceki, KILIT_MESAJI, {}) : null;
}

export async function sinifOlustur(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const ad = metin(formData.get("ad"));
  const girilen = { ad };

  if (!ad) return hata(onceki, "Sınıf adı boş olamaz.", girilen);
  if (ad.length > AD_SINIRI) {
    return hata(onceki, `Sınıf adı en fazla ${AD_SINIRI} karakter olabilir.`, girilen);
  }

  try {
    const ogretmen = await getCurrentTeacher();
    await prisma.classroom.create({ data: { name: ad, teacherId: ogretmen.id } });
  } catch {
    return hata(
      onceki,
      "Sınıf kaydedilemedi. Veritabanına ulaşılamıyor olabilir.",
      girilen,
    );
  }

  revalidatePath("/");
  return basarili(onceki);
}

/** Sınıfı arşivler ya da arşivden çıkarır. Kayıtlara dokunmaz, yalnızca
 * ana sayfadaki listeden gizler. */
export async function sinifArsivDegistir(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const sinifId = metin(formData.get("sinifId"));
  const arsiv = formData.get("arsiv") === "1";

  if (!sinifId) return hata(onceki, "Sınıf bilgisi eksik.", {});

  try {
    const ogretmen = await getCurrentTeacher();
    const sinif = await prisma.classroom.findFirst({
      where: { id: sinifId, teacherId: ogretmen.id },
      select: { id: true },
    });
    if (!sinif) return hata(onceki, "Sınıf bulunamadı.", {});

    await prisma.classroom.update({
      where: { id: sinif.id },
      data: { isActive: !arsiv },
    });
  } catch {
    return hata(onceki, "Sınıf güncellenemedi. Veritabanına ulaşılamıyor olabilir.", {});
  }

  revalidatePath("/");
  revalidatePath(`/sinif/${sinifId}`);
  return basarili(onceki);
}

/**
 * Sınıfı kalıcı siler. Yalnızca hiç öğrenci eklenmemiş ve hiç ders
 * açılmamışsa mümkündür — yanlışlıkla açılan boş sınıf iz bırakmadan
 * kalkar. Geçmişi olan bir sınıf silinerek yok edilmez, onun yolu arşiv.
 */
export async function sinifSil(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const sinifId = metin(formData.get("sinifId"));
  if (!sinifId) return hata(onceki, "Sınıf bilgisi eksik.", {});

  try {
    const ogretmen = await getCurrentTeacher();
    const sinif = await prisma.classroom.findFirst({
      where: { id: sinifId, teacherId: ogretmen.id },
      select: { id: true, _count: { select: { students: true, lessons: true } } },
    });
    if (!sinif) return hata(onceki, "Sınıf bulunamadı.", {});
    if (sinif._count.students > 0 || sinif._count.lessons > 0) {
      return hata(
        onceki,
        "Bu sınıfta öğrenci ya da ders var. Silmek yerine arşivleyin.",
        {},
      );
    }

    await prisma.classroom.delete({ where: { id: sinif.id } });
  } catch {
    return hata(onceki, "Sınıf silinemedi. Veritabanına ulaşılamıyor olabilir.", {});
  }

  revalidatePath("/");
  redirect("/");
}

export async function ogrenciEkle(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const kilit = await kilitliyseDur(onceki);
  if (kilit) return kilit;

  const sinifId = metin(formData.get("sinifId"));
  const ad = metin(formData.get("ad"));
  const soyad = metin(formData.get("soyad"));
  const veliAdi = metin(formData.get("veliAdi"));
  const veliTelefonu = metin(formData.get("veliTelefonu"));
  const veliOnayi = formData.get("veliOnayi") === "on";

  const girilen = { ad, soyad, veliAdi, veliTelefonu };

  if (!sinifId) return hata(onceki, "Sınıf bilgisi eksik.", girilen);
  if (!ad) return hata(onceki, "Öğrenci adı boş olamaz.", girilen);
  if (!soyad) return hata(onceki, "Öğrenci soyadı boş olamaz.", girilen);
  if (ad.length > AD_SINIRI || soyad.length > AD_SINIRI) {
    return hata(onceki, `Ad ve soyad en fazla ${AD_SINIRI} karakter olabilir.`, girilen);
  }
  if (veliAdi.length > AD_SINIRI) {
    return hata(onceki, `Veli adı en fazla ${AD_SINIRI} karakter olabilir.`, girilen);
  }
  if (veliTelefonu.length > TELEFON_SINIRI) {
    return hata(
      onceki,
      `Veli telefonu en fazla ${TELEFON_SINIRI} karakter olabilir.`,
      girilen,
    );
  }
  // Telefon numarası girilecekse iznin teyidi zorunlu; isteğe bağlı olan
  // yalnızca telefonun kendisi, izin değil. Bu, KVKK uyumluluğunu garanti
  // etmez -- yalnızca öğretmenin beyanının zaman damgalı bir izini tutar.
  if (veliTelefonu.length > 0 && !veliOnayi) {
    return hata(
      onceki,
      "Veli telefonu girmek için iznin olduğunu onaylamalısınız.",
      girilen,
    );
  }

  try {
    // Sınıf silinmiş, id elle değiştirilmiş ya da başka bir öğretmene ait
    // olabilir. Sahiplik sorguya katılır; başkasının sınıfı "bulunamadı"
    // sayılır, "var ama senin değil" demek bile bilgi sızdırır.
    const ogretmen = await getCurrentTeacher();
    const sinif = await prisma.classroom.findFirst({
      where: { id: sinifId, teacherId: ogretmen.id },
    });
    if (!sinif) return hata(onceki, "Sınıf bulunamadı.", girilen);

    await prisma.student.create({
      data: {
        classroomId: sinifId,
        firstName: ad,
        lastName: soyad,
        parentName: bosIseNull(veliAdi),
        parentPhone: bosIseNull(veliTelefonu),
        parentConsentAt: veliTelefonu.length > 0 ? new Date() : null,
      },
    });
  } catch {
    return hata(
      onceki,
      "Öğrenci kaydedilemedi. Veritabanına ulaşılamıyor olabilir.",
      girilen,
    );
  }

  revalidatePath(`/sinif/${sinifId}`);
  revalidatePath("/");
  return basarili(onceki);
}

/** Öğrencinin ad/soyadını düzeltir. Ekleme sırasında yapılan bir yazım
 * hatasının tek düzeltme yolu buydu; SQL ile elle değiştirmek gerekiyordu. */
export async function ogrenciAdiGuncelle(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const kilit = await kilitliyseDur(onceki);
  if (kilit) return kilit;

  const ogrenciId = metin(formData.get("ogrenciId"));
  const ad = metin(formData.get("ad"));
  const soyad = metin(formData.get("soyad"));
  const girilen = { ad, soyad };

  if (!ogrenciId) return hata(onceki, "Öğrenci bilgisi eksik.", girilen);
  if (!ad) return hata(onceki, "Öğrenci adı boş olamaz.", girilen);
  if (!soyad) return hata(onceki, "Öğrenci soyadı boş olamaz.", girilen);
  if (ad.length > AD_SINIRI || soyad.length > AD_SINIRI) {
    return hata(onceki, `Ad ve soyad en fazla ${AD_SINIRI} karakter olabilir.`, girilen);
  }

  let sinifId: string | null = null;
  try {
    const ogretmen = await getCurrentTeacher();
    // Sahiplik sorgunun parçası: başkasının öğrencisi "bulunamadı" sayılır.
    const ogrenci = await prisma.student.findFirst({
      where: { id: ogrenciId, classroom: { teacherId: ogretmen.id } },
      select: { classroomId: true },
    });
    if (!ogrenci) return hata(onceki, "Öğrenci bulunamadı.", girilen);
    sinifId = ogrenci.classroomId;

    await prisma.student.update({
      where: { id: ogrenciId },
      data: { firstName: ad, lastName: soyad },
    });
  } catch {
    return hata(onceki, "İsim kaydedilemedi. Veritabanına ulaşılamıyor olabilir.", girilen);
  }

  revalidatePath(`/ogrenci/${ogrenciId}`);
  if (sinifId) revalidatePath(`/sinif/${sinifId}`);
  return basarili(onceki);
}

/** Öğrenciyi arşivler ya da arşivden çıkarır. Kayıtlara dokunmaz, yalnızca
 * sınıf listesinden gizler. */
export async function ogrenciArsivDegistir(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const ogrenciId = metin(formData.get("ogrenciId"));
  const arsiv = formData.get("arsiv") === "1";

  if (!ogrenciId) return hata(onceki, "Öğrenci bilgisi eksik.", {});

  let sinifId: string | null = null;
  try {
    const ogretmen = await getCurrentTeacher();
    const ogrenci = await prisma.student.findFirst({
      where: { id: ogrenciId, classroom: { teacherId: ogretmen.id } },
      select: { classroomId: true },
    });
    if (!ogrenci) return hata(onceki, "Öğrenci bulunamadı.", {});
    sinifId = ogrenci.classroomId;

    await prisma.student.update({
      where: { id: ogrenciId },
      data: { isActive: !arsiv },
    });
  } catch {
    return hata(onceki, "Öğrenci güncellenemedi. Veritabanına ulaşılamıyor olabilir.", {});
  }

  revalidatePath(`/ogrenci/${ogrenciId}`);
  if (sinifId) revalidatePath(`/sinif/${sinifId}`);
  return basarili(onceki);
}

/**
 * Öğrenciyi kalıcı siler. Yalnızca hiçbir geçmiş kaydı (davranış, ceza,
 * ödev, sınav, veli mesajı) yoksa mümkündür — yanlışlıkla eklenen öğrenci
 * iz bırakmadan kalkar. Geçmişi olan bir öğrenci silinerek yok edilmez,
 * onun yolu arşiv.
 */
export async function ogrenciSil(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const ogrenciId = metin(formData.get("ogrenciId"));
  if (!ogrenciId) return hata(onceki, "Öğrenci bilgisi eksik.", {});

  let sinifId: string | null = null;
  try {
    const ogretmen = await getCurrentTeacher();
    const ogrenci = await prisma.student.findFirst({
      where: { id: ogrenciId, classroom: { teacherId: ogretmen.id } },
      select: {
        classroomId: true,
        _count: {
          select: {
            behaviorLogs: true,
            breakPenalties: true,
            submissions: true,
            examResults: true,
            parentMessages: true,
          },
        },
      },
    });
    if (!ogrenci) return hata(onceki, "Öğrenci bulunamadı.", {});

    const toplamKayit =
      ogrenci._count.behaviorLogs +
      ogrenci._count.breakPenalties +
      ogrenci._count.submissions +
      ogrenci._count.examResults +
      ogrenci._count.parentMessages;
    if (toplamKayit > 0) {
      return hata(
        onceki,
        "Bu öğrencinin geçmiş kaydı var. Silmek yerine arşivleyin.",
        {},
      );
    }

    sinifId = ogrenci.classroomId;
    await prisma.student.delete({ where: { id: ogrenciId } });
  } catch {
    return hata(onceki, "Öğrenci silinemedi. Veritabanına ulaşılamıyor olabilir.", {});
  }

  revalidatePath("/");
  if (sinifId) revalidatePath(`/sinif/${sinifId}`);
  redirect(sinifId ? `/sinif/${sinifId}` : "/");
}

export async function yeniDersBaslat(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const kilit = await kilitliyseDur(onceki);
  if (kilit) return kilit;

  const sinifId = metin(formData.get("sinifId"));
  if (!sinifId) return hata(onceki, "Sınıf bilgisi eksik.", {});

  try {
    const ogretmen = await getCurrentTeacher();
    const sinif = await prisma.classroom.findFirst({
      where: { id: sinifId, teacherId: ogretmen.id },
    });
    if (!sinif) return hata(onceki, "Sınıf bulunamadı.", {});
    await dersBaslat(sinifId);
  } catch (error) {
    if (error instanceof DersHatasi) return hata(onceki, error.message, {});
    return hata(onceki, "Ders başlatılamadı. Veritabanına ulaşılamıyor olabilir.", {});
  }

  revalidatePath(`/sinif/${sinifId}`);
  return basarili(onceki);
}

export async function dersiBitir(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const kilit = await kilitliyseDur(onceki);
  if (kilit) return kilit;

  const dersId = metin(formData.get("dersId"));
  const sinifId = metin(formData.get("sinifId"));
  if (!dersId) return hata(onceki, "Ders bilgisi eksik.", {});

  try {
    // Sahiplik dersBitir icinde sorgunun parcasi; baskasinin dersi
    // "bulunamadi" doner.
    const ogretmen = await getCurrentTeacher();
    await dersBitir(dersId, ogretmen.id);
  } catch (error) {
    if (error instanceof DersHatasi) return hata(onceki, error.message, {});
    return hata(onceki, "Ders bitirilemedi. Veritabanına ulaşılamıyor olabilir.", {});
  }

  if (sinifId) revalidatePath(`/sinif/${sinifId}`);
  return basarili(onceki);
}

export async function davranisKaydiOlustur(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const kilit = await kilitliyseDur(onceki);
  if (kilit) return kilit;

  const ogrenciId = metin(formData.get("ogrenciId"));
  const dersId = metin(formData.get("dersId"));
  const tur = metin(formData.get("tur"));

  if (!ogrenciId || !dersId) return hata(onceki, "Kayıt bilgisi eksik.", {});

  try {
    // Hangi eylemlerin gecerli oldugu ogretmenin sablonuna baglidir; sablon
    // istemciden degil sunucudan okunur.
    const ogretmen = await getCurrentTeacher();
    if (!eylemGecerliMi(ogretmen.behaviorTemplate, tur)) {
      return hata(onceki, "Geçersiz davranış türü.", {});
    }
    await davranisKaydet(
      ogrenciId,
      dersId,
      tur,
      ogretmen.behaviorTemplate,
      ogretmen.id,
    );
  } catch (error) {
    if (error instanceof DavranisHatasi) return hata(onceki, error.message, {});
    return hata(onceki, "Kayıt eklenemedi. Veritabanına ulaşılamıyor olabilir.", {});
  }

  const sinifId = metin(formData.get("sinifId"));
  if (sinifId) revalidatePath(`/sinif/${sinifId}`);
  revalidatePath("/");
  return basarili(onceki);
}

/**
 * Süren dersteki son kaydı geri alır. Yanlış öğrenciye basmak ders sırasında
 * olağan bir hata; düzeltilemezse gerçek bir öğrencinin kaydı kalıcı olarak
 * yanlış kalır. Kuralın sınırları `sonKaydiGeriAl` içinde.
 */
export async function davranisGeriAl(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const kilit = await kilitliyseDur(onceki);
  if (kilit) return kilit;

  const ogrenciId = metin(formData.get("ogrenciId"));
  const dersId = metin(formData.get("dersId"));

  if (!ogrenciId || !dersId) return hata(onceki, "Kayıt bilgisi eksik.", {});

  try {
    const ogretmen = await getCurrentTeacher();
    await sonKaydiGeriAl(ogrenciId, dersId, ogretmen.behaviorTemplate, ogretmen.id);
  } catch (error) {
    if (error instanceof DavranisHatasi) return hata(onceki, error.message, {});
    return hata(onceki, "Geri alınamadı. Veritabanına ulaşılamıyor olabilir.", {});
  }

  const sinifId = metin(formData.get("sinifId"));
  if (sinifId) revalidatePath(`/sinif/${sinifId}`);
  revalidatePath("/");
  return basarili(onceki);
}

export async function performansNotuKaydet(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const ogrenciId = metin(formData.get("ogrenciId"));
  const ham = metin(formData.get("not"));
  const girilen = { not: ham };

  if (!ogrenciId) return hata(onceki, "Öğrenci bilgisi eksik.", girilen);
  if (!ham) return hata(onceki, "Not boş olamaz.", girilen);

  const deger = Number(ham);
  if (!Number.isInteger(deger)) {
    return hata(onceki, "Not tam sayı olmalı.", girilen);
  }
  if (deger < 0 || deger > 100) {
    return hata(onceki, "Not 0 ile 100 arasında olmalı.", girilen);
  }

  try {
    const ogretmen = await getCurrentTeacher();
    // Ogrenci, ogretmenin bir sinifina bagli olmali.
    const ogrenci = await prisma.student.findFirst({
      where: { id: ogrenciId, classroom: { teacherId: ogretmen.id } },
      select: { id: true },
    });
    if (!ogrenci) return hata(onceki, "Öğrenci bulunamadı.", girilen);

    await prisma.student.update({
      where: { id: ogrenciId },
      data: { performanceScore: deger },
    });
  } catch {
    return hata(onceki, "Not kaydedilemedi. Veritabanına ulaşılamıyor olabilir.", girilen);
  }

  revalidatePath(`/ogrenci/${ogrenciId}`);
  revalidatePath("/");
  return basarili(onceki);
}

export async function sablonDegistir(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const secim = metin(formData.get("sablon"));
  if (secim !== "SIMPLE" && secim !== "CARD") {
    return hata(onceki, "Geçersiz sistem seçimi.", {});
  }

  try {
    const ogretmen = await getCurrentTeacher();
    await prisma.teacher.update({
      where: { id: ogretmen.id },
      data: { behaviorTemplate: secim },
    });
  } catch {
    return hata(onceki, "Ayar kaydedilemedi. Veritabanına ulaşılamıyor olabilir.", {});
  }

  // Butun siniflarda dugmeler degistigi icin tum sayfalar tazelenir.
  revalidatePath("/", "layout");
  return basarili(onceki);
}

const SIFIRLAMA_ONAY_METNI = "SIFIRLA";

/**
 * Öğretmenin tüm sınıf/öğrenci/ders/davranış/ödev/sınav/veli mesajı verisini
 * siler. Geri alınamaz; hesap parolası ve yazılı bir teyit ister — tek bir
 * yanlış tıklamayla tetiklenmesin diye iki ayrı doğrulama.
 */
export async function hesapSifirla(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const parola = metin(formData.get("parola"));
  const onay = metin(formData.get("onay"));

  if (!parola) return hata(onceki, "Hesap parolanızı girin.", {});
  if (onay !== SIFIRLAMA_ONAY_METNI) {
    return hata(onceki, `Onaylamak için "${SIFIRLAMA_ONAY_METNI}" yazın.`, {});
  }

  try {
    const ogretmen = await getCurrentTeacher();
    if (!(await parolaDogru(parola, ogretmen.passwordHash))) {
      return hata(onceki, "Hesap parolası yanlış.", {});
    }
    await hesapVerisiniSifirla(ogretmen.id);
  } catch {
    return hata(onceki, "Sıfırlama tamamlanamadı. Veritabanına ulaşılamıyor olabilir.", {});
  }

  revalidatePath("/", "layout");
  redirect("/");
}

const CEZA_ISLEMLERI = ["BASLAT", "EKLE", "AZALT", "AYARLA", "BITIR"] as const;
type CezaIslemi = (typeof CEZA_ISLEMLERI)[number];

const EN_UZUN_CEZA_DAKIKA = 60;

export async function cezaGuncelle(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const kilit = await kilitliyseDur(onceki);
  if (kilit) return kilit;

  const cezaId = metin(formData.get("cezaId"));
  const islem = metin(formData.get("islem")) as CezaIslemi;
  const sinifId = metin(formData.get("sinifId"));
  const dakika = Number(metin(formData.get("dakika")) || "0");

  if (!cezaId) return hata(onceki, "Ceza bilgisi eksik.", {});
  if (!CEZA_ISLEMLERI.includes(islem)) return hata(onceki, "Geçersiz işlem.", {});

  // Sonuç istemciye döner. Süre işlemlerinde sayfa tazelenmez: tazelenirse
  // kronometre paneli her basışta kapanır ve öğretmen paneli tekrar açmak
  // zorunda kalır.
  let kalanSaniye = 0;
  let calisiyor = false;

  try {
    const ogretmen = await getCurrentTeacher();
    // Ceza, öğretmenin bir sınıfındaki öğrenciye ait olmalı.
    const ceza = await prisma.breakPenalty.findFirst({
      where: {
        id: cezaId,
        completedAt: null,
        student: { classroom: { teacherId: ogretmen.id } },
      },
    });
    if (!ceza) return hata(onceki, "Ceza bulunamadı.", {});

    if (islem === "BITIR") {
      await prisma.breakPenalty.update({
        where: { id: ceza.id },
        data: { completedAt: new Date() },
      });
    } else if (islem === "BASLAT") {
      if (!ceza.startedAt) {
        await prisma.breakPenalty.update({
          where: { id: ceza.id },
          data: { startedAt: new Date() },
        });
      }
    } else {
      if (!Number.isInteger(dakika) || dakika < 0 || dakika > EN_UZUN_CEZA_DAKIKA) {
        return hata(onceki, `Süre 0 ile ${EN_UZUN_CEZA_DAKIKA} dakika arasında olmalı.`, {});
      }

      // Süre ekleme/çıkarma çalışan kronometreyi de etkiler: kalan süre
      // "toplam - geçen" olduğu için toplamı değiştirmek yeter.
      let yeniSaniye: number;
      if (islem === "AYARLA") {
        const gecen = ceza.startedAt
          ? Math.floor((Date.now() - ceza.startedAt.getTime()) / 1000)
          : 0;
        yeniSaniye = gecen + dakika * 60;
      } else {
        const fark = (islem === "EKLE" ? 1 : -1) * dakika * 60;
        yeniSaniye = Math.max(ceza.seconds + fark, 0);
      }

      await prisma.breakPenalty.update({
        where: { id: ceza.id },
        data: { seconds: yeniSaniye },
      });
    }

    const guncel = await prisma.breakPenalty.findUnique({ where: { id: ceza.id } });
    if (guncel && !guncel.completedAt) {
      const gecen = guncel.startedAt
        ? Math.floor((Date.now() - guncel.startedAt.getTime()) / 1000)
        : 0;
      kalanSaniye = Math.max(guncel.seconds - gecen, 0);
      calisiyor = guncel.startedAt !== null;
    }
  } catch {
    return hata(onceki, "Ceza güncellenemedi. Veritabanına ulaşılamıyor olabilir.", {});
  }

  // Ceza bittiğinde rozet tamamen kalkmalı; bunun için sayfa tazelenir.
  if (islem === "BITIR" && sinifId) revalidatePath(`/sinif/${sinifId}`);

  return {
    hata: null,
    deneme: onceki.deneme + 1,
    degerler: { kalanSaniye: String(kalanSaniye), calisiyor: calisiyor ? "1" : "0" },
  };
}
