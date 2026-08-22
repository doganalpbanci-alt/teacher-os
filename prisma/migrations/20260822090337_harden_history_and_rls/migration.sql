-- DropForeignKey
ALTER TABLE "ExamResult" DROP CONSTRAINT "ExamResult_examId_fkey";

-- DropForeignKey
ALTER TABLE "ExamResult" DROP CONSTRAINT "ExamResult_studentId_fkey";

-- DropForeignKey
ALTER TABLE "ParentMessage" DROP CONSTRAINT "ParentMessage_studentId_fkey";

-- DropForeignKey
ALTER TABLE "ParentMessage" DROP CONSTRAINT "ParentMessage_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "Submission" DROP CONSTRAINT "Submission_assignmentId_fkey";

-- DropForeignKey
ALTER TABLE "Submission" DROP CONSTRAINT "Submission_studentId_fkey";

-- AlterTable
ALTER TABLE "Classroom" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_classroomId_date_key" ON "Lesson"("classroomId", "date");

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamResult" ADD CONSTRAINT "ExamResult_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamResult" ADD CONSTRAINT "ExamResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentMessage" ADD CONSTRAINT "ParentMessage_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentMessage" ADD CONSTRAINT "ParentMessage_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma semasinin ifade edemedigi kisitlar.

-- Davranis tipi ile puan tutarliligi. Degerler CLAUDE.md'de tanimli:
-- PLUS = +1, MINUS = -5, YELLOW_CARD uyaridir (puan yok).
-- RED_CARD'in puani is kuralina birakildi; yalnizca pozitif olmamasi zorunlu.
ALTER TABLE "BehaviorLog" ADD CONSTRAINT "BehaviorLog_points_matches_type" CHECK (
  ("type" = 'PLUS'         AND "points" = 1)  OR
  ("type" = 'MINUS'        AND "points" = -5) OR
  ("type" = 'YELLOW_CARD'  AND "points" = 0)  OR
  ("type" = 'RED_CARD'     AND "points" <= 0)
);

-- Row Level Security. Supabase her tabloyu anon/authenticated anahtarlarla
-- erisilebilen bir REST API'den yayinlar; politika tanimlanmadigi surece
-- RLS bu erisimi tamamen kapatir. Prisma tablo sahibi rolle baglandigi
-- icin bundan etkilenmez.
ALTER TABLE "Teacher"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Classroom"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Student"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lesson"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BehaviorLog"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Assignment"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Submission"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Exam"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExamResult"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ParentMessage" ENABLE ROW LEVEL SECURITY;
