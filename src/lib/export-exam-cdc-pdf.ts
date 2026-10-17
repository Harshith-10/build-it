import type { ExamCdcReportData } from "@/actions/admin/exams";

/**
 * Dynamically loads jsPDF and jspdf-autotable from CDN on-demand.
 * This avoids adding extra dependencies to package.json and pnpm-lock.yaml.
 */
async function loadJsPdf(): Promise<any> {
  if (typeof window === "undefined") {
    throw new Error("PDF generation is only supported in the browser");
  }

  if ((window as any).jspdf?.jsPDF) {
    return (window as any).jspdf;
  }

  return new Promise((resolve, reject) => {
    // If scripts are already being injected, wait for them
    if (document.getElementById("jspdf-cdn")) {
      const interval = setInterval(() => {
        if ((window as any).jspdf?.jsPDF) {
          clearInterval(interval);
          resolve((window as any).jspdf);
        }
      }, 50);
      setTimeout(() => {
        clearInterval(interval);
        reject(new Error("Timed out loading PDF library"));
      }, 10000);
      return;
    }

    const script1 = document.createElement("script");
    script1.id = "jspdf-cdn";
    script1.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";

    script1.onload = () => {
      const script2 = document.createElement("script");
      script2.id = "jspdf-autotable-cdn";
      script2.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js";
      script2.onload = () => {
        resolve((window as any).jspdf);
      };
      script2.onerror = () => reject(new Error("Failed to load PDF autotable library"));
      document.head.appendChild(script2);
    };

    script1.onerror = () => reject(new Error("Failed to load PDF library"));
    document.head.appendChild(script1);
  });
}

export async function exportExamCdcReportPDF(data: ExamCdcReportData) {
  const jspdfModule = await loadJsPdf();
  const { jsPDF } = jspdfModule;

  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginL = 54;
  const marginR = 54;
  const contentWidth = pageWidth - marginL - marginR;

  // 1. Header Banner
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = "/iare-header.jpg";
    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve; // Continue even if image fails
    });
    if (img.complete && img.naturalWidth > 0) {
      const bannerHeight = 55;
      const bannerWidth = Math.min(460, contentWidth);
      const startX = (pageWidth - bannerWidth) / 2;
      doc.addImage(img, "JPEG", startX, 28, bannerWidth, bannerHeight);
    }
  } catch (err) {
    console.warn("Could not render header banner", err);
  }

  // 2. Titles
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(200, 0, 0); // Official CDC red
  doc.text("CAREER DEVELOPMENT CENTER", pageWidth / 2, 104, { align: "center" });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(13);
  doc.text(`${data.exam.title} Results`, pageWidth / 2, 122, { align: "center" });

  // 3. Date & Scope line
  const stamp = new Date();
  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const dateStr = `${stamp.getDate()} ${MONTHS[stamp.getMonth()]}, ${stamp.getFullYear()}`;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(70, 70, 70);
  doc.text(dateStr, pageWidth - marginR, 142, { align: "right" });

  doc.setFont("helvetica", "italic");
  const scopeLine = `Scope: ${data.scopeLabel} (${data.totalAppeared} Participated)`;
  doc.text(scopeLine, marginL, 142);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");

  // 4. Branch Summary Table
  const BAND_COLS = ["Excellence", "Elite", "Gold", "Silver"];
  const branchRows: (string | number)[][] = data.branchSummary.map((b, i) => [
    String(i + 1),
    `${b.branchName} (${b.branchCode})`,
    String(b.total),
    String(b.excellence),
    String(b.elite),
    String(b.gold),
    String(b.silver),
  ]);

  // Total row
  branchRows.push([
    "",
    "Total",
    String(data.totals.total),
    String(data.totals.excellence),
    String(data.totals.elite),
    String(data.totals.gold),
    String(data.totals.silver),
  ]);

  (doc as any).autoTable({
    head: [["S No.", "Branch", "Total Students Participated", ...BAND_COLS]],
    body: branchRows,
    startY: 152,
    margin: { left: marginL, right: marginR },
    styles: {
      fontSize: 8.5,
      cellPadding: 3.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.5,
      textColor: [0, 0, 0],
    },
    headStyles: {
      fillColor: [15, 60, 126], // Official IARE Blue (#0f3c7e)
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    bodyStyles: {
      fillColor: false,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 30 },
      1: { cellWidth: 174 },
      2: { halign: "center", cellWidth: 70 },
      3: { halign: "center", cellWidth: 55 },
      4: { halign: "center", cellWidth: 55 },
      5: { halign: "center", cellWidth: 55 },
      6: { halign: "center", cellWidth: 55 },
    },
    theme: "grid",
  });

  // 5. Band criteria legend
  const lastTable = (doc as any).lastAutoTable;
  let nextY = (lastTable ? lastTable.finalY : 280) + 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Performance Band Criteria:", marginL, nextY);
  nextY += 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const criteria = [
    "• Excellence — 100% cumulative score",
    "• Elite — 90% to below 100%",
    "• Gold — 80% to below 90%",
    "• Silver — 75% to below 80%",
  ];
  criteria.forEach((c) => {
    doc.text(c, marginL + 8, nextY);
    nextY += 11;
  });

  // 6. Ranked Student Table
  const studentRows = data.students.map((s, i) => [
    String(i + 1),
    s.rollNumber.toUpperCase(),
    s.name,
    s.branch,
    String(s.marks),
    s.badge,
  ]);

  (doc as any).autoTable({
    head: [["S No.", "Roll No.", "Name", "Branch", "Marks", "Recognition"]],
    body: studentRows,
    startY: nextY + 8,
    margin: { left: marginL, right: marginR },
    styles: {
      fontSize: 8.5,
      cellPadding: 4,
      lineColor: [0, 0, 0],
      lineWidth: 0.5,
      textColor: [0, 0, 0],
    },
    headStyles: {
      fillColor: [15, 60, 126], // Official IARE Blue (#0f3c7e)
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    bodyStyles: {
      fillColor: false,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 32 },
      1: { cellWidth: 80, fontStyle: "bold" },
      2: { cellWidth: 160 },
      3: { cellWidth: 64, halign: "center" },
      4: { cellWidth: 54, halign: "center", fontStyle: "bold" },
      5: { cellWidth: 80, halign: "center" },
    },
    theme: "grid",
    didDrawPage: () => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(80, 80, 80);
      const signerTitle = data.role === "admin" ? "DEAN - CDC" : "FACULTY INCHARGE";
      doc.text(signerTitle, pageWidth - marginR, pageHeight - 24, { align: "right" });
      doc.setTextColor(0, 0, 0);
    },
  });

  // Download directly
  const cleanTitle = data.exam.title.replace(/[^a-zA-Z0-9]/g, "_");
  doc.save(`${cleanTitle}_Official_Results.pdf`);
}
