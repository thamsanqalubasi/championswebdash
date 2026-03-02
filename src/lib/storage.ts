/**
 * Shared storage upload helpers and document-info fetching utilities.
 */

import { supabase } from "@/lib/supabase";
import type { CompanyInfo, AdminInfo } from "@/lib/document-templates";

function stripHtmlToText(html: string) {
  return String(html ?? "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r/g, "")
    .replace(/[\t ]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapePdfText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "");
}

function buildPdfFromText(text: string): Uint8Array {
  const normalized = String(text ?? "").replace(/\r/g, "");
  const lines = normalized.split("\n");
  const maxLinesPerPage = 46;
  const pages: string[][] = [];

  for (let index = 0; index < lines.length; index += maxLinesPerPage) {
    pages.push(lines.slice(index, index + maxLinesPerPage));
  }
  if (pages.length === 0) pages.push([""]);

  const objects: string[] = [];
  const pageObjectIds: number[] = [];
  const contentObjectIds: number[] = [];
  const pagesRootObjectId = 2;
  const fontObjectId = 3;

  let nextId = 4;
  pages.forEach((pageLines) => {
    const pageObjectId = nextId++;
    const contentObjectId = nextId++;
    pageObjectIds.push(pageObjectId);
    contentObjectIds.push(contentObjectId);

    const contentStream = [
      "BT",
      "/F1 10 Tf",
      "14 TL",
      "40 800 Td",
      ...pageLines.map((line) => `(${escapePdfText(line)}) Tj T*`),
      "ET",
    ].join("\n");

    objects[contentObjectId] = `${contentObjectId} 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj\n`;
    objects[pageObjectId] = `${pageObjectId} 0 obj\n<< /Type /Page /Parent ${pagesRootObjectId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>\nendobj\n`;
  });

  objects[1] = `1 0 obj\n<< /Type /Catalog /Pages ${pagesRootObjectId} 0 R >>\nendobj\n`;
  objects[2] = `2 0 obj\n<< /Type /Pages /Count ${pageObjectIds.length} /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] >>\nendobj\n`;
  objects[3] = `3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;

  const maxObjectId = nextId - 1;
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = new Array(maxObjectId + 1).fill(0);

  for (let objectId = 1; objectId <= maxObjectId; objectId += 1) {
    offsets[objectId] = pdf.length;
    pdf += objects[objectId] || "";
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${maxObjectId + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let objectId = 1; objectId <= maxObjectId; objectId += 1) {
    pdf += `${String(offsets[objectId]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${maxObjectId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

export function createPdfFileFromHtml(html: string, fileNameBase: string): File {
  const plainText = stripHtmlToText(html);
  const pdfBytes = buildPdfFromText(plainText);
  const safeBase = String(fileNameBase || "document").replace(/\.pdf$/i, "");
  const pdfBuffer = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength,
  ) as ArrayBuffer;
  return new File([pdfBuffer], `${safeBase}.pdf`, { type: "application/pdf" });
}

export async function createPdfAttachmentFromHtml(html: string, fileNameBase: string) {
  const file = createPdfFileFromHtml(html, fileNameBase);
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return {
    filename: file.name,
    contentBase64: btoa(binary),
    contentType: "application/pdf",
  };
}

export async function createPdfAttachmentFromUrl(url: string, fileName: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Could not fetch PDF attachment URL.");
  }

  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return {
    filename: fileName,
    contentBase64: btoa(binary),
    contentType: "application/pdf",
  };
}

export async function uploadPdfFromHtml(bucket: string, folder: string, html: string, fileNameBase: string): Promise<string> {
  const file = createPdfFileFromHtml(html, fileNameBase);
  return uploadFileToBucket(bucket, folder, file);
}

/**
 * Upload a file to a Supabase Storage bucket.
 * Returns the public URL of the uploaded file.
 * Falls back to a long-lived signed URL if the bucket is not public.
 */
export async function uploadFileToBucket(
  bucket: string,
  folder: string,
  file: File,
): Promise<string> {
  const extension = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const path = `${folder}/${Date.now()}.${extension}`;

  // Attempt upload; if bucket doesn't exist, create it and retry once
  let uploadResult = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true });

  if (uploadResult.error && /bucket.*not found/i.test(uploadResult.error.message)) {
    // Auto-create the bucket as public
    await supabase.storage.createBucket(bucket, { public: true });
    // Retry the upload
    uploadResult = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: true });
  }

  if (uploadResult.error) throw uploadResult.error;

  // Try public URL first
  const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(path);
  const publicUrl = publicUrlData.publicUrl;

  // Verify the public URL works by sending a HEAD request
  try {
    const check = await fetch(publicUrl, { method: "HEAD" });
    if (check.ok) return publicUrl;
  } catch {
    // Public URL not accessible — fall through to signed URL
  }

  // Fallback: create a signed URL valid for 10 years
  const { data: signedData, error: signedError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);

  if (signedError || !signedData?.signedUrl) {
    // Return public URL anyway — admin can fix bucket policies later
    return publicUrl;
  }

  return signedData.signedUrl;
}

/**
 * Save an HTML document string to a database column.
 * Returns the HTML string as-is (stored directly in DB, not as data URL).
 */
export function htmlToStorableString(html: string): string {
  return html;
}

/**
 * Fetch company settings used for document generation.
 */
export async function fetchCompanyInfo(): Promise<CompanyInfo> {
  const { data, error } = await supabase
    .from("company_settings")
    .select("company_name, logo_url, address, tax_rate, payment_instructions")
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return {
    companyName: String(data?.company_name ?? "Champions Court"),
    logoUrl: String(data?.logo_url ?? ""),
    address: String(data?.address ?? ""),
    taxRate: Number(data?.tax_rate ?? 15),
    paymentInstructions: String(data?.payment_instructions ?? ""),
  };
}

/**
 * Fetch admin name and signature URL for document generation.
 */
export async function fetchAdminInfo(userEmail?: string): Promise<AdminInfo> {
  if (!userEmail) {
    return { fullName: "Admin", signatureUrl: "" };
  }

  const { data, error } = await supabase
    .from("users")
    .select("first_name, last_name, signature_url")
    .eq("email", userEmail)
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const fullName = data
    ? `${String(data.first_name ?? "")} ${String(data.last_name ?? "")}`.trim()
    : userEmail;

  return {
    fullName: fullName || userEmail,
    signatureUrl: String(data?.signature_url ?? ""),
  };
}

/**
 * Open a preview window with HTML content.
 * Opens the window synchronously (before async work) to avoid popup-blockers.
 * Returns the window reference. Caller should write HTML to it.
 */
export function openDocumentPreview(html: string): void {
  const previewWindow = window.open("about:blank", "_blank");
  if (!previewWindow) {
    alert("Please allow popups to view the document.");
    return;
  }
  previewWindow.document.open();
  previewWindow.document.write(html);
  previewWindow.document.close();
}

/**
 * Download HTML as a file.
 */
export function downloadHtmlDocument(html: string, filename: string): void {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
