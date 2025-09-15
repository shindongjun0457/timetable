// public/app.js
const WEEKDAYS = ["월","화","수","목","금"];
const AUTO_REFRESH_MS = 30 * 60 * 1000; // 30분

async function refreshDataAndRender() {
  try {
    await loadData();
    buildTable();
    requestAnimationFrame(fitScale);
  } catch (e) {
    console.error("자동 갱신 실패:", e);
  }
}


// 고정 칼럼 너비(px): 첫 칼럼(교시) + 각 반 칼럼
const LEFT_COL_W = 92;
const COL_W = 100;        // '세 글자 기준' 폭

const $ = (sel) => document.querySelector(sel);

const state = {
  data: null,          // JSON 전체
  dayIndex: 0          // 0=월 ~ 4=금
};

function getKSTDayIndex() {
  const utc = new Date();
  const kst = new Date(utc.getTime() + (9 * 60 * 60 * 1000));
  const d = kst.getUTCDay(); // 0=일,1=월,...6=토
  if (d >= 1 && d <= 5) return d - 1;
  return 0;
}

function buildColGroup(tbl, columnsCount){
  const colgroup = document.createElement("colgroup");

  // 좌측(교시) 칼럼
  const col0 = document.createElement("col");
  col0.style.width = `${LEFT_COL_W}px`;
  colgroup.appendChild(col0);

  // 반 칼럼들(동일 폭 + 학년 클래스 표기)
  for(let i=0;i<columnsCount;i++){
    const col = document.createElement("col");
    col.style.width = `${COL_W}px`;
    colgroup.appendChild(col);
  }
  tbl.appendChild(colgroup);
}

function buildTable() {
  const tbl = $("#timetable");
  tbl.innerHTML = "";

  if (!state.data) return;
  const { meta, table } = state.data;
  const { columns } = meta;
  const w = state.dayIndex;

  // 고정폭 colgroup
  buildColGroup(tbl, columns.length);

  const thead = document.createElement("thead");

  // 1행: 좌상단(요일) + 학년 밴드(1학년/2학년/3학년)
  const headRow1 = document.createElement("tr");

  const corner = document.createElement("th");
  corner.className = "sticky-top sticky-left left-col";
  corner.textContent = `${WEEKDAYS[w]}요일`;
  headRow1.appendChild(corner);

  // 7칸씩 3그룹 = 21
  const bands = [
    { label:"1학년", cls:"band-1", span:7 },
    { label:"2학년", cls:"band-2", span:7 },
    { label:"3학년", cls:"band-3", span:7 },
  ];
  bands.forEach(({label, cls, span})=>{
    const th = document.createElement("th");
    th.className = `grade-band ${cls} sticky-top`;
    th.colSpan = span;
    th.textContent = label;
    headRow1.appendChild(th);
  });

  // 2행: "교시" 라벨 + 반 번호 헤더
  const headRow2 = document.createElement("tr");
  const leftLabel = document.createElement("th");
  leftLabel.className = "sticky-left sticky-top left-col";
  leftLabel.textContent = "교시";
  headRow2.appendChild(leftLabel);

  columns.forEach((label, idx) => {
    const gradeIdx = Math.floor(idx / 7) + 1; // 1~3
    const th = document.createElement("th");
    th.className = `sticky-top colhead grade-${gradeIdx}`;
    th.textContent = label;  // 예: 1-1
    headRow2.appendChild(th);
  });

  thead.appendChild(headRow1);
  thead.appendChild(headRow2);
  tbl.appendChild(thead);

  // 본문: 각 교시 행
  const tbody = document.createElement("tbody");
  const rows = table[w]; // [period][col]

  rows.forEach((cols, idx) => {
    const tr = document.createElement("tr");

    const th = document.createElement("th");
    th.className = "sticky-left left-col";
    th.textContent = `${idx+1}교시`; // 시간 제거, 교시만
    tr.appendChild(th);

    cols.forEach((text, colIdx) => {
      const td = document.createElement("td");
      const gradeIdx = Math.floor(colIdx / 7) + 1; // 1~3
      td.classList.add(`grade-${gradeIdx}`);
      const div = document.createElement("div");
      div.className = "cell";
      div.textContent = text || "";
      td.appendChild(div);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  tbl.appendChild(tbody);

  // meta
  $("#metaText").textContent = `© OHYUN Middle School · 업데이트: ${meta.updatedAtKST}`;
}

function fitScale() {
  const gridWrap = document.querySelector(".gridWrap");
  const scaleBox = document.getElementById("scaleBox");
  const table = document.getElementById("timetable");
  if (!gridWrap || !scaleBox || !table) return;

  // 0) 초기화: 실크기 측정
  scaleBox.style.transform = "scale(1)";
  scaleBox.classList.remove("scaled");
  scaleBox.style.width = "";
  scaleBox.style.height = "";

  const containerW = gridWrap.clientWidth;
  const containerH = gridWrap.clientHeight;

  // 1) 가로 기준 스케일(폭을 꽉 채움)
  const tableW0 = table.scrollWidth;
  const scale = containerW / tableW0;        // 확대/축소 모두 허용

  // 2) 세로 맞춤: 스케일된 총 높이가 컨테이너에 맞도록 1행 min-height 계산
  //    목표: (thead높이 + 행수*행높이) * scale ≈ containerH
  const thead = table.tHead;
  const tbody = table.tBodies[0];
  const headH0 = thead ? thead.offsetHeight : 0;       // 스케일 전 헤더 높이
  const rows = tbody ? tbody.rows.length : 0;          // 보통 7교시 = 7

  // 스케일 전 기준에서 목표 테이블 높이
  const targetTableH0 = containerH / scale;

  // 헤더외 여유(테두리 등 보정치)
  const fudge = 8;

  // 1행 최소 높이(px) 계산 + 안전 범위로 clamp
  let rowMin0 = (targetTableH0 - headH0 - fudge) / Math.max(rows, 1);
  const CLAMP_MIN = 40;   // 너무 쪼개지지 않게 최소
  const CLAMP_MAX = 140;  // 너무 길어지지 않게 최대 (원하면 취향대로 조정)
  rowMin0 = Math.max(CLAMP_MIN, Math.min(CLAMP_MAX, Math.floor(rowMin0)));

  // CSS 변수 주입 (스케일 전 기준값)
  document.documentElement.style.setProperty("--row-min-h", `${rowMin0}px`);

  // 3) 최종 치수 재측정 후 스케일 적용
  const tableW = table.scrollWidth;
  const tableH = table.scrollHeight;

  scaleBox.style.transform = `scale(${scale})`;
  scaleBox.classList.toggle("scaled", Math.abs(scale - 1) > 0.001);
  scaleBox.style.width  = `${tableW * scale}px`;
  scaleBox.style.height = `${tableH * scale}px`;

  // 세로 넘치면 내부 스크롤 표시(옵션)
  gridWrap.classList.toggle("canScrollY", tableH * scale > containerH);
}


async function loadData() {
  const res = await fetch("./data/timetable.json", { cache: "no-store" });
  if (!res.ok) throw new Error("timetable.json 로드 실패");
  state.data = await res.json();
}

async function init() {
  state.dayIndex = getKSTDayIndex();
  $("#weekdaySelect").value = String(state.dayIndex);

  $("#weekdaySelect").addEventListener("change", (e) => {
    state.dayIndex = Number(e.target.value);
    buildTable();
    requestAnimationFrame(fitScale); // 렌더 후 스케일
  });

  try {
    await loadData();
    buildTable();
    requestAnimationFrame(fitScale);
    window.addEventListener("resize", fitScale);
     // 🔁 30분마다 timetable.json 재로딩
    setInterval(refreshDataAndRender, AUTO_REFRESH_MS);
  } catch (err) {
    console.error(err);
    $("#metaText").textContent = "시간표 데이터를 불러올 수 없습니다.";
  }

    // 🔘 수동 새로고침 버튼
  const refreshBtn = document.getElementById("refreshBtn");
  if (refreshBtn) {
    const handleManualRefresh = async () => {
      try {
        refreshBtn.setAttribute("aria-busy", "true");
        refreshBtn.disabled = true;
        await refreshDataAndRender();
      } finally {
        // 살짝 지연 후 버튼 원상복구(스피너 한 바퀴 보여주기)
        setTimeout(() => {
          refreshBtn.removeAttribute("aria-busy");
          refreshBtn.disabled = false;
        }, 200);
      }
    };
    refreshBtn.addEventListener("click", handleManualRefresh);
  }

}

init();
