/**
 * Shared storage upload helpers and document-info fetching utilities.
 */

import { supabase } from "@/lib/supabase";
import type { CompanyInfo, AdminInfo } from "@/lib/document-templates";

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

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true });

  if (uploadError) throw uploadError;

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
