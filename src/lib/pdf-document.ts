const PAPER_WIDTH_MM = 210;
const PAPER_HEIGHT_MM = 297;

export function sanitizeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim();
}

export async function elementToPdfBlob(element: HTMLElement) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
  const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false });
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageHeightPx = Math.floor((canvas.width * PAPER_HEIGHT_MM) / PAPER_WIDTH_MM);

  for (let offset = 0, page = 0; offset < canvas.height; offset += pageHeightPx, page += 1) {
    const sliceHeight = Math.min(pageHeightPx, canvas.height - offset);
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeight;
    const context = pageCanvas.getContext("2d");
    if (!context) throw new Error("PDF 페이지를 생성할 수 없습니다.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    context.drawImage(canvas, 0, offset, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
    if (page > 0) pdf.addPage();
    pdf.addImage(pageCanvas.toDataURL("image/jpeg", 0.94), "JPEG", 0, 0, PAPER_WIDTH_MM, (sliceHeight * PAPER_WIDTH_MM) / canvas.width, undefined, "FAST");
  }
  return pdf.output("blob");
}

export async function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("PDF 파일을 읽지 못했습니다."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.readAsDataURL(blob);
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = sanitizeFilename(filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
