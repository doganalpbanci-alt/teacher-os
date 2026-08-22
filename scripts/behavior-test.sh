#!/bin/bash
# Migration sonrasi davranis testi. Her vaka gercek SQL ile denenir.
export PATH=/usr/lib/postgresql/16/bin:$PATH
PSQL="psql -h 127.0.0.1 -p 15999 -U postgres -d btest -q -v ON_ERROR_STOP=1"
PASS=0; FAIL=0

ok() {   # basarili olmasi beklenen
  if out=$($PSQL -c "$2" 2>&1); then printf "  ✔ %s\n" "$1"; PASS=$((PASS+1))
  else printf "  �’ %s\n     BEKLENEN: gecsin | OLAN: %s\n" "$1" "$(echo "$out"|grep -oiE 'ERROR:.*'|head -1)"; FAIL=$((FAIL+1)); fi
}
no() {   # engellenmesi beklenen
  if out=$($PSQL -c "$2" 2>&1); then printf "  ✗ %s\n     BEKLENEN: engellensin | OLAN: gecti!\n" "$1"; FAIL=$((FAIL+1))
  else printf "  ✔ %s  [%s]\n" "$1" "$(echo "$out"|grep -oiE 'violates (foreign key|check) constraint "[^"]+"|duplicate key value violates unique constraint "[^"]+"'|head -1|cut -c1-70)"; PASS=$((PASS+1)); fi
}
seed() {
$PSQL -c "TRUNCATE \"BehaviorLog\",\"Submission\",\"ExamResult\",\"ParentMessage\",\"Lesson\",\"Assignment\",\"Exam\",\"Student\",\"Classroom\",\"Teacher\" CASCADE;
INSERT INTO \"Teacher\"(id,email,name,\"passwordHash\") VALUES ('t1','ogretmen@okul.com','Ayse Ogretmen','hash');
INSERT INTO \"Classroom\"(id,\"teacherId\",name) VALUES ('c1','t1','9-A'),('c2','t1','9-B');
INSERT INTO \"Student\"(id,\"classroomId\",\"firstName\",\"lastName\",\"parentPhone\") VALUES ('s1','c1','Ali','Yilmaz','555'),('s2','c1','Ayse','Kaya','556');
INSERT INTO \"Lesson\"(id,\"classroomId\",date) VALUES ('l1','c1','2026-03-02'),('l2','c1','2026-03-03');
INSERT INTO \"Assignment\"(id,\"classroomId\",title) VALUES ('a1','c1','Unit 3 Odev'),('a2','c1','Bos Odev');
INSERT INTO \"Exam\"(id,\"classroomId\",title,\"examDate\") VALUES ('e1','c1','Vize',now()),('e2','c1','Bos Sinav',now());
INSERT INTO \"Submission\"(id,\"assignmentId\",\"studentId\",status,\"updatedAt\") VALUES ('sb1','a1','s1','DONE',now());
INSERT INTO \"ExamResult\"(id,\"examId\",\"studentId\",score) VALUES ('er1','e1','s1',85);
INSERT INTO \"ParentMessage\"(id,\"studentId\",\"teacherId\",body) VALUES ('pm1','s1','t1','Merhaba');
INSERT INTO \"BehaviorLog\"(id,\"studentId\",\"teacherId\",\"classroomId\",\"lessonId\",type,points) VALUES ('bl1','s1','t1','c1','l1','MINUS',-5);" >/dev/null
}

echo "════ A. GECMIS KORUMASI: gecmisi olan kayit silinemez ════"
seed
no "Davranis kaydi olan ogrenci silinemez"      "DELETE FROM \"Student\" WHERE id='s1';"
no "Odev teslimi olan odev silinemez"           "DELETE FROM \"Assignment\" WHERE id='a1';"
no "Sonucu olan sinav silinemez"                "DELETE FROM \"Exam\" WHERE id='e1';"
no "Davranis kaydi olan ders silinemez"         "DELETE FROM \"Lesson\" WHERE id='l1';"
no "Veri iceren sinif silinemez"                "DELETE FROM \"Classroom\" WHERE id='c1';"
no "Kaydi olan ogretmen silinemez"              "DELETE FROM \"Teacher\" WHERE id='t1';"

echo "════ B. TEMIZLIGE IZIN: gecmisi olmayan kayit silinebilir ════"
seed
ok "Teslimi olmayan odev silinebilir"           "DELETE FROM \"Assignment\" WHERE id='a2';"
ok "Sonucu olmayan sinav silinebilir"           "DELETE FROM \"Exam\" WHERE id='e2';"
ok "Davranis kaydi olmayan ders silinebilir"    "DELETE FROM \"Lesson\" WHERE id='l2';"
ok "Bos sinif silinebilir"                      "DELETE FROM \"Classroom\" WHERE id='c2';"

echo "════ C. ARSIVLEME: silinemeyen kayit gizlenebilir ════"
seed
ok "Sinif arsivlenebilir (isActive=false)"      "UPDATE \"Classroom\" SET \"isActive\"=false WHERE id='c1';"
ok "Ogrenci arsivlenebilir"                     "UPDATE \"Student\" SET \"isActive\"=false WHERE id='s1';"

echo "════ D. DERS TEKRARI ════"
seed
no "Ayni sinifa ayni gun ikinci ders acilamaz"  "INSERT INTO \"Lesson\"(id,\"classroomId\",date) VALUES ('lx','c1','2026-03-02');"
ok "Farkli gune ders acilabilir"                "INSERT INTO \"Lesson\"(id,\"classroomId\",date) VALUES ('ly','c1','2026-03-10');"
ok "Baska sinifa ayni gun ders acilabilir"      "INSERT INTO \"Lesson\"(id,\"classroomId\",date) VALUES ('lz','c2','2026-03-02');"

echo "════ E. PUAN TUTARLILIGI ════"
seed
B="INSERT INTO \"BehaviorLog\"(id,\"studentId\",\"teacherId\",\"classroomId\",\"lessonId\",type,points) VALUES"
ok "PLUS = +1 kabul"          "$B ('p1','s1','t1','c1','l1','PLUS',1);"
no "PLUS = +5 reddedilir"     "$B ('p2','s1','t1','c1','l1','PLUS',5);"
ok "MINUS = -5 kabul"         "$B ('m1','s1','t1','c1','l1','MINUS',-5);"
no "MINUS = 9999 reddedilir"  "$B ('m2','s1','t1','c1','l1','MINUS',9999);"
no "MINUS = -3 reddedilir"    "$B ('m3','s1','t1','c1','l1','MINUS',-3);"
ok "YELLOW_CARD = 0 kabul"    "$B ('y1','s1','t1','c1','l1','YELLOW_CARD',0);"
no "YELLOW_CARD = -5 red"     "$B ('y2','s1','t1','c1','l1','YELLOW_CARD',-5);"
ok "RED_CARD = -5 kabul"      "$B ('r1','s1','t1','c1','l1','RED_CARD',-5);"
no "RED_CARD = +3 reddedilir" "$B ('r2','s1','t1','c1','l1','RED_CARD',3);"

echo "════ F. RLS: dis API erisimi kapali mi ════"
$PSQL -c "DROP ROLE IF EXISTS anonlike;" >/dev/null 2>&1
$PSQL -c "CREATE ROLE anonlike LOGIN; GRANT USAGE ON SCHEMA public TO anonlike; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO anonlike;" >/dev/null
seed
A="psql -h 127.0.0.1 -p 15999 -U anonlike -d btest -tAc"
for T in Teacher Student ParentMessage BehaviorLog; do
  n=$($A "SELECT count(*) FROM \"$T\";" 2>&1 | tr -d ' ')
  if [ "$n" = "0" ]; then echo "  ✔ anon rolu $T tablosunda 0 satir goruyor"; PASS=$((PASS+1))
  else echo "  ✗ anon rolu $T tablosunda $n satir gordu!"; FAIL=$((FAIL+1)); fi
done
if $A "INSERT INTO \"Teacher\"(id,email,name,\"passwordHash\") VALUES ('x','x@x.com','X','h');" >/dev/null 2>&1
then echo "  ✗ anon rolu yazma yapabildi!"; FAIL=$((FAIL+1)); else echo "  ✔ anon rolu yazma yapamiyor"; PASS=$((PASS+1)); fi
n=$($PSQL -tAc "SELECT count(*) FROM \"Teacher\";" 2>/dev/null | tr -d ' ')
if [ "$n" = "1" ]; then echo "  ✔ sahip rolu (Prisma) verisini normal goruyor"; PASS=$((PASS+1))
else echo "  ✗ sahip rolu veriyi goremedi ($n)"; FAIL=$((FAIL+1)); fi

echo
echo "════ SONUC: $PASS gecti, $FAIL kaldi ════"
[ "$FAIL" -eq 0 ]
