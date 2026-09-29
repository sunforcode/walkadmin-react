import { BlobReader, ZipReader } from '@zip.js/zip.js';

export const MAX_KML_BYTES = 20 * 1024 * 1024;

/** Prepare the existing KML upload contract without rewriting track data. */
export async function prepareKmlUpload(file) {
  if (!/\.kmz$/i.test(file.name)) return file;

  // BlobReader reads byte ranges; photos are never decompressed or buffered.
  const reader = new ZipReader(new BlobReader(file), { useWebWorkers: false });
  try {
    const entries = await reader.getEntries();
    const candidates = entries.filter((entry) => !entry.directory && /\.kml$/i.test(entry.filename));
    const mainDocuments = candidates.filter((entry) => entry.filename.toLowerCase() === 'doc.kml');
    if (mainDocuments.length > 1) throw new Error('KMZ 包含多个 doc.kml 主文档，请确认输入');
    if (!candidates.length) throw new Error('KMZ 中未找到 KML 轨迹原文');
    if (!mainDocuments.length && candidates.length > 1) {
      throw new Error('KMZ 包含多个 KML 且无法确定主文档，请单独提供需要分析的 KML');
    }

    const entry = mainDocuments[0] || candidates[0];
    if (entry.encrypted) throw new Error('不支持加密 KMZ 轨迹，请提供未加密的文件');
    if (entry.uncompressedSize > MAX_KML_BYTES) throw new Error('KMZ 中的 KML 超过 20MiB 限制');

    const chunks = [];
    let size = 0;
    await entry.getData(new WritableStream({
      write(chunk) {
        size += chunk.byteLength;
        if (size > MAX_KML_BYTES) throw new Error('KMZ 中的 KML 超过 20MiB 限制');
        chunks.push(chunk);
      },
    }), { checkCrc32: true });
    if (!size) throw new Error('KMZ 中的 KML 内容为空');

    return new File(chunks, file.name.replace(/\.kmz$/i, '.kml'), {
      type: 'application/vnd.google-earth.kml+xml',
      lastModified: file.lastModified,
    });
  } catch (error) {
    if (error.message?.includes('KMZ')) throw error;
    throw new Error('无法解析 KMZ，请检查文件是否损坏或使用了不支持的压缩格式', { cause: error });
  } finally {
    await reader.close();
  }
}
