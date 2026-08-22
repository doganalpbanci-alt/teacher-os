import { prisma } from "@/lib/prisma";

// Bu sayfa her istekte veritabanina gider. force-dynamic olmazsa Next.js
// sayfayi build sirasinda onceden uretmeye calisir; Vercel build ortaminda
// veritabani erisimi olmadigi icin build hata verir.
export const dynamic = "force-dynamic";

type Result =
  | { ok: true; count: number }
  | { ok: false; message: string };

async function checkDatabase(): Promise<Result> {
  try {
    return { ok: true, count: await prisma.teacher.count() };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export default async function Home() {
  const result = await checkDatabase();

  return (
    <main
      style={{
        maxWidth: "34rem",
        padding: "2rem",
        margin: "1rem",
        background: "#ffffff",
        border: "1px solid #e2e5ea",
        borderRadius: "0.75rem",
      }}
    >
      <h1 style={{ margin: "0 0 1rem", fontSize: "1.25rem" }}>Teacher OS</h1>

      {result.ok ? (
        <p style={{ margin: 0, color: "#136c3a" }}>
          Veritabani baglantisi calisiyor — {result.count} ogretmen kaydi var.
        </p>
      ) : (
        <>
          <p style={{ margin: "0 0 0.75rem", color: "#a11212" }}>
            Veritabanina baglanilamadi.
          </p>
          <pre
            style={{
              margin: 0,
              padding: "0.75rem",
              background: "#f6f7f9",
              border: "1px solid #e2e5ea",
              borderRadius: "0.5rem",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontSize: "0.8125rem",
            }}
          >
            {result.message}
          </pre>
        </>
      )}
    </main>
  );
}
