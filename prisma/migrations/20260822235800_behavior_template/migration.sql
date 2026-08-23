-- CreateEnum
CREATE TYPE "BehaviorTemplate" AS ENUM ('SIMPLE', 'CARD');

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "behaviorTemplate" "BehaviorTemplate" NOT NULL DEFAULT 'SIMPLE';

-- Puan kisiti gevsetiliyor. Onceki kisit PLUS icin puani tam olarak 1,
-- MINUS icin tam olarak -5 olmaya zorluyordu; bu kart sablonunun kuralidir.
-- Basit sablonda kayitlar performans notunu kendiliginden degistirmez, yani
-- puan 0 olarak yazilir. Yeni kisit isaret dogrulugunu korur: arti kayitlar
-- puani dusuremez, eksi kayitlar yukseltemez.
ALTER TABLE "BehaviorLog" DROP CONSTRAINT IF EXISTS "BehaviorLog_points_matches_type";

ALTER TABLE "BehaviorLog" ADD CONSTRAINT "BehaviorLog_points_matches_type" CHECK (
  ("type" = 'PLUS'         AND "points" >= 0) OR
  ("type" = 'MINUS'        AND "points" <= 0) OR
  ("type" = 'YELLOW_CARD'  AND "points" =  0) OR
  ("type" = 'RED_CARD'     AND "points" <= 0)
);
