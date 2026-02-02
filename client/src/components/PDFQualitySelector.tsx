import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type PDFQuality, getQualityLabel } from "@/lib/pdf-utils";
import { FileDown, Zap, Scale, Sparkles } from "lucide-react";

interface PDFQualitySelectorProps {
  value: PDFQuality;
  onChange: (value: PDFQuality) => void;
  className?: string;
}

export function PDFQualitySelector({ value, onChange, className }: PDFQualitySelectorProps) {
  return (
    <div className={className}>
      <Label className="text-sm font-medium mb-2 block">PDF Quality</Label>
      <Select value={value} onValueChange={(v) => onChange(v as PDFQuality)}>
        <SelectTrigger className="w-full" data-testid="select-pdf-quality">
          <SelectValue placeholder="Select quality" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="low" data-testid="select-quality-low">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-green-500" />
              <span>Low (Fast, Small File)</span>
            </div>
          </SelectItem>
          <SelectItem value="medium" data-testid="select-quality-medium">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-yellow-500" />
              <span>Medium (Balanced)</span>
            </div>
          </SelectItem>
          <SelectItem value="high" data-testid="select-quality-high">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-500" />
              <span>High (Best Quality)</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground mt-1">
        {value === 'low' && 'Smaller file size, faster export. Good for quick sharing.'}
        {value === 'medium' && 'Balanced quality and file size. Recommended for most uses.'}
        {value === 'high' && 'Best image quality, larger file size. Good for printing.'}
      </p>
    </div>
  );
}

interface PDFExportButtonProps {
  onClick: () => void;
  isLoading?: boolean;
  loadingText?: string;
  children?: React.ReactNode;
  className?: string;
}

export function PDFExportButton({ 
  onClick, 
  isLoading, 
  loadingText = "Generating PDF...", 
  children = "Export PDF",
  className 
}: PDFExportButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      data-testid="button-export-pdf"
    >
      {isLoading ? (
        <>
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>{loadingText}</span>
        </>
      ) : (
        <>
          <FileDown className="w-4 h-4" />
          <span>{children}</span>
        </>
      )}
    </button>
  );
}
