import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

interface ImageCropDialogProps {
  open: boolean;
  imageSrc: string | null;
  onCancel: () => void;
  onConfirm: (croppedBase64: string) => void;
}

const PREVIEW_WIDTH = 280;
const PORTRAIT_RATIO = 1.25;
const SQUARE_OUT = 1024;
const PORTRAIT_OUT_W = 1024;
const PORTRAIT_OUT_H = Math.round(PORTRAIT_OUT_W * PORTRAIT_RATIO);

interface DerivedCrop {
  outWidth: number;
  outHeight: number;
  previewWidth: number;
  previewHeight: number;
  drawX: number;
  drawY: number;
  drawWidth: number;
  drawHeight: number;
}

export function deriveCropGeometry(opts: {
  aspect: "square" | "portrait";
  naturalWidth: number;
  naturalHeight: number;
  zoom: number;
  offsetX: number;
  offsetY: number;
}): DerivedCrop {
  const previewWidth = PREVIEW_WIDTH;
  const previewHeight = opts.aspect === "square" ? PREVIEW_WIDTH : Math.round(PREVIEW_WIDTH * PORTRAIT_RATIO);
  const outWidth = opts.aspect === "square" ? SQUARE_OUT : PORTRAIT_OUT_W;
  const outHeight = opts.aspect === "square" ? SQUARE_OUT : PORTRAIT_OUT_H;
  const baseScale = Math.max(previewWidth / opts.naturalWidth, previewHeight / opts.naturalHeight);
  const drawScale = baseScale * opts.zoom;
  const drawWidth = opts.naturalWidth * drawScale;
  const drawHeight = opts.naturalHeight * drawScale;
  const drawX = (previewWidth - drawWidth) / 2 + opts.offsetX;
  const drawY = (previewHeight - drawHeight) / 2 + opts.offsetY;
  return { outWidth, outHeight, previewWidth, previewHeight, drawX, drawY, drawWidth, drawHeight };
}

export function ImageCropDialog({ open, imageSrc, onCancel, onConfirm }: ImageCropDialogProps) {
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [aspect, setAspect] = useState<"square" | "portrait">("square");
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef<{
    mode: "none" | "drag" | "pinch";
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
    startDistance: number;
    startZoom: number;
  }>({ mode: "none", startX: 0, startY: 0, startOffsetX: 0, startOffsetY: 0, startDistance: 0, startZoom: 1 });

  useEffect(() => {
    if (!imageSrc || !open) return;
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
    const img = new Image();
    img.onload = () => setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = imageSrc;
  }, [imageSrc, open]);

  const previewHeight = useMemo(() => {
    return aspect === "square" ? PREVIEW_WIDTH : Math.round(PREVIEW_WIDTH * PORTRAIT_RATIO);
  }, [aspect]);

  const handleConfirm = async () => {
    if (!imageSrc || !naturalSize.width || !naturalSize.height) return;
    const img = new Image();
    img.onload = () => {
      const geo = deriveCropGeometry({ aspect, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, zoom, offsetX, offsetY });
      const canvas = document.createElement("canvas");
      canvas.width = geo.outWidth;
      canvas.height = geo.outHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Map preview→canvas. The preview window is (0,0)-(previewW, previewH).
      // The image sits at preview coords (drawX,drawY) with size (drawW,drawH).
      // Multiplying every preview coordinate by scaleX/scaleY gives the
      // corresponding canvas coordinate.
      const scaleX = geo.outWidth / geo.previewWidth;
      const scaleY = geo.outHeight / geo.previewHeight;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, geo.outWidth, geo.outHeight);
      ctx.drawImage(
        img,
        geo.drawX * scaleX,
        geo.drawY * scaleY,
        geo.drawWidth * scaleX,
        geo.drawHeight * scaleY
      );

      onConfirm(canvas.toDataURL("image/jpeg", 0.9));
    };
    img.src = imageSrc;
  };

  const distance = (a: React.Touch, b: React.Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      gestureRef.current = {
        mode: "drag",
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        startOffsetX: offsetX,
        startOffsetY: offsetY,
        startDistance: 0,
        startZoom: zoom,
      };
    } else if (e.touches.length === 2) {
      gestureRef.current = {
        mode: "pinch",
        startX: 0,
        startY: 0,
        startOffsetX: offsetX,
        startOffsetY: offsetY,
        startDistance: distance(e.touches[0], e.touches[1]),
        startZoom: zoom,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    if (g.mode === "drag" && e.touches.length === 1) {
      const dx = e.touches[0].clientX - g.startX;
      const dy = e.touches[0].clientY - g.startY;
      setOffsetX(Math.max(-150, Math.min(150, g.startOffsetX + dx)));
      setOffsetY(Math.max(-180, Math.min(180, g.startOffsetY + dy)));
      e.preventDefault();
    } else if (g.mode === "pinch" && e.touches.length === 2 && g.startDistance > 0) {
      const dist = distance(e.touches[0], e.touches[1]);
      const scale = dist / g.startDistance;
      setZoom(Math.max(1, Math.min(3, g.startZoom * scale)));
      e.preventDefault();
    }
  };

  const handleTouchEnd = () => {
    // Reset the full gesture state so a stale startDistance from a prior pinch
    // can never feed into a subsequent gesture if touches start/end rapidly.
    gestureRef.current = { mode: "none", startX: 0, startY: 0, startOffsetX: 0, startOffsetY: 0, startDistance: 0, startZoom: 1 };
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crop Profile Photo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button type="button" variant={aspect === "square" ? "default" : "outline"} size="sm" onClick={() => setAspect("square")} data-testid="button-crop-aspect-square">
              Square
            </Button>
            <Button type="button" variant={aspect === "portrait" ? "default" : "outline"} size="sm" onClick={() => setAspect("portrait")} data-testid="button-crop-aspect-portrait">
              Portrait
            </Button>
          </div>

          <div className="rounded-md border bg-muted/30 p-2 flex items-center justify-center">
            <div
              ref={previewFrameRef}
              className="overflow-hidden rounded-md bg-black/70 relative touch-none select-none"
              style={{ width: PREVIEW_WIDTH, height: previewHeight }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              data-testid="crop-preview-frame"
            >
              {imageSrc && (
                <img
                  src={imageSrc}
                  alt="Crop preview"
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  style={{ transform: `translate(${offsetX}px, ${offsetY}px) scale(${zoom})` }}
                  draggable={false}
                />
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Drag to position · Pinch to zoom · or use the sliders below
          </p>

          <div className="space-y-2">
            <Label>Zoom</Label>
            <Slider value={[zoom]} min={1} max={3} step={0.05} onValueChange={(v) => setZoom(v[0] ?? 1)} data-testid="slider-crop-zoom" />
          </div>
          <div className="space-y-2">
            <Label>Horizontal</Label>
            <Slider value={[offsetX]} min={-150} max={150} step={1} onValueChange={(v) => setOffsetX(v[0] ?? 0)} data-testid="slider-crop-x" />
          </div>
          <div className="space-y-2">
            <Label>Vertical</Label>
            <Slider value={[offsetY]} min={-180} max={180} step={1} onValueChange={(v) => setOffsetY(v[0] ?? 0)} data-testid="slider-crop-y" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onCancel} data-testid="button-crop-cancel">Cancel</Button>
            <Button type="button" onClick={handleConfirm} data-testid="button-crop-confirm">Use Crop</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
