/**
 * Image → re-encoded image (sandbox side), with sharp/libvips. The upload is decoded to pixels and written out again
 * in the same format, which drops EXIF/XMP/IPTC/ICC metadata (sharp writes none unless asked) and anything a polyglot
 * hid after the image data. The EXIF orientation is applied to the pixels first, so stripping it does not rotate the
 * picture. No text is read from the image here: OCR is a separate adapter that does not exist yet (OQ-14), and the
 * result says so (`ocr_unavailable`).
 *
 * libvips is native code, so this is the one parser that needs `--allow-addons`. Node's permission model does not
 * confine native code; see docs/reports/2026-11-14_B12_B13_SECURE_DOCUMENT_PIPELINE_REPORT.md §3 for what that means and what a deployment must add.
 */
import {
  SandboxReject,
  type ImageResult,
  type SandboxLimits,
  type SandboxModules,
} from "./protocol.mts";

type ImageFormat = "jpeg" | "png" | "webp";

interface SharpMetadata {
  readonly format?: string;
  readonly width?: number;
  readonly height?: number;
  readonly pages?: number;
  readonly orientation?: number;
}

interface SharpInstance {
  metadata(): Promise<SharpMetadata>;
  rotate(): SharpInstance;
  jpeg(options: Record<string, unknown>): SharpInstance;
  png(options: Record<string, unknown>): SharpInstance;
  webp(options: Record<string, unknown>): SharpInstance;
  toFile(path: string): Promise<{ size: number; width: number; height: number; format: string }>;
}

type SharpFactory = ((input: string, options: Record<string, unknown>) => SharpInstance) & {
  cache(options: boolean): void;
  concurrency(threads: number): void;
};

export async function reencodeImageFile(
  inputPath: string,
  outputPath: string | null,
  expected: ImageFormat,
  limits: SandboxLimits,
  modules: SandboxModules,
): Promise<ImageResult> {
  if (modules.sharpUrl === null || outputPath === null) {
    throw new Error("image encoder module or output path was not provided");
  }
  const sharp = ((await import(modules.sharpUrl)) as { default: SharpFactory }).default;
  sharp.cache(false);
  sharp.concurrency(1);

  const open = (): SharpInstance =>
    sharp(inputPath, {
      limitInputPixels: limits.maxImagePixels,
      failOn: "error",
      sequentialRead: true,
      animated: false,
      pages: 1,
    });

  let meta: SharpMetadata;
  try {
    meta = await open().metadata();
  } catch {
    throw new SandboxReject("corrupt_file", "image could not be decoded");
  }
  if (meta.format !== expected) {
    throw new SandboxReject(
      "type_mismatch",
      `image decodes as ${String(meta.format).slice(0, 16)}`,
    );
  }
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width < 1 || height < 1) throw new SandboxReject("corrupt_file", "image has no pixels");
  if (width * height > limits.maxImagePixels) {
    throw new SandboxReject("image_too_large", `${width}x${height} pixels`);
  }

  const flags = ["metadata_stripped", "ocr_unavailable"];
  if ((meta.pages ?? 1) > 1) flags.push("animation_dropped");

  const upright = open().rotate();
  const encoded =
    expected === "jpeg"
      ? upright.jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
      : expected === "png"
        ? upright.png({ compressionLevel: 9 })
        : upright.webp({ quality: 92 });
  let info: { size: number; width: number; height: number };
  try {
    info = await encoded.toFile(outputPath);
  } catch (err) {
    if (/pixel limit/i.test((err as Error).message)) {
      throw new SandboxReject("image_too_large", "pixel limit");
    }
    throw new SandboxReject("corrupt_file", "image could not be re-encoded");
  }
  if (info.size > limits.maxOutputBytes) {
    throw new SandboxReject("output_too_large", `re-encoded image is ${info.size} bytes`);
  }
  return {
    kind: "image",
    format: expected,
    width: info.width,
    height: info.height,
    outputBytes: info.size,
    flags: flags.sort(),
  };
}
