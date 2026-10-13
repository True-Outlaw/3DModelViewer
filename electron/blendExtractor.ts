import * as fs from 'fs';
import * as path from 'path';

/**
 * Extracts embedded thumbnail from a Blender .blend file.
 * Blender stores preview thumbnails in a file block with code 'TEST' or 'REND'.
 * When outputDir and assetId are provided, writes directly to a disk file for maximum performance.
 */
export async function extractBlendThumbnail(
  filePath: string,
  outputDir?: string,
  assetId?: string
): Promise<string | null> {
  // Check if already extracted on disk
  if (outputDir && assetId) {
    for (const ext of ['.png', '.jpg', '.bmp']) {
      const existingPath = path.join(outputDir, `${assetId}${ext}`);
      if (fs.existsSync(existingPath)) {
        return `file://${existingPath.replace(/\\/g, '/')}`;
      }
    }
  }
  let fd: number | null = null;
  try {
    const stats = await fs.promises.stat(filePath);
    if (stats.size < 64) return null;

    fd = fs.openSync(filePath, 'r');

    // Read the 12-byte header
    const headerBuf = Buffer.alloc(12);
    fs.readSync(fd, headerBuf, 0, 12, 0);

    const magic = headerBuf.toString('ascii', 0, 7);
    if (magic !== 'BLENDER') {
      return null;
    }

    const is64Bit = headerBuf[7] === '-'.charCodeAt(0);
    const isLittleEndian = headerBuf[8] === 'v'.charCodeAt(0);
    const bheadSize = is64Bit ? 24 : 20;

    // Scan blocks up to the first 32MB (thumbnails are almost always in the first few blocks)
    const scanLimit = Math.min(stats.size, 32 * 1024 * 1024);
    let offset = 12;

    const bheadBuf = Buffer.alloc(bheadSize);

    while (offset + bheadSize < scanLimit) {
      fs.readSync(fd, bheadBuf, 0, bheadSize, offset);

      const code = bheadBuf.toString('ascii', 0, 4);
      const len = isLittleEndian
        ? bheadBuf.readUInt32LE(4)
        : bheadBuf.readUInt32BE(4);

      if (code === 'ENDB') {
        break; // End of blend blocks
      }

      if (code === 'TEST' || code === 'REND') {
        if (len < 8 || len > 16 * 1024 * 1024) {
          offset += bheadSize + len;
          continue;
        }

        const dataOffset = offset + bheadSize;
        const dataBuf = Buffer.alloc(Math.min(len, 8 * 1024 * 1024));
        fs.readSync(fd, dataBuf, 0, dataBuf.length, dataOffset);

        // Check for direct PNG or JPEG magic bytes
        if (dataBuf[0] === 0x89 && dataBuf[1] === 0x50 && dataBuf[2] === 0x4e && dataBuf[3] === 0x47) {
          if (outputDir && assetId) {
            const outPath = path.join(outputDir, `${assetId}.png`);
            await fs.promises.writeFile(outPath, dataBuf);
            return `file://${outPath.replace(/\\/g, '/')}`;
          }
          return `data:image/png;base64,${dataBuf.toString('base64')}`;
        }
        if (dataBuf[0] === 0xff && dataBuf[1] === 0xd8 && dataBuf[2] === 0xff) {
          if (outputDir && assetId) {
            const outPath = path.join(outputDir, `${assetId}.jpg`);
            await fs.promises.writeFile(outPath, dataBuf);
            return `file://${outPath.replace(/\\/g, '/')}`;
          }
          return `data:image/jpeg;base64,${dataBuf.toString('base64')}`;
        }

        // Standard Blender preview format: width (4 bytes), height (4 bytes), raw RGBA bottom-up
        const width = isLittleEndian ? dataBuf.readUInt32LE(0) : dataBuf.readUInt32BE(0);
        const height = isLittleEndian ? dataBuf.readUInt32LE(4) : dataBuf.readUInt32BE(4);

        if (width > 0 && width <= 1024 && height > 0 && height <= 1024) {
          const pixelBytes = width * height * 4;
          if (dataBuf.length >= 8 + pixelBytes) {
            // Encode raw RGBA into standard 32-bit BMP (BMP is natively bottom-up, exactly matching Blender's layout)
            const bmpHeaderSize = 54;
            const fileSize = bmpHeaderSize + pixelBytes;
            const bmp = Buffer.alloc(fileSize);

            // BITMAPFILEHEADER
            bmp.write('BM', 0, 2, 'ascii');
            bmp.writeUInt32LE(fileSize, 2);
            bmp.writeUInt32LE(0, 6);
            bmp.writeUInt32LE(bmpHeaderSize, 10);

            // BITMAPINFOHEADER
            bmp.writeUInt32LE(40, 14);
            bmp.writeInt32LE(width, 18);
            bmp.writeInt32LE(height, 22); // Positive height = bottom-up scanlines
            bmp.writeUInt16LE(1, 26);
            bmp.writeUInt16LE(32, 28); // 32 bpp
            bmp.writeUInt32LE(0, 30); // BI_RGB
            bmp.writeUInt32LE(pixelBytes, 34);
            bmp.writeInt32LE(2835, 38);
            bmp.writeInt32LE(2835, 42);
            bmp.writeUInt32LE(0, 46);
            bmp.writeUInt32LE(0, 50);

            // Convert RGBA to BGRA for BMP
            const srcOffset = 8;
            for (let i = 0; i < width * height; i++) {
              const srcIdx = srcOffset + i * 4;
              const dstIdx = bmpHeaderSize + i * 4;
              const r = dataBuf[srcIdx + 0];
              const g = dataBuf[srcIdx + 1];
              const b = dataBuf[srcIdx + 2];
              const a = dataBuf[srcIdx + 3];
              bmp[dstIdx + 0] = b;
              bmp[dstIdx + 1] = g;
              bmp[dstIdx + 2] = r;
              bmp[dstIdx + 3] = a;
            }

            if (outputDir && assetId) {
              const outPath = path.join(outputDir, `${assetId}.bmp`);
              await fs.promises.writeFile(outPath, bmp);
              return `file://${outPath.replace(/\\/g, '/')}`;
            }

            return `data:image/bmp;base64,${bmp.toString('base64')}`;
          }
        }
      }

      offset += bheadSize + len;
    }

    return null;
  } catch (err) {
    console.warn(`[BlendExtractor] Could not extract thumbnail from ${filePath}:`, err);
    return null;
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {}
    }
  }
}
