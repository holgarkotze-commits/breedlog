import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PDFQualitySelector } from "@/components/PDFQualitySelector";
import { type PDFQuality } from "@/lib/pdf-utils";
import { FileDown, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface PDFExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  onExport: (quality: PDFQuality) => Promise<void>;
  exportLabel?: string;
}

export function PDFExportDialog({
  open,
  onOpenChange,
  title,
  description,
  onExport,
  exportLabel = "Export PDF"
}: PDFExportDialogProps) {
  const [quality, setQuality] = useState<PDFQuality>('medium');
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');

  const handleExport = async () => {
    setIsExporting(true);
    setProgress(10);
    setProgressText('Preparing export...');
    
    try {
      await onExport(quality);
      setProgress(100);
      setProgressText('Complete!');
      setTimeout(() => {
        onOpenChange(false);
        setProgress(0);
        setProgressText('');
      }, 500);
    } catch (error) {
      console.error('Export failed:', error);
      setProgressText('Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-pdf-export">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>
        
        <div className="py-4">
          <PDFQualitySelector 
            value={quality} 
            onChange={setQuality}
          />
          
          {isExporting && (
            <div className="mt-4 space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">{progressText}</p>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
            data-testid="button-cancel-export"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleExport}
            disabled={isExporting}
            data-testid="button-confirm-export"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4 mr-2" />
                {exportLabel}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Simple hook for managing PDF export state
export function usePDFExportDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [exportType, setExportType] = useState<string>('');
  
  const openDialog = (type: string) => {
    setExportType(type);
    setIsOpen(true);
  };
  
  const closeDialog = () => {
    setIsOpen(false);
    setExportType('');
  };
  
  return {
    isOpen,
    exportType,
    openDialog,
    closeDialog,
    setIsOpen,
  };
}
