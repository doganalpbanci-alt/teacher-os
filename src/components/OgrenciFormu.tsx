"use client";

import { useActionState, useEffect, useState } from "react";
import { ogrenciEkle } from "@/app/actions";
import { BOS_FORM } from "@/lib/form-state";

export function OgrenciFormu({ sinifId }: { sinifId: string }) {
  const [durum, gonder, bekliyor] = useActionState(ogrenciEkle, BOS_FORM);
  const deger = durum.degerler;
  // Telefon girilmemişse izin sorusu bile anlamsız; yalnızca girilince
  // görünür. `<form key={durum.deneme}>` yalnızca formun İÇİNİ sıfırlar; bu
  // state dışarıda durduğu için kendiliğinden sıfırlanmaz — bir öğrenci
  // telefonuyla eklendikten sonra telefonsuz ikinci öğrenci eklenmeye
  // çalışılırsa checkbox hâlâ (ve `required` olarak) görünür kalır, tarayıcı
  // gönderimi sessizce engeller. Bu yüzden her yeni sonuçta ayrıca senkron edilir.
  const [telefonVar, setTelefonVar] = useState(Boolean(deger.veliTelefonu));

  useEffect(() => {
    setTelefonVar(Boolean(deger.veliTelefonu));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durum.deneme]);

  return (
    // key ve defaultValue icin bkz. SinifFormu.
    <form key={durum.deneme} className="form" action={gonder}>
      <input type="hidden" name="sinifId" value={sinifId} />
      <div className="ikili">
        <input
          name="ad"
          defaultValue={deger.ad ?? ""}
          aria-label="Ad"
          placeholder="Ad"
          maxLength={60}
          autoComplete="off"
        />
        <input
          name="soyad"
          defaultValue={deger.soyad ?? ""}
          aria-label="Soyad"
          placeholder="Soyad"
          maxLength={60}
          autoComplete="off"
        />
      </div>
      <div className="ikili">
        <input
          name="veliAdi"
          defaultValue={deger.veliAdi ?? ""}
          aria-label="Veli adı (isteğe bağlı)"
          placeholder="Veli adı (isteğe bağlı)"
          maxLength={60}
          autoComplete="off"
        />
        <input
          name="veliTelefonu"
          type="tel"
          defaultValue={deger.veliTelefonu ?? ""}
          onChange={(e) => setTelefonVar(e.target.value.trim().length > 0)}
          aria-label="Veli telefonu (isteğe bağlı)"
          placeholder="Veli telefonu (isteğe bağlı)"
          maxLength={30}
          autoComplete="off"
        />
      </div>
      {telefonVar && (
        <label className="onay-satiri">
          <input type="checkbox" name="veliOnayi" required />
          <span>Veliye ait bu iletişim bilgisini kaydetmek için iznim olduğunu onaylıyorum.</span>
        </label>
      )}
      <button type="submit" disabled={bekliyor}>
        {bekliyor ? "Ekleniyor…" : "Öğrenci ekle"}
      </button>
      {durum.hata && <p className="hata">{durum.hata}</p>}
    </form>
  );
}
