import { detectRuntimePlatform } from "@/lib/runtime-updates";

function isNativeDesktopRuntime() {
  return detectRuntimePlatform() === "windows";
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export async function saveFileInNativeDownloads(
  content: BlobPart,
  filename: string,
  type: string,
): Promise<string | null> {
  if (!isNativeDesktopRuntime()) {
    return null;
  }

  const runtimeWindow = window as Window & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };
  if (!runtimeWindow.__TAURI__ && !runtimeWindow.__TAURI_INTERNALS__) {
    return null;
  }

  const blob = new Blob([content], { type });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const bytesBase64 = bytesToBase64(bytes);
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("save_export_file", { filename, bytesBase64 });
}
