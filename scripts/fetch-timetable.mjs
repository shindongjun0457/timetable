// scripts/fetch-timetable.mjs
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import dayjs from "dayjs";
import "dayjs/locale/ko.js";

const require = createRequire(import.meta.url);
// CJS 모듈 로드
const Timetable = require("comcigan-parser");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ⚙️ 설정
const SCHOOL_CODE = 46043;      // 오현중학교
const GRADES = [1, 2, 3];
const CLASSES_PER_GRADE = 7;
const PERIODS = 7;
const WEEKDAYS = ["월", "화", "수", "목", "금"]; // 월~금만

function ensureTableShape() {
  // table[weekday][period][column] -> 과목 문자열
  return Array.from({ length: WEEKDAYS.length }, () =>
    Array.from({ length: PERIODS }, () => [])
  );
}

function subjectFromDayArray(dayArray, periodIdx1based) {
  // comcigan-parser의 하루 데이터는 [{ classTime: 1.., subject, teacher, ... }, ...] 형태
  const hit = (dayArray || []).find((x) => Number(x?.classTime) === periodIdx1based);
  return hit?.subject ?? "";
}

async function main() {
  dayjs.locale("ko");

  const timetable = new Timetable();
  await timetable.init({ cache: 1000 * 60 * 30 }); // 30분 캐시(선택)
  await timetable.setSchool(SCHOOL_CODE);

  // 전교 시간표  [grade][class][weekday][{classTime, subject, teacher...}]
  const all = await timetable.getTimetable();

  // 출력 컬럼 라벨 생성: ['1-1','1-2',...,'3-7']
  const columns = [];
  for (const g of GRADES) for (let c = 1; c <= CLASSES_PER_GRADE; c++) columns.push(`${g}-${c}`);

  // 결과 테이블 생성
  const table = ensureTableShape();

  // 각 반을 column 인덱스로 펼치기
  let col = 0;
  for (const g of GRADES) {
    for (let c = 1; c <= CLASSES_PER_GRADE; c++) {
      for (let w = 0; w < WEEKDAYS.length; w++) {
        const dayArray = all?.[g]?.[c]?.[w] || [];
        for (let p = 1; p <= PERIODS; p++) {
          const subj = subjectFromDayArray(dayArray, p);
          table[w][p - 1][col] = subj;
        }
      }
      col++;
    }
  }

  // JSON 저장
  const out = {
    meta: {
      schoolCode: SCHOOL_CODE,
      updatedAtKST: dayjs().format("YYYY-MM-DD HH:mm:ss"),
      weekdays: WEEKDAYS,
      periods: Array.from({ length: PERIODS }, (_, i) => i + 1),
      columns
    },
    table
  };

  const dataDir = path.join(__dirname, "..", "public", "data");
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(path.join(dataDir, "timetable.json"), JSON.stringify(out, null, 2), "utf-8");
  console.log("✅ timetable.json 갱신 완료");
}

main().catch((e) => {
  console.error("❌ fetch-timetable 실패:", e);
  process.exit(1);
});
