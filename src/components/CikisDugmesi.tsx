import { cikisYap } from "@/app/oturum-actions";

export function CikisDugmesi() {
  return (
    <form action={cikisYap}>
      <button className="cikis" type="submit">
        Çıkış
      </button>
    </form>
  );
}
