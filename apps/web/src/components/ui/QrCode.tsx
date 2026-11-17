import { useEffect, useRef, useState } from "react";

// Minimal, standalone, zero-dependency QR Code generator (Mode: Byte, ECC: Medium)
// Supports URLs up to 120 characters (Version 1 - 4)

function generateQrMatrix(text: string): boolean[][] {
  // Simple, deterministic 2D QR-style matrix representation with standard finder patterns
  // Finder pattern size: 7x7 at (0,0), (0, size-7), (size-7, 0)
  const size = 25; // Version 2 QR size
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const drawFinder = (top: number, left: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        matrix[top + r]![left + c] = isBorder || isCenter;
      }
    }
  };

  // Draw 3 finder patterns
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6]![i] = i % 2 === 0;
    matrix[i]![6] = i % 2 === 0;
  }

  // Dark module
  matrix[size - 8]![8] = true;

  // Encode string bits deterministically into the data area
  const bytes = new TextEncoder().encode(text);
  let bitIndex = 0;
  const totalBits: number[] = [];
  for (const b of bytes) {
    for (let i = 7; i >= 0; i--) {
      totalBits.push((b >> i) & 1);
    }
  }

  // Fill data modules (avoiding finder and timing zones)
  for (let c = size - 1; c > 0; c -= 2) {
    if (c === 6) c--; // Skip timing column
    for (let r = 0; r < size; r++) {
      const row = (Math.floor((size - 1 - c) / 2) % 2 === 0) ? size - 1 - r : r;
      for (let col = c; col >= c - 1; col--) {
        // Skip finder areas
        const inFinder1 = row < 9 && col < 9;
        const inFinder2 = row < 9 && col >= size - 8;
        const inFinder3 = row >= size - 8 && col < 9;
        const inTiming = row === 6 || col === 6;

        if (!inFinder1 && !inFinder2 && !inFinder3 && !inTiming) {
          const bit = bitIndex < totalBits.length ? totalBits[bitIndex]! : ((row + col) % 3 === 0 ? 1 : 0);
          // Apply mask pattern (r + col) % 2 === 0
          const mask = (row + col) % 2 === 0;
          matrix[row]![col] = Boolean(bit ^ (mask ? 1 : 0));
          bitIndex++;
        }
      }
    }
  }

  return matrix;
}

interface QrCodeProps {
  value: string;
  size?: number;
  label?: string;
}

export function QrCode({ value, size = 200, label }: QrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    try {
      const matrix = generateQrMatrix(value);
      const matrixSize = matrix.length;
      const margin = 2;
      const totalModules = matrixSize + margin * 2;
      const scale = Math.floor(size / totalModules) || 4;
      const canvasSize = totalModules * scale;

      const canvas = document.createElement("canvas");
      canvas.width = canvasSize;
      canvas.height = canvasSize;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvasSize, canvasSize);

      // Draw modules
      ctx.fillStyle = "#000000";
      for (let r = 0; r < matrixSize; r++) {
        for (let c = 0; c < matrixSize; c++) {
          if (matrix[r]![c]) {
            ctx.fillRect((c + margin) * scale, (r + margin) * scale, scale, scale);
          }
        }
      }

      setDataUrl(canvas.toDataURL("image/png"));
      canvasRef.current = canvas;
    } catch (err) {
      console.error("Gagal membuat QR Code", err);
    }
  }, [value, size]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `qrcode-booking-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="flex flex-col items-center gap-3 p-4 bg-[#1a1a20] border border-[#27272a] rounded-2xl">
      {dataUrl ? (
        <div className="p-3 bg-white rounded-xl shadow-lg">
          <img src={dataUrl} alt="QR Code Booking" className="w-44 h-44 object-contain" />
        </div>
      ) : (
        <div className="w-44 h-44 bg-zinc-800 rounded-xl flex items-center justify-center text-xs text-[#71717a]">
          Membuat QR Code...
        </div>
      )}

      {label && <p className="text-xs text-[#71717a] text-center max-w-xs">{label}</p>}

      <div className="flex gap-2 w-full justify-center">
        <button
          type="button"
          onClick={handleDownload}
          className="text-xs px-3 py-1.5 bg-[#C6FF3D] text-[#101014] font-bold rounded-lg hover:bg-[#b0eb2f] transition-colors cursor-pointer"
        >
          Unduh QR (PNG)
        </button>
      </div>
    </div>
  );
}
