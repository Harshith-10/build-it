// Generates a fully standalone interactive HTML results dashboard based on the provided exam data.

export interface DashboardStudent {
  slot: number;
  branchCode: string;
  branch: string;
  roll: string;
  name: string;
  status: string;
  score: number;
  time: number;
  mpReal: number;
  mpSerious: number;
  mpPlatform: number;
  terminated: boolean;
  tier: number; // 1: Scored (> 0), 2: Zero (= 0)
  badge: string;
  solvedPartial: number;
  solvedFull: number;
  numQuestions: number;
  rankInSlot?: number;
  rankInSlotBranch?: number;
  rankInBranchCombined?: number;
}

export function generateResultsDashboardHtml({
  examTitle,
  students,
  branchOrder,
  headerImg = "",
}: {
  examTitle: string;
  students: DashboardStudent[];
  branchOrder: string[];
  headerImg?: string;
}): string {
  const safeExamTitle = examTitle.trim() || "Exam";
  const maxScore = Math.max(...students.map((s) => s.score || 0), 100);
  const dataJson = JSON.stringify({
    students,
    branchOrder,
    examTitle: safeExamTitle,
    maxScore,
    headerImg: headerImg || "",
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeExamTitle} — Results Dashboard</title>
<style>
:root{
  --bg:#EEF1F6;
  --surface:#FFFFFF;
  --border:#DDE3EC;
  --ink:#182231;
  --ink-muted:#5B6472;
  --sidebar:#10192B;
  --sidebar-text:#AEB9CC;
  --sidebar-text-active:#FFFFFF;
  --gold:#D9A73B;
  --gold-soft:#F3E1B5;
  --green:#2F8F72;
  --green-soft:#D9EEE6;
  --red:#C1473E;
  --red-soft:#F6DEDC;
  --blue:#3E6FA8;
  --blue-soft:#DCE7F3;
  --purple:#7C3AED;
  --purple-soft:#EDE9FE;
  --indigo:#4F46E5;
  --indigo-soft:#E0E7FF;
  --radius:10px;
}
*{box-sizing:border-box;}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:var(--bg);color:var(--ink);}
h1,h2,h3,.num,.kpi-value,.rank-cell,.brand-title{font-family:Georgia,'Iowan Old Style','Palatino Linotype',serif;}
.app{display:flex;min-height:100vh;}

/* Sidebar */
.sidebar{width:250px;flex-shrink:0;background:var(--sidebar);color:var(--sidebar-text);
  display:flex;flex-direction:column;padding:28px 0;position:sticky;top:0;height:100vh;}
.brand{padding:0 24px 28px 24px;border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:20px;}
.brand-title{font-size:17px;font-weight:700;color:#fff;letter-spacing:0.2px;line-height:1.2;}
.brand-sub{font-size:12px;color:var(--gold);margin-top:6px;font-weight:500;}
.nav-item{display:flex;align-items:center;gap:10px;padding:12px 24px;font-size:14px;font-weight:500;
  cursor:pointer;color:var(--sidebar-text);border-left:3px solid transparent;transition:background .15s;}
.nav-item:hover{background:rgba(255,255,255,0.04);}
.nav-item.active{color:var(--sidebar-text-active);border-left-color:var(--gold);background:rgba(217,167,59,0.08);}
.nav-dot{width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.7;}
.sidebar-foot{margin-top:auto;padding:16px 24px 0 24px;font-size:11px;color:#5C6780;line-height:1.5;
  border-top:1px solid rgba(255,255,255,0.08);padding-top:16px;}

/* Main */
.main{flex:1;padding:32px 40px 60px 40px;max-width:1400px;}
.page{display:none;}
.page.active{display:block;}
.page-head{margin-bottom:24px;}
.page-head h1{font-size:26px;margin:0 0 6px 0;color:var(--ink);}
.page-head p{margin:0;color:var(--ink-muted);font-size:14px;}

/* KPI cards */
.kpi-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:24px;}
.kpi-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:18px 20px;}
.kpi-label{font-size:12.5px;color:var(--ink-muted);font-weight:500;margin-bottom:8px;}
.kpi-value{font-size:28px;font-weight:700;color:var(--ink);}
.kpi-value.gold{color:var(--gold);}
.kpi-value.green{color:var(--green);}
.kpi-value.red{color:var(--red);}
.kpi-value.blue{color:var(--blue);}
.kpi-value.purple{color:var(--purple);}

/* Cards / charts grid */
.grid{display:grid;gap:16px;margin-bottom:16px;}
.grid.cols-2{grid-template-columns:1fr 1fr;}
.grid.cols-3{grid-template-columns:1fr 1fr 1fr;}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;}
.card h3{font-size:15px;margin:0 0 4px 0;color:var(--ink);}
.card .card-sub{font-size:12.5px;color:var(--ink-muted);margin:0 0 14px 0;}
.card.span-2{grid-column:span 2;}
.chart-wrap{position:relative;height:280px;}
.chart-wrap.tall{height:340px;}
.chart-wrap.short{height:220px;}

/* Table */
table{width:100%;border-collapse:collapse;font-size:13px;}
th{text-align:left;padding:9px 10px;color:var(--ink-muted);font-weight:600;border-bottom:1px solid var(--border);font-size:12px;}
td{padding:9px 10px;border-bottom:1px solid #EEF1F6;}
tr:last-child td{border-bottom:none;}
.badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;}
.badge.tier1{background:var(--green-soft);color:var(--green);}
.badge.tier2{background:#EEF1F6;color:var(--ink-muted);}
.badge.tier3{background:var(--red-soft);color:var(--red);}

.badge.excellence{background:var(--purple-soft);color:var(--purple);border:1px solid #C4B5FD;}
.badge.elite{background:var(--indigo-soft);color:var(--indigo);border:1px solid #A5B4FC;}
.badge.gold{background:var(--gold-soft);color:#B45309;border:1px solid #FDE68A;}
.badge.silver{background:#F1F5F9;color:#475569;border:1px solid #CBD5E1;}

.rank-cell{font-weight:700;color:var(--ink-muted);}

/* Controls */
.control-row{display:flex;align-items:center;gap:16px;margin-bottom:20px;flex-wrap:wrap;}
select{font-size:14px;padding:9px 14px;border-radius:8px;border:1px solid var(--border);
  background:var(--surface);color:var(--ink);font-weight:500;cursor:pointer;}
.toggle-group{display:flex;background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden;}
.toggle-btn{padding:8px 14px;font-size:13px;font-weight:500;cursor:pointer;color:var(--ink-muted);background:transparent;border:none;}
.toggle-btn.active{background:var(--ink);color:#fff;}
.note{background:var(--gold-soft);border:1px solid #E8CE86;border-radius:8px;padding:12px 16px;font-size:13px;
  color:#6B531A;margin-bottom:20px;line-height:1.5;}
.note b{font-weight:700;}

/* Rankings page controls */
.rank-controls{display:flex;flex-wrap:wrap;align-items:center;gap:14px;margin-bottom:18px;}
.chip-group{display:flex;gap:6px;flex-wrap:wrap;}
.chip{padding:7px 13px;font-size:13px;font-weight:500;border-radius:20px;border:1px solid var(--border);
  background:var(--surface);color:var(--ink-muted);cursor:pointer;}
.chip.active{background:var(--ink);color:#fff;border-color:var(--ink);}
.num-input{width:80px;padding:8px 10px;border-radius:8px;border:1px solid var(--border);font-size:13px;}
.search-input{padding:8px 12px;border-radius:8px;border:1px solid var(--border);font-size:13px;width:220px;}
.rank-summary{font-size:13px;color:var(--ink-muted);margin-bottom:12px;}
.page-head-row{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;}
.export-btn{background:var(--gold);color:#fff;border:none;padding:10px 18px;border-radius:8px;font-size:13px;
  font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:7px;white-space:nowrap;flex-shrink:0;}
.export-btn:hover{background:#C4952E;}
.export-btn:active{transform:translateY(1px);}
.export-btn:disabled{opacity:.6;cursor:default;}
.export-btn svg{width:14px;height:14px;flex-shrink:0;}
.export-btn.small{padding:7px 13px;font-size:12px;}
.export-menu-wrap{position:relative;flex-shrink:0;}
.export-menu{display:none;position:absolute;top:calc(100% + 6px);right:0;background:var(--surface);
  border:1px solid var(--border);border-radius:8px;box-shadow:0 8px 24px rgba(16,25,43,0.14);
  min-width:190px;overflow:hidden;z-index:10;}
.export-menu.show{display:block;}
.export-menu-item{display:block;width:100%;text-align:left;padding:10px 14px;font-size:13px;font-weight:500;
  color:var(--ink);background:none;border:none;cursor:pointer;}
.export-menu-item:hover{background:var(--bg);}
.export-menu-item + .export-menu-item{border-top:1px solid var(--border);}
.table-scroll{max-height:640px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius);}
.table-scroll table{font-size:13px;}
.table-scroll thead th{position:sticky;top:0;background:var(--surface);z-index:2;box-shadow:0 1px 0 var(--border);}
.table-scroll tbody tr:nth-child(even){background:#FAFBFD;}
.branch-select-inline{display:none;}
.branch-select-inline.show{display:inline-block;}

@media (max-width:900px){
  .grid.cols-2, .grid.cols-3{grid-template-columns:1fr;}
  .card.span-2{grid-column:span 1;}
  .sidebar{width:76px;}
  .brand-title,.brand-sub,.nav-item span.label{display:none;}
  .main{padding:20px;}
}
</style>
<!-- Libraries -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"></script>
</head>
<body>
<div class="app">
  <div class="sidebar">
    <div class="brand">
      <div class="brand-title" id="sidebar-title">${safeExamTitle}</div>
      <div class="brand-sub">Results Dashboard</div>
    </div>
    <div class="nav-item active" data-page="overview"><span class="nav-dot"></span><span class="label">Overall Performance</span></div>
    <div class="nav-item" data-page="comparison"><span class="nav-dot"></span><span class="label">Branch Comparison</span></div>
    <div class="nav-item" data-page="deepdive"><span class="nav-dot"></span><span class="label">Branch Deep-Dive</span></div>
    <div class="nav-item" data-page="rankings"><span class="nav-dot"></span><span class="label">Rankings</span></div>
    <div class="sidebar-foot" id="sidebar-stats-foot">Ranked by Score, then Completion Time</div>
  </div>
  <div class="main">

    <!-- OVERVIEW PAGE -->
    <div class="page active" id="page-overview">
      <div class="page-head">
        <h1 id="overview-title">Overall Performance</h1>
        <p id="overview-subtitle">All branches combined.</p>
      </div>
      <div class="kpi-row" id="ov-kpis"></div>
      <div class="grid cols-2">
        <div class="card">
          <h3>Result Tiers</h3>
          <p class="card-sub">Scored attempts vs zero-score attempts</p>
          <div class="chart-wrap"><canvas id="chart-tier-donut"></canvas></div>
        </div>
        <div class="card">
          <h3>Attendance by Slot</h3>
          <p class="card-sub">Participation across sessions</p>
          <div class="chart-wrap"><canvas id="chart-slot-bar"></canvas></div>
        </div>
      </div>
      <div class="grid cols-2">
        <div class="card span-2">
          <h3>Score Distribution</h3>
          <p class="card-sub">Number of students across performance score bands</p>
          <div class="chart-wrap"><canvas id="chart-score-hist"></canvas></div>
        </div>
      </div>
      <div class="card">
        <h3>Top 10 Overall</h3>
        <p class="card-sub">Ranked by score, then completion time</p>
        <table id="ov-top10">
          <thead>
            <tr><th>Rank</th><th>Name</th><th>Roll No.</th><th>Branch</th><th>Score</th><th>Badge</th><th>Time (min)</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </div>

    <!-- COMPARISON PAGE -->
    <div class="page" id="page-comparison">
      <div class="page-head">
        <h1>Branch Comparison</h1>
        <p>All branches side by side.</p>
      </div>
      <div class="grid cols-2">
        <div class="card">
          <h3>Highest & Average Marks</h3>
          <p class="card-sub">Comparing maximum vs average scores per branch</p>
          <div class="chart-wrap tall"><canvas id="chart-cmp-scores"></canvas></div>
        </div>
        <div class="card">
          <h3>Students per Branch</h3>
          <p class="card-sub">Total participating students by branch</p>
          <div class="chart-wrap tall"><canvas id="chart-cmp-count"></canvas></div>
        </div>
      </div>
      <div class="card">
        <h3>Badge Breakdown by Branch</h3>
        <p class="card-sub">Excellence, Elite, Gold, Silver and Participant distributions</p>
        <div class="chart-wrap tall"><canvas id="chart-cmp-badges"></canvas></div>
      </div>
    </div>

    <!-- DEEP DIVE PAGE -->
    <div class="page" id="page-deepdive">
      <div class="page-head page-head-row">
        <div>
          <h1>Branch Deep-Dive</h1>
          <p>Select a branch to see its full breakdown.</p>
        </div>
        <button id="export-dd-pdf-btn" class="export-btn small" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>
          Export Branch PDF
        </button>
      </div>
      <div class="control-row">
        <select id="branch-select"></select>
      </div>
      <div class="kpi-row" id="dd-kpis"></div>
      <div class="grid cols-2">
        <div class="card">
          <h3>Score Distribution</h3>
          <p class="card-sub" id="dd-score-sub">Score bands within this branch</p>
          <div class="chart-wrap"><canvas id="chart-dd-hist"></canvas></div>
        </div>
        <div class="card">
          <h3>Badge Distribution</h3>
          <p class="card-sub">Award categories in this branch</p>
          <div class="chart-wrap"><canvas id="chart-dd-badges"></canvas></div>
        </div>
      </div>
      <div class="card">
        <h3>Top 10 in Branch</h3>
        <p class="card-sub">Top ranked students in this branch</p>
        <table id="dd-top10">
          <thead>
            <tr><th>Rank</th><th>Name</th><th>Roll No.</th><th>Score</th><th>Badge</th><th>Time (min)</th><th>Status</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </div>

    <!-- RANKINGS PAGE -->
    <div class="page" id="page-rankings">
      <div class="page-head page-head-row">
        <div>
          <h1>Rankings</h1>
          <p>Full ranked list — overall or branch-wise with filters.</p>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <div class="export-menu-wrap">
            <button id="export-menu-btn" class="export-btn" type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>
              Export
            </button>
            <div id="export-menu" class="export-menu">
              <button type="button" class="export-menu-item" data-format="pdf">Export as PDF</button>
              <button type="button" class="export-menu-item" data-format="doc">Export as Word (.doc)</button>
            </div>
          </div>
          <div class="export-menu-wrap">
            <button id="custom-export-menu-btn" class="export-btn" type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M7 12h10"/><path d="M10 18h4"/></svg>
              Official Report PDF
            </button>
            <div id="custom-export-menu" class="export-menu">
              <button type="button" class="export-menu-item" data-order="desc">Sort — High to Low</button>
              <button type="button" class="export-menu-item" data-order="asc">Sort — Low to High</button>
            </div>
          </div>
        </div>
      </div>
      <div class="rank-controls">
        <div class="toggle-group" id="toggle-rank-view">
          <button class="toggle-btn active" data-view="overall">Overall</button>
          <button class="toggle-btn" data-view="branch">Branch-wise</button>
        </div>
        <select id="rank-branch-select" class="branch-select-inline"></select>
        <div class="chip-group" id="rank-count-chips">
          <button class="chip active" data-n="10">Top 10</button>
          <button class="chip" data-n="25">Top 25</button>
          <button class="chip" data-n="50">Top 50</button>
          <button class="chip" data-n="100">Top 100</button>
          <button class="chip" data-n="all">All</button>
        </div>
        <input type="number" id="rank-count-custom" class="num-input" placeholder="Custom #" min="1">
        <input type="text" id="rank-search" class="search-input" placeholder="Search name or roll number">
      </div>
      <div class="rank-summary" id="rank-summary"></div>
      <div class="table-scroll">
        <table id="rank-table">
          <thead>
            <tr>
              <th>Rank</th><th>Name</th><th>Roll Number</th><th class="col-branch">Branch</th>
              <th>Score</th><th>Badge</th><th>Time (min)</th><th>Status</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </div>

  </div>
</div>

<script id="data-json" type="application/json">
${dataJson}
</script>

<script>
const RAW = JSON.parse(document.getElementById('data-json').textContent);
const STUDENTS = RAW.students;
const BRANCH_ORDER = RAW.branchOrder;
const EXAM_TITLE = RAW.examTitle || 'Exam';
const MAX_SCORE = RAW.maxScore || 100;
const IARE_HEADER_IMG = RAW.headerImg || '';

const OFFICIAL_BRANCH_DISPLAY_NAME = {
  CSE: 'CSE',
  CSM: 'CSE (AI & ML)',
  IT: 'IT',
  ECE: 'ECE',
  AERO: 'AERO',
  CSD: 'CSE(DS)',
  EEE: 'EEE',
  MECH: 'MECH',
  CIVIL: 'CIVIL',
};

function recognitionBand(marks) {
  const pct = MAX_SCORE > 0 ? (marks / MAX_SCORE) * 100 : marks;
  if (pct >= 99.99 || marks >= MAX_SCORE) return 'Excellence';
  if (pct >= 90) return 'Elite';
  if (pct >= 80) return 'Gold';
  if (pct >= 75) return 'Silver';
  return '-';
}

const COLORS = {
  gold: '#D9A73B', green: '#2F8F72', red: '#C1473E', blue: '#3E6FA8',
  ink: '#182231', inkMuted: '#5B6472', goldSoft:'#F3E1B5', greenSoft:'#D9EEE6',
  redSoft:'#F6DEDC', blueSoft:'#DCE7F3', purple: '#7C3AED', indigo: '#4F46E5'
};
const PALETTE = ['#D9A73B','#3E6FA8','#2F8F72','#C1473E','#8A6FB0','#4FA3A0','#B98650','#6B7A99','#A2734C'];

if (window.Chart) {
  Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  Chart.defaults.color = COLORS.inkMuted;
  Chart.defaults.font.size = 12;
}

function fmt1(n){ return Math.round(n*10)/10; }
function pct(n,d){ return d ? Math.round((n/d)*1000)/10 : 0; }

function statsFor(list){
  if(!list.length) return {count:0, avg:0, max:0, min:0, passRate:0, zeroCount:0};
  const scores = list.map(s=>s.score);
  const scoredCount = list.filter(s=>s.score>0).length;
  const zeroCount = list.filter(s=>s.score===0).length;
  return {
    count: list.length,
    avg: fmt1(scores.reduce((a,b)=>a+b,0)/list.length),
    max: Math.max(...scores),
    min: Math.min(...scores),
    passRate: pct(scoredCount, list.length),
    zeroCount: zeroCount
  };
}

function scoreHistogram(list){
  const bands = [
    {label:'0', test: v=>v===0},
    {label:'1-24', test: v=>v>0 && v<25},
    {label:'25-49', test: v=>v>=25 && v<50},
    {label:'50-74', test: v=>v>=50 && v<75},
    {label:'75-99', test: v=>v>=75 && v<100},
    {label:'100', test: v=>v>=100},
  ];
  return bands.map(b=>({label:b.label, count:list.filter(s=>b.test(s.score)).length}));
}

function rankedTop(list, n){
  return [...list].sort((a,b)=>{
    if(b.score !== a.score) return b.score - a.score;
    return a.time - b.time;
  }).slice(0,n);
}

function badgePill(badge){
  if(!badge || badge === '-') return '<span style="color:#94A3B8;">-</span>';
  const b = badge.toLowerCase();
  if(b === 'excellence') return '<span class="badge excellence">Excellence</span>';
  if(b === 'elite') return '<span class="badge elite">Elite</span>';
  if(b === 'gold') return '<span class="badge gold">Gold</span>';
  if(b === 'silver') return '<span class="badge silver">Silver</span>';
  return '<span class="badge tier2">'+badge+'</span>';
}

function tierBadge(tier){
  if(tier===1) return '<span class="badge tier1">Scored</span>';
  return '<span class="badge tier2">Zero</span>';
}

let charts = {};
function destroyIfExists(key){
  if(charts[key]){ charts[key].destroy(); delete charts[key]; }
}

/* ================= OVERVIEW PAGE ================= */
function renderOverview(){
  const all = STUDENTS;
  const st = statsFor(all);
  const kpis = [
    {label:'Total Students', value: st.count, cls:''},
    {label:'Average Score', value: st.avg, cls:'gold'},
    {label:'Highest Score', value: st.max, cls:'green'},
    {label:'Pass Rate (Score > 0)', value: st.passRate+'%', cls:'blue'},
    {label:'Zero Scorers', value: st.zeroCount + ' (' + pct(st.zeroCount, st.count) + '%)', cls:'red'},
  ];
  document.getElementById('ov-kpis').innerHTML = kpis.map(k=>\`
    <div class="kpi-card"><div class="kpi-label">\${k.label}</div><div class="kpi-value \${k.cls}">\${k.value}</div></div>
  \`).join('');

  document.getElementById('sidebar-stats-foot').innerHTML = \`\${st.count} students · \${BRANCH_ORDER.length} branches<br>Ranked by score, then time\`;

  // tier donut
  const t1 = all.filter(s=>s.score>0).length, t2 = all.filter(s=>s.score===0).length;
  destroyIfExists('tierDonut');
  charts.tierDonut = new Chart(document.getElementById('chart-tier-donut'), {
    type:'doughnut',
    data:{ labels:['Scored (> 0)', 'Zero (0)'],
      datasets:[{ data:[t1,t2], backgroundColor:[COLORS.green, '#94A3B8'], borderWidth:0 }]},
    options:{ plugins:{legend:{position:'bottom', labels:{boxWidth:10, padding:14}}}, cutout:'62%', maintainAspectRatio:false }
  });

  // students by slot (all Slot 1)
  destroyIfExists('slotBar');
  charts.slotBar = new Chart(document.getElementById('chart-slot-bar'), {
    type:'bar',
    data:{ labels:['Slot 1'], datasets:[{ label:'Students', data:[all.length], backgroundColor: COLORS.blue, borderRadius:5, maxBarThickness:56 }]},
    options:{ maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ y:{beginAtZero:true, grid:{color:'#EEF1F6'}}, x:{grid:{display:false}} } }
  });

  // score histogram
  const hist = scoreHistogram(all);
  destroyIfExists('scoreHist');
  charts.scoreHist = new Chart(document.getElementById('chart-score-hist'), {
    type:'bar',
    data:{ labels: hist.map(h=>h.label), datasets:[{ label:'Students', data: hist.map(h=>h.count), backgroundColor: COLORS.gold, borderRadius:5, maxBarThickness:70 }]},
    options:{ maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ y:{beginAtZero:true, grid:{color:'#EEF1F6'}}, x:{grid:{display:false}, title:{display:true,text:'Score Band'}} } }
  });

  // top 10 table
  const top10 = rankedTop(all, 10);
  document.querySelector('#ov-top10 tbody').innerHTML = top10.map((s,i)=>\`
    <tr><td class="rank-cell">\${i+1}</td><td>\${s.name}</td><td>\${s.roll}</td><td>\${s.branch}</td><td>\${s.score}</td><td>\${badgePill(s.badge)}</td><td>\${s.time}</td></tr>
  \`).join('');
}

/* ================= COMPARISON PAGE ================= */
function branchGroups(){
  const groups = {};
  BRANCH_ORDER.forEach(b=> groups[b] = STUDENTS.filter(s=>s.branch===b));
  return groups;
}

function renderComparison(){
  const groups = branchGroups();
  const branches = BRANCH_ORDER;
  const stArr = branches.map(b=>statsFor(groups[b]));

  destroyIfExists('cmpScores');
  charts.cmpScores = new Chart(document.getElementById('chart-cmp-scores'), {
    type:'bar',
    data:{ labels: branches, datasets:[
      {label:'Highest', data: stArr.map(s=>s.max), backgroundColor: COLORS.green, borderRadius:4},
      {label:'Average', data: stArr.map(s=>s.avg), backgroundColor: COLORS.gold, borderRadius:4},
    ]},
    options:{ maintainAspectRatio:false, plugins:{legend:{position:'bottom'}}, scales:{ y:{beginAtZero:true, grid:{color:'#EEF1F6'}}, x:{grid:{display:false}} } }
  });

  destroyIfExists('cmpCount');
  charts.cmpCount = new Chart(document.getElementById('chart-cmp-count'), {
    type:'bar',
    data:{ labels: branches, datasets:[{ label:'Students', data: stArr.map(s=>s.count), backgroundColor: branches.map((_,i)=>PALETTE[i%PALETTE.length]), borderRadius:5 }]},
    options:{ maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ y:{beginAtZero:true, grid:{color:'#EEF1F6'}}, x:{grid:{display:false}} } }
  });

  // Badge breakdown by branch
  const badgeCategories = ['Excellence', 'Elite', 'Gold', 'Silver', 'Participant'];
  const colorsMap = {
    Excellence: '#7C3AED',
    Elite: '#4F46E5',
    Gold: '#D9A73B',
    Silver: '#94A3B8',
    Participant: '#CBD5E1'
  };

  const datasets = badgeCategories.map(cat => ({
    label: cat,
    data: branches.map(b => {
      const list = groups[b];
      if (cat === 'Participant') {
        return list.filter(s => !s.badge || s.badge === '-' || (!['Excellence','Elite','Gold','Silver'].includes(s.badge))).length;
      }
      return list.filter(s => s.badge === cat).length;
    }),
    backgroundColor: colorsMap[cat],
    stack: 'badges'
  }));

  destroyIfExists('cmpBadges');
  charts.cmpBadges = new Chart(document.getElementById('chart-cmp-badges'), {
    type:'bar',
    data: { labels: branches, datasets },
    options:{ maintainAspectRatio:false, plugins:{legend:{position:'bottom'}},
      scales:{ y:{beginAtZero:true, stacked:true, grid:{color:'#EEF1F6'}}, x:{stacked:true, grid:{display:false}} } }
  });
}

/* ================= DEEP DIVE PAGE ================= */
let currentBranch = BRANCH_ORDER[0] || 'CSE';

function populateBranchSelect(){
  const sel = document.getElementById('branch-select');
  sel.innerHTML = BRANCH_ORDER.map(b=>\`<option value="\${b}">\${b} (\${STUDENTS.filter(s=>s.branch===b).length} students)</option>\`).join('');
  sel.value = currentBranch;
  sel.addEventListener('change', ()=>{ currentBranch = sel.value; renderDeepDive(); });
}

function renderDeepDive(){
  const list = STUDENTS.filter(s=>s.branch===currentBranch);
  const st = statsFor(list);

  const kpis = [
    {label:'Students', value: st.count, cls:''},
    {label:'Highest Score', value: st.max, cls:'green'},
    {label:'Average Score', value: st.avg, cls:'gold'},
    {label:'Lowest Score', value: st.min, cls:'blue'},
    {label:'Pass Rate', value: st.passRate + '%', cls:'blue'},
    {label:'Zero Scorers', value: st.zeroCount + ' (' + pct(st.zeroCount, st.count) + '%)', cls:'red'},
  ];
  document.getElementById('dd-kpis').innerHTML = kpis.map(k=>\`
    <div class="kpi-card"><div class="kpi-label">\${k.label}</div><div class="kpi-value \${k.cls}">\${k.value}</div></div>
  \`).join('');

  const hist = scoreHistogram(list);
  destroyIfExists('ddHist');
  charts.ddHist = new Chart(document.getElementById('chart-dd-hist'), {
    type:'bar',
    data:{ labels: hist.map(h=>h.label), datasets:[{ label:'Students', data: hist.map(h=>h.count), backgroundColor: COLORS.gold, borderRadius:5, maxBarThickness:60 }]},
    options:{ maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ y:{beginAtZero:true, grid:{color:'#EEF1F6'}}, x:{grid:{display:false}} } }
  });

  // Badge distribution in branch
  const badgeCounts = {
    Excellence: list.filter(s=>s.badge==='Excellence').length,
    Elite: list.filter(s=>s.badge==='Elite').length,
    Gold: list.filter(s=>s.badge==='Gold').length,
    Silver: list.filter(s=>s.badge==='Silver').length,
    Participant: list.filter(s=>!s.badge || s.badge==='-' || (!['Excellence','Elite','Gold','Silver'].includes(s.badge))).length
  };

  destroyIfExists('ddBadges');
  charts.ddBadges = new Chart(document.getElementById('chart-dd-badges'), {
    type:'doughnut',
    data:{
      labels:['Excellence', 'Elite', 'Gold', 'Silver', 'Participant'],
      datasets:[{
        data: Object.values(badgeCounts),
        backgroundColor:['#7C3AED', '#4F46E5', '#D9A73B', '#94A3B8', '#CBD5E1'],
        borderWidth:0
      }]
    },
    options:{ plugins:{legend:{position:'bottom'}}, cutout:'60%', maintainAspectRatio:false }
  });

  const top10 = rankedTop(list, 10);
  document.querySelector('#dd-top10 tbody').innerHTML = top10.map((s,i)=>\`
    <tr><td class="rank-cell">\${i+1}</td><td>\${s.name}</td><td>\${s.roll}</td><td>\${s.score}</td><td>\${badgePill(s.badge)}</td><td>\${s.time}</td><td>\${tierBadge(s.tier)}</td></tr>
  \`).join('');
}

/* ================= RANKINGS PAGE ================= */
let rankView = 'overall';
let rankBranch = BRANCH_ORDER[0] || 'CSE';
let rankCount = 10;
let rankSearch = '';

function fullRankedList(list){
  return [...list].sort((a,b)=>{
    if(b.score !== a.score) return b.score - a.score;
    return a.time - b.time;
  });
}

function populateRankBranchSelect(){
  const sel = document.getElementById('rank-branch-select');
  sel.innerHTML = BRANCH_ORDER.map(b=>\`<option value="\${b}">\${b} (\${STUDENTS.filter(s=>s.branch===b).length} students)</option>\`).join('');
  sel.value = rankBranch;
}

function renderRankings(){
  const table = document.getElementById('rank-table');
  const isOverall = rankView === 'overall';

  let pool = isOverall ? STUDENTS : STUDENTS.filter(s=>s.branch===rankBranch);
  let ranked = fullRankedList(pool);

  const totalInScope = ranked.length;
  const n = rankCount === 'all' ? totalInScope : Math.min(rankCount, totalInScope);
  let sliced = ranked.slice(0, n);

  if(rankSearch.trim()){
    const q = rankSearch.trim().toLowerCase();
    sliced = sliced.filter(s => s.name.toLowerCase().includes(q) || s.roll.toLowerCase().includes(q));
  }

  const scopeLabel = isOverall ? \`\${totalInScope} students overall\` : \`\${totalInScope} students in \${rankBranch}\`;
  const countLabel = rankCount === 'all' ? 'all' : \`top \${n}\`;
  document.getElementById('rank-summary').textContent =
    \`Showing \${countLabel} of \${scopeLabel}\` + (rankSearch.trim() ? \` — filtered by "\${rankSearch.trim()}" (\${sliced.length} match\${sliced.length===1?'':'es'})\` : '');

  document.querySelector('#rank-table tbody').innerHTML = sliced.map((s,i)=>\`
    <tr>
      <td class="rank-cell">\${i+1}</td>
      <td>\${s.name}</td>
      <td>\${s.roll}</td>
      <td class="col-branch">\${s.branch}</td>
      <td>\${s.score}</td>
      <td>\${badgePill(s.badge)}</td>
      <td>\${s.time}</td>
      <td>\${tierBadge(s.tier)}</td>
    </tr>
  \`).join('');

  table.querySelectorAll('.col-branch').forEach(el => el.style.display = isOverall ? '' : 'none');
}

document.querySelectorAll('#toggle-rank-view .toggle-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('#toggle-rank-view .toggle-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    rankView = btn.dataset.view;
    document.getElementById('rank-branch-select').classList.toggle('show', rankView==='branch');
    renderRankings();
  });
});

document.getElementById('rank-branch-select').addEventListener('change', (e)=>{
  rankBranch = e.target.value;
  renderRankings();
});

document.querySelectorAll('#rank-count-chips .chip').forEach(chip=>{
  chip.addEventListener('click', ()=>{
    document.querySelectorAll('#rank-count-chips .chip').forEach(c=>c.classList.remove('active'));
    chip.classList.add('active');
    rankCount = chip.dataset.n === 'all' ? 'all' : parseInt(chip.dataset.n, 10);
    document.getElementById('rank-count-custom').value = '';
    renderRankings();
  });
});

document.getElementById('rank-count-custom').addEventListener('input', (e)=>{
  const v = parseInt(e.target.value, 10);
  if(v && v > 0){
    document.querySelectorAll('#rank-count-chips .chip').forEach(c=>c.classList.remove('active'));
    rankCount = v;
    renderRankings();
  }
});

document.getElementById('rank-search').addEventListener('input', (e)=>{
  rankSearch = e.target.value;
  renderRankings();
});

/* ---------- PDF / Word export ---------- */
function tierText(tier){
  return tier === 1 ? 'Scored' : 'Zero';
}

function getRankingsExportData(){
  const isOverall = rankView === 'overall';
  const pool = isOverall ? STUDENTS : STUDENTS.filter(s=>s.branch===rankBranch);
  const ranked = fullRankedList(pool);
  const totalInScope = ranked.length;
  const isAll = rankCount === 'all';
  const n = isAll ? totalInScope : Math.min(rankCount, totalInScope);
  let sliced = ranked.slice(0, n);
  if(rankSearch.trim()){
    const q = rankSearch.trim().toLowerCase();
    sliced = sliced.filter(s => s.name.toLowerCase().includes(q) || s.roll.toLowerCase().includes(q));
  }

  const scopeLabel = isOverall ? 'Overall' : rankBranch;
  const countLabel = isAll ? 'All' : ('Top ' + n);
  const stamp = new Date().toLocaleString();

  let subtitle = countLabel + ' — ' + scopeLabel + ' | ' + sliced.length + ' student' + (sliced.length===1?'':'s');
  if(rankSearch.trim()) subtitle += ' | filtered by "' + rankSearch.trim() + '"';
  subtitle += ' | generated ' + stamp;

  const head = ['Rank', 'Name', 'Roll Number']
    .concat(isOverall ? ['Branch'] : [])
    .concat(['Score', 'Badge', 'Time (min)', 'Status']);

  const body = sliced.map((s, i) => {
    const row = [i + 1, s.name, s.roll];
    if(isOverall) row.push(s.branch);
    row.push(s.score, s.badge || '-', s.time, tierText(s.tier));
    return row;
  });

  const fileName = (isOverall ? 'Overall' : rankBranch) + '_' + (isAll ? 'all' : ('top' + n)) + '_students';
  return { isOverall, scopeLabel, countLabel, subtitle, head, body, fileName };
}

function exportRankingsPDF(){
  try{
    const { subtitle, head, body, fileName } = getRankingsExportData();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(EXAM_TITLE + ' — Rankings', 40, 40);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(91, 100, 114);
    doc.text(subtitle, 40, 58);
    doc.setTextColor(0, 0, 0);

    if(body.length === 0){
      doc.setFontSize(11);
      doc.text('No students match the current filter.', 40, 90);
    } else {
      doc.autoTable({
        head: [head], body,
        startY: 72,
        margin: { left: 40, right: 40 },
        styles: { fontSize: 9, cellPadding: 5 },
        headStyles: { fillColor: [24, 34, 49], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [250, 251, 253] },
        columnStyles: { 0: { cellWidth: 34, halign: 'center' } }
      });
    }

    doc.save(fileName + '.pdf');
  } catch(err){
    console.error('PDF export failed', err);
    alert('Sorry, the PDF could not be generated.');
  }
}

function exportRankingsWord(){
  try{
    const { subtitle, head, body, fileName } = getRankingsExportData();
    const theadHtml = '<tr>' + head.map(h =>
      \`<th style="background:#182231;color:#ffffff;padding:7px 10px;border:1px solid #182231;">\${h}</th>\`
    ).join('') + '</tr>';

    const tbodyHtml = body.length === 0
      ? \`<tr><td colspan="\${head.length}" style="padding:10px;">No students match the current filter.</td></tr>\`
      : body.map(row => '<tr>' + row.map((c, i) =>
          \`<td style="padding:6px 10px;border:1px solid #DDE3EC;\${i===0 ? 'text-align:center;' : ''}">\${c}</td>\`
        ).join('') + '</tr>').join('');

    const htmlDoc = '<html xmlns:o="urn:schemas-microsoft-com:office:office" '
      + 'xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">'
      + '<head><meta charset="utf-8"><title>Rankings</title></head>'
      + '<body style="font-family:Arial,Helvetica,sans-serif;">'
      + \`<h2 style="font-family:Georgia,'Times New Roman',serif;color:#182231;margin-bottom:4px;">\${EXAM_TITLE} — Rankings</h2>\`
      + \`<p style="font-size:11px;color:#5B6472;margin-top:0;">\${subtitle}</p>\`
      + '<table style="border-collapse:collapse;width:100%;font-size:11px;">'
      + \`<thead>\${theadHtml}</thead><tbody>\${tbodyHtml}</tbody>\`
      + '</table></body></html>';

    const blob = new Blob(['\\ufeff', htmlDoc], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName + '.doc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch(err){
    console.error('Word export failed', err);
    alert('Sorry, the Word document could not be generated.');
  }
}

const exportMenuBtn = document.getElementById('export-menu-btn');
const exportMenu = document.getElementById('export-menu');
exportMenuBtn.addEventListener('click', (e)=>{
  e.stopPropagation();
  exportMenu.classList.toggle('show');
});
exportMenu.querySelectorAll('.export-menu-item').forEach(item=>{
  item.addEventListener('click', ()=>{
    exportMenu.classList.remove('show');
    if(item.dataset.format === 'pdf') exportRankingsPDF();
    else exportRankingsWord();
  });
});
document.addEventListener('click', (e)=>{
  if(!exportMenu.contains(e.target) && e.target !== exportMenuBtn) exportMenu.classList.remove('show');
});

/* ---------- Official CDC Report PDF Export ---------- */
function buildOfficialResultsPDF(order){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginL = 72, marginR = 72;

  // Header banner
  if (IARE_HEADER_IMG) {
    try {
      doc.addImage(IARE_HEADER_IMG, 'JPEG', marginL, 34, 450.75, 59.25);
    } catch(imgErr) {
      console.warn('Failed to render header image in PDF', imgErr);
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(200, 0, 0);
  doc.text('CAREER DEVELOPMENT CENTER', pageWidth / 2, 112, { align: 'center' });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.text(EXAM_TITLE + ' Results', pageWidth / 2, 130, { align: 'center' });

  doc.setFontSize(10);
  const stamp = new Date();
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dateStr = stamp.getDate() + ' ' + MONTHS[stamp.getMonth()] + ', ' + stamp.getFullYear();
  doc.text(dateStr, pageWidth - marginR, 155, { align: 'right' });

  const scopeIsOverall = rankView === 'overall';
  const scopeCountLabel = rankCount === 'all' ? 'All' : ('Top ' + rankCount);
  const scopeWhoLabel = scopeIsOverall ? 'Overall' : rankBranch;
  let scopeLine = scopeCountLabel + ' — ' + scopeWhoLabel;
  if (rankSearch.trim()) scopeLine += ' | filtered by "' + rankSearch.trim() + '"';
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(91, 100, 114);
  doc.text(scopeLine, marginL, 155);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');

  // Branch participation table
  const BAND_COLS = ['Excellence', 'Elite', 'Gold', 'Silver'];
  const branchRows = BRANCH_ORDER.map((code, i) => {
    const list = STUDENTS.filter(s => s.branch === code);
    const bandCounts = { Excellence: 0, Elite: 0, Gold: 0, Silver: 0 };
    list.forEach(s => {
      const b = s.badge || recognitionBand(Math.round(s.score));
      if (Object.prototype.hasOwnProperty.call(bandCounts, b)) bandCounts[b]++;
    });
    return [
      String(i + 1), OFFICIAL_BRANCH_DISPLAY_NAME[code] || code,
      String(list.length),
      String(bandCounts.Excellence), String(bandCounts.Elite), String(bandCounts.Gold), String(bandCounts.Silver)
    ];
  });

  doc.autoTable({
    head: [['S No.', 'Branch', 'Total Students Participated', ...BAND_COLS]],
    body: branchRows,
    startY: 166,
    margin: { left: marginL, right: marginR },
    styles: { fontSize: 9, cellPadding: 4, lineColor: [0, 0, 0], lineWidth: 0.75, textColor: [0, 0, 0] },
    headStyles: { fillColor: false, textColor: [0, 0, 0], fontStyle: 'bold' },
    bodyStyles: { fillColor: false },
    columnStyles: {
      0: { halign: 'center', cellWidth: 28 },
      1: { cellWidth: 118 },
      2: { halign: 'center', cellWidth: 78 },
      3: { halign: 'center', cellWidth: 61 },
      4: { halign: 'center', cellWidth: 61 },
      5: { halign: 'center', cellWidth: 61 },
      6: { halign: 'center', cellWidth: 61 },
    },
    theme: 'grid'
  });

  let y = doc.lastAutoTable.finalY + 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  [
    'Excellence — 100% cumulative score',
    'Elite — 90% to below 100%',
    'Gold — 80% to below 90%',
    'Silver — 75% to below 80%',
  ].forEach(line => { doc.text(line, marginL, y); y += 11.5; });

  const isOverallScope = rankView === 'overall';
  let scopedPool = isOverallScope ? STUDENTS : STUDENTS.filter(s => s.branch === rankBranch);
  const scopedRanked = fullRankedList(scopedPool);
  const scopedTotal = scopedRanked.length;
  const scopedN = rankCount === 'all' ? scopedTotal : Math.min(rankCount, scopedTotal);
  let selected = scopedRanked.slice(0, scopedN);
  if (rankSearch.trim()) {
    const q = rankSearch.trim().toLowerCase();
    selected = selected.filter(s => s.name.toLowerCase().includes(q) || s.roll.toLowerCase().includes(q));
  }

  const sorted = [...selected].sort((a, b) => {
    const diff = order === 'asc' ? (a.score - b.score) : (b.score - a.score);
    if (diff !== 0) return diff;
    return a.time - b.time;
  });

  const body = sorted.map((s, i) => {
    const marks = Math.round(s.score);
    return [String(i + 1), s.roll.toUpperCase(), s.name, s.branch, String(marks), s.badge || recognitionBand(marks)];
  });

  doc.autoTable({
    head: [['S No.', 'Roll No.', 'Name', 'Branch', 'Marks', 'Recognition']],
    body,
    startY: y + 10,
    margin: { left: marginL, right: marginR },
    styles: { fontSize: 9, cellPadding: 5, lineColor: [0, 0, 0], lineWidth: 0.75, textColor: [0, 0, 0] },
    headStyles: { fillColor: false, textColor: [0, 0, 0], fontStyle: 'bold' },
    bodyStyles: { fillColor: false },
    columnStyles: {
      0: { halign: 'center', cellWidth: 34 },
      1: { cellWidth: 70 },
      2: { cellWidth: 140 },
      3: { cellWidth: 60, halign: 'center' },
      4: { cellWidth: 50, halign: 'center' },
      5: { cellWidth: 80 },
    },
    theme: 'grid',
    didDrawPage: () => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text('DEAN - CDC', pageWidth - marginR, doc.internal.pageSize.getHeight() - 24, { align: 'right' });
      doc.setTextColor(0, 0, 0);
    }
  });

  doc.save(EXAM_TITLE.replace(/[^a-zA-Z0-9]/g, '_') + '_Official_Results_' + (order === 'asc' ? 'Ascending' : 'Descending') + '.pdf');
}

const customExportMenuBtn = document.getElementById('custom-export-menu-btn');
const customExportMenu = document.getElementById('custom-export-menu');
customExportMenuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  customExportMenu.classList.toggle('show');
});
customExportMenu.querySelectorAll('.export-menu-item').forEach(item => {
  item.addEventListener('click', () => {
    customExportMenu.classList.remove('show');
    buildOfficialResultsPDF(item.dataset.order);
  });
});
document.addEventListener('click', (e) => {
  if(!customExportMenu.contains(e.target) && e.target !== customExportMenuBtn) customExportMenu.classList.remove('show');
});

/* ================= NAV + TOGGLES ================= */
const pageRendered = { overview:false, comparison:false, deepdive:false, rankings:false };

function renderPage(page){
  try{
    if(page==='overview' && !pageRendered.overview){ renderOverview(); pageRendered.overview = true; }
    if(page==='comparison' && !pageRendered.comparison){ renderComparison(); pageRendered.comparison = true; }
    if(page==='deepdive' && !pageRendered.deepdive){ populateBranchSelect(); renderDeepDive(); pageRendered.deepdive = true; }
    if(page==='rankings' && !pageRendered.rankings){ populateRankBranchSelect(); renderRankings(); pageRendered.rankings = true; }
  } catch(e){ console.error('Render error on page', page, e); }
}

document.querySelectorAll('.nav-item').forEach(item=>{
  item.addEventListener('click', ()=>{
    document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    item.classList.add('active');
    document.getElementById('page-'+item.dataset.page).classList.add('active');
    renderPage(item.dataset.page);
  });
});

/* ================= INIT ================= */

renderPage('overview');
</script>
</body>
</html>`;
}
