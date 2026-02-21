import { useState, useCallback, useRef } from 'react';
import { useGraphStore } from '../../store/graphStore.js';
import type { MarbleColor, PixelImage } from '../../simulation/types.js';
import { MARBLE_COLORS } from '../../simulation/types.js';

const COLOR_MAP: Record<MarbleColor, string> = {
  red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308',
  black: '#1e293b', white: '#f1f5f9', orange: '#f97316', purple: '#a855f7',
};

const RGB_VALUES: Record<MarbleColor, [number, number, number]> = {
  red: [239, 68, 68], blue: [59, 130, 246], green: [34, 197, 94], yellow: [234, 179, 8],
  black: [30, 41, 59], white: [241, 245, 249], orange: [249, 115, 22], purple: [168, 85, 247],
};

function nearestColor(r: number, g: number, b: number): MarbleColor {
  let best: MarbleColor = 'white';
  let bestDist = Infinity;
  for (const c of MARBLE_COLORS) {
    const [cr, cg, cb] = RGB_VALUES[c];
    const d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

export default function PixelEditor() {
  const targetImage = useGraphStore((s) => s.targetImage);
  const setTargetImage = useGraphStore((s) => s.setTargetImage);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState<MarbleColor>('black');
  const [gridWidth, setGridWidth] = useState(targetImage?.width ?? 16);
  const [gridHeight, setGridHeight] = useState(targetImage?.height ?? 16);
  const fileRef = useRef<HTMLInputElement>(null);

  const createBlankImage = useCallback(() => {
    const pixels: MarbleColor[][] = Array.from({ length: gridHeight }, () =>
      Array.from({ length: gridWidth }, () => 'white' as MarbleColor),
    );
    const img: PixelImage = {
      width: gridWidth,
      height: gridHeight,
      palette: [...MARBLE_COLORS],
      pixels,
    };
    setTargetImage(img);
  }, [gridWidth, gridHeight, setTargetImage]);

  const handleCellClick = useCallback((row: number, col: number) => {
    if (!targetImage) return;
    const newPixels = targetImage.pixels.map((r) => [...r]);
    if (newPixels[row]) {
      newPixels[row]![col] = selectedColor;
    }
    setTargetImage({ ...targetImage, pixels: newPixels });
  }, [targetImage, selectedColor, setTargetImage]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const w = Math.min(img.width, 128);
        const h = Math.min(img.height, 128);
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);

        const pixels: MarbleColor[][] = [];
        for (let y = 0; y < h; y++) {
          const row: MarbleColor[] = [];
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            row.push(nearestColor(imageData.data[i]!, imageData.data[i + 1]!, imageData.data[i + 2]!));
          }
          pixels.push(row);
        }

        setTargetImage({
          width: w,
          height: h,
          palette: [...MARBLE_COLORS],
          pixels,
        });
        setGridWidth(w);
        setGridHeight(h);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [setTargetImage]);

  const cellSize = targetImage
    ? Math.min(8, Math.floor(300 / Math.max(targetImage.width, targetImage.height)))
    : 8;

  return (
    <div style={{
      borderTop: '1px solid #e5e7eb',
      background: '#f9fafb',
      fontSize: 12,
    }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '6px 12px',
          background: 'none',
          border: 'none',
          color: '#374151',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {isOpen ? '▼' : '▶'} Pixel Image
        {targetImage && <span style={{ opacity: 0.6, marginLeft: 8 }}>{targetImage.width}×{targetImage.height}</span>}
      </button>
      {isOpen && (
        <div style={{ padding: '0 12px 12px' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <label>W: <input type="number" min={1} max={128} value={gridWidth} onChange={(e) => setGridWidth(+e.target.value)} style={{ width: 48 }} /></label>
            <label>H: <input type="number" min={1} max={128} value={gridHeight} onChange={(e) => setGridHeight(+e.target.value)} style={{ width: 48 }} /></label>
            <button onClick={createBlankImage} style={{ fontSize: 11 }}>New</button>
            <button onClick={() => fileRef.current?.click()} style={{ fontSize: 11 }}>Upload</button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
            {targetImage && <button onClick={() => setTargetImage(null)} style={{ fontSize: 11 }}>Clear</button>}
          </div>

          <div style={{ display: 'flex', gap: 3, marginBottom: 8 }}>
            {MARBLE_COLORS.map((c) => (
              <div
                key={c}
                onClick={() => setSelectedColor(c)}
                style={{
                  width: 16, height: 16, borderRadius: 3,
                  background: COLOR_MAP[c],
                  border: c === selectedColor ? '2px solid #000' : '1px solid #ccc',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>

          {targetImage && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${targetImage.width}, ${cellSize}px)`,
              gap: 0,
              border: '1px solid #d1d5db',
              width: 'fit-content',
            }}>
              {targetImage.pixels.flatMap((row, r) =>
                row.map((cell, c) => (
                  <div
                    key={`${r}-${c}`}
                    onClick={() => handleCellClick(r, c)}
                    style={{
                      width: cellSize, height: cellSize,
                      background: COLOR_MAP[cell],
                      cursor: 'pointer',
                    }}
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
