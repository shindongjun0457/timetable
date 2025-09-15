// scripts/fetch-timetable.mjs
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ⚙️ 설정
const SCHOOL_CODE = 46043;      // 오현중학교
const GRADES = [1, 2, 3];
const CLASSES_PER_GRADE = 7;
const PERIODS = 7;
const WEEKDAYS = ["월", "화", "수", "목", "금"]; // 월~금만

const argv = process.argv.slice(2);
const FORCE = argv.includes("--force");

function loadTimetableModule(force = false) {
  const modPath = require.resolve("comcigan-parser");
  if (force && require.cache[modPath]) {
    delete require.cache[modPath]; // 🔥 모듈 캐시 제거
    console.log("♻️  comcigan-parser module cache cleared (force mode)");
  }
  // CJS 반환값(클래스 생성자)
  const Timetable = require("comcigan-parser");
  return Timetable;
}

function buildColumns() {
  const columns = [];
  for (const g of GRADES) for (let c = 1; c <= CLASSES_PER_GRADE; c++) columns.push(`${g}-${c}`);
  return columns;
}

function ensureTableShape() {
  // table[weekday][period][column] -> 과목 문자열
  return Array.from({ length: WEEKDAYS.length }, () =>
    Array.from({ length: PERIODS }, () => [])
  );
}

function subjectFromDayArray(dayArray, periodIdx1based) {
  const hit = (dayArray || []).find((x) => Number(x?.classTime) === periodIdx1based);
  return hit?.subject ?? "";
}

function nowKSTString() {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const HH = String(d.getUTCHours()).padStart(2, "0");
  const MM = String(d.getUTCMinutes()).padStart(2, "0");
  const SS = String(d.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${HH}:${MM}:${SS}`;
}

async function fetchAllTimetable(force = false) {
  const Timetable = loadTimetableModule(force);   // 🚀 재로딩 가능
  let tt = new Timetable();                       // ♻️ 새 인스턴스 생성
  await tt.init({ cache: 0 });                    // 내부 캐시 완전 비활성
  await tt.setSchool(SCHOOL_CODE);
  const all = await tt.getTimetable();
  return all;
}

async function main() {
  console.log(`Start fetch timetable (force=${FORCE})`);
  const all = await fetchAllTimetable(FORCE);

  const columns = buildColumns();
  const table = ensureTableShape();

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

  const out = {
    meta: {
      schoolCode: SCHOOL_CODE,
      updatedAtKST: nowKSTString(),
      weekdays: WEEKDAYS,
      periods: Array.from({ length: PERIODS }, (_, i) => i + 1),
      columns
    },
    table
  };

  const dataDir = path.join(__dirname, "..", "public", "data");
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(path.join(dataDir, "timetable.json"), JSON.stringify(out, null, 2), "utf-8");
  console.log("✅ timetable.json 갱신 완료 (force:", FORCE, ")");
}

main().catch((e) => {
  console.error("❌ fetch-timetable 실패:", e);
  process.exit(1);
});
