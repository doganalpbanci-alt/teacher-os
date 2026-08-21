-- Teacher OS - init migration
-- Supabase Dashboard > SQL Editor'a yapistirip calistirin.
-- Bu dosya prisma/migrations/20260821214524_init/migration.sql icerigini uygular ve
-- Prisma'nin migration kaydini olusturur, boylece 'prisma migrate' bu
-- migration'i uygulanmis kabul eder ve tekrar calistirmaz.

BEGIN;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "BehaviorType" AS ENUM ('PLUS', 'MINUS', 'YELLOW_CARD', 'RED_CARD');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'DONE', 'MISSING', 'LATE');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('DRAFT', 'SENT');

-- CreateTable
CREATE TABLE "Teacher" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Classroom" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Classroom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "parentName" TEXT,
    "parentPhone" TEXT,
    "performanceScore" INTEGER NOT NULL DEFAULT 90,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BehaviorLog" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "type" "BehaviorType" NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BehaviorLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "examDate" TIMESTAMP(3) NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamResult" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentMessage" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_email_key" ON "Teacher"("email");

-- CreateIndex
CREATE INDEX "Classroom_teacherId_idx" ON "Classroom"("teacherId");

-- CreateIndex
CREATE INDEX "Student_classroomId_idx" ON "Student"("classroomId");

-- CreateIndex
CREATE INDEX "Lesson_classroomId_date_idx" ON "Lesson"("classroomId", "date");

-- CreateIndex
CREATE INDEX "BehaviorLog_studentId_createdAt_idx" ON "BehaviorLog"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "BehaviorLog_lessonId_studentId_idx" ON "BehaviorLog"("lessonId", "studentId");

-- CreateIndex
CREATE INDEX "BehaviorLog_classroomId_createdAt_idx" ON "BehaviorLog"("classroomId", "createdAt");

-- CreateIndex
CREATE INDEX "BehaviorLog_teacherId_idx" ON "BehaviorLog"("teacherId");

-- CreateIndex
CREATE INDEX "Assignment_classroomId_idx" ON "Assignment"("classroomId");

-- CreateIndex
CREATE INDEX "Submission_studentId_idx" ON "Submission"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_assignmentId_studentId_key" ON "Submission"("assignmentId", "studentId");

-- CreateIndex
CREATE INDEX "Exam_classroomId_idx" ON "Exam"("classroomId");

-- CreateIndex
CREATE INDEX "ExamResult_studentId_idx" ON "ExamResult"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamResult_examId_studentId_key" ON "ExamResult"("examId", "studentId");

-- CreateIndex
CREATE INDEX "ParentMessage_studentId_createdAt_idx" ON "ParentMessage"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "ParentMessage_teacherId_idx" ON "ParentMessage"("teacherId");

-- AddForeignKey
ALTER TABLE "Classroom" ADD CONSTRAINT "Classroom_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviorLog" ADD CONSTRAINT "BehaviorLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviorLog" ADD CONSTRAINT "BehaviorLog_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviorLog" ADD CONSTRAINT "BehaviorLog_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviorLog" ADD CONSTRAINT "BehaviorLog_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamResult" ADD CONSTRAINT "ExamResult_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamResult" ADD CONSTRAINT "ExamResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentMessage" ADD CONSTRAINT "ParentMessage_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentMessage" ADD CONSTRAINT "ParentMessage_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------- Prisma migration kaydi ----------
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                  VARCHAR(36) PRIMARY KEY NOT NULL,
    "checksum"            VARCHAR(64) NOT NULL,
    "finished_at"         TIMESTAMPTZ,
    "migration_name"      VARCHAR(255) NOT NULL,
    "logs"                TEXT,
    "rolled_back_at"      TIMESTAMPTZ,
    "started_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);

INSERT INTO "_prisma_migrations"
  ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
SELECT gen_random_uuid()::text, 'a47f4ba3092679ef4c671f9542a8dd076ee7f407cde95e65ace9b2bb91cafdc1', now(), '20260821214524_init', NULL, NULL, now(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = '20260821214524_init'
);

COMMIT;
