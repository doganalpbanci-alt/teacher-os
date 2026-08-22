// Form durumu ayrı dosyada: "use server" dosyaları yalnızca async fonksiyon
// export edebilir, sabit veya tip export edemez.
export type FormState = {
  hata: string | null;
  // Her gönderimden sonra artar. Form bunu key olarak kullanır; böylece her
  // sonuçta yeniden kurulur ve aşağıdaki değerler alanlara uygulanır.
  deneme: number;
  // Hatalı gönderimde kullanıcının yazdıkları burada geri döner, başarılıda
  // boştur. Aksi halde tek bir eksik alan yüzünden doldurulan her şey silinir.
  degerler: Record<string, string>;
};

export const BOS_FORM: FormState = { hata: null, deneme: 0, degerler: {} };
