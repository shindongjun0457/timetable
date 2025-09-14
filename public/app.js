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

/** 컨테이너(그리드박스) 폭/높이에 맞춰 테이블 자동 스케일
 *  ⬅️ 확대도 허용(상한 제거) → 브라우저 키우면 계속 커짐 */
function fitScale() {
  const gridWrap = document.querySelector(".gridWrap");
  const scaleBox = document.getElementById("scaleBox");
  const table = document.getElementById("timetable");
  if (!gridWrap || !scaleBox || !table) return;

  // 우선 원래 크기로 되돌려 실제 크기 측정
  scaleBox.style.transform = "scale(1)";
  scaleBox.classList.remove("scaled");
  scaleBox.style.width = "";
  scaleBox.style.height = "";

  // 컨테이너 가용 영역
  const containerW = gridWrap.clientWidth;
  const containerH = gridWrap.clientHeight;

  // 테이블 자연 크기
  const tableW = table.scrollWidth;
  const tableH = table.scrollHeight;

  // 가로/세로 중 더 작은 쪽 기준으로 '꽉 차게'
  const scaleW = containerW / tableW;
  const scaleH = containerH / tableH;
  const scale = Math.min(scaleW, scaleH); // ⬅️ 1로 제한하지 않음(확대 허용)

  // 스케일 적용 및 크기 보정
  scaleBox.style.transform = `scale(${scale})`;
  if (Math.abs(scale - 1) > 0.001) {
    scaleBox.classList.add("scaled"); // sticky 비활성
  } else {
    scaleBox.classList.remove("scaled");
  }
  scaleBox.style.width  = `${tableW * scale}px`;
  scaleBox.style.height = `${tableH * scale}px`;
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
