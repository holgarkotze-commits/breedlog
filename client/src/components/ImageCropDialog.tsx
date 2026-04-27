import { useEffect, useMemo, useState } from "react";
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

const CROP_SIZE = 280;

export function ImageCropDialog({ open, imageSrc, onCancel, onConfirm }: ImageCropDialogProps) {
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [aspect, setAspect] = useState<"square" | "portrait">("square");
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!imageSrc || !open) return;
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
    const img = new Image();
    img.onload = () => setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = imageSrc;
  }, [imageSrc, open]);

  const cropHeight = useMemo(() => {
    return aspect === "square" ? CROP_SIZE : Math.round(CROP_SIZE * 1.25);
  }, [aspect]);

  const handleConfirm = async () => {
    if (!imageSrc || !naturalSize.width || !naturalSize.height) return;
    const img = new Image();
    img.onload = () => {
      const outWidth = aspect === "square" ? 1024 : 960;
      const outHeight = aspect === "square" ? 1024 : 1280;
      const canvas = document.createElement("canvas");
      canvas.width = outWidth;
      canvas.height = outHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const previewWidth = CROP_SIZE;
      const previewHeight = cropHeight;
      const baseScale = Math.max(previewWidth / img.naturalWidth, previewHeight / img.naturalHeight);
      const drawScale = baseScale * zoom;
      const drawWidth = img.naturalWidth * drawScale;
      const drawHeight = img.naturalHeight * drawScale;
      const drawX = (previewWidth - drawWidth) / 2 + offsetX;
      const drawY = (previewHeight - drawHeight) / 2 + offsetY;

      ctx.drawImage(
        img,
        ((-drawX) / previewWidth) * outWidth,
        ((-drawY) / previewHeight) * outHeight,
        (img.naturalWidth / drawWidth) * outWidth,
        (img.naturalHeight / drawHeight) * outHeight
      );

      onConfirm(canvas.toDataURL("image/jpeg", 0.9));
    };
    img.src = imageSrc;
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Crop Profile Photo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button type="button" variant={aspect === "square" ? "default" : "outline"} size="sm" onClick={() => setAspect("square")}>
              Square
            </Button>
            <Button type="button" variant={aspect === "portrait" ? "default" : "outline"} size="sm" onClick={() => setAspect("portrait")}>
              Portrait
            </Button>
          </div>

          <div className="rounded-md border bg-muted/30 p-2 flex items-center justify-center">
            <div className="overflow-hidden rounded-md bg-black/70 relative" style={{ width: CROP_SIZE, height: cropHeight }}>
              {imageSrc && (
                <img
                  src={imageSrc}
                  alt="Crop preview"
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ transform: `translate(${offsetX}px, ${offsetY}px) scale(${zoom})` }}
                />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Zoom</Label>
            <Slider value={[zoom]} min={1} max={3} step={0.05} onValueChange={(v) => setZoom(v[0] ?? 1)} />
          </div>
          <div className="space-y-2">
            <Label>Horizontal</Label>
            <Slider value={[offsetX]} min={-120} max={120} step={1} onValueChange={(v) => setOffsetX(v[0] ?? 0)} />
          </div>
          <div className="space-y-2">
            <Label>Vertical</Label>
            <Slider value={[offsetY]} min={-120} max={120} step={1} onValueChange={(v) => setOffsetY(v[0] ?? 0)} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="button" onClick={handleConfirm}>Use Crop</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
