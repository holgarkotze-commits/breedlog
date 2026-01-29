import { useState, useEffect } from 'react';
import { usePWAInstall } from '@/hooks/use-pwa-install';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Download, Smartphone, X, Share, Plus } from 'lucide-react';

export function PWAInstallPrompt() {
  const { isInstalled, isInstallable, isIOS, promptInstall } = usePWAInstall();
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const hasBeenDismissed = localStorage.getItem('pwa-install-dismissed');
    if (hasBeenDismissed) {
      const dismissedTime = parseInt(hasBeenDismissed, 10);
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      if (dismissedTime > oneDayAgo) {
        setDismissed(true);
        return;
      }
    }

    const timer = setTimeout(() => {
      if ((isInstallable || isIOS) && !isInstalled && !dismissed) {
        setShowPrompt(true);
      }
    }, 30000);

    return () => clearTimeout(timer);
  }, [isInstallable, isIOS, isInstalled, dismissed]);

  const handleInstall = async () => {
    const success = await promptInstall();
    if (success) {
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  if (isInstalled || (!isInstallable && !isIOS) || dismissed) {
    return null;
  }

  return (
    <Dialog open={showPrompt} onOpenChange={setShowPrompt}>
      <DialogContent className="sm:max-w-md" data-testid="pwa-install-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" />
            Install BreedLog
          </DialogTitle>
          <DialogDescription>
            Install BreedLog on your device for offline access and a better experience.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {isIOS ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                To install on your iPhone or iPad:
              </p>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  Tap the <Share className="w-4 h-4 inline" /> Share button in Safari
                </li>
                <li className="flex items-center gap-2">
                  Scroll and tap <Plus className="w-4 h-4 inline" /> "Add to Home Screen"
                </li>
                <li>Tap "Add" to confirm</li>
              </ol>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Get faster access and work offline when you're in the field without signal.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  Works 100% offline
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  Opens instantly from home screen
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  Syncs automatically when online
                </li>
              </ul>
            </div>
          )}
          
          <div className="flex gap-2">
            {!isIOS && (
              <Button 
                onClick={handleInstall} 
                className="flex-1"
                data-testid="button-install-pwa"
              >
                <Download className="w-4 h-4 mr-2" />
                Install Now
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={handleDismiss}
              className={isIOS ? "flex-1" : ""}
              data-testid="button-dismiss-install"
            >
              {isIOS ? "Got it" : "Not Now"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function InstallButton() {
  const { isInstalled, isInstallable, isIOS, promptInstall } = usePWAInstall();

  if (isInstalled) {
    return (
      <Button variant="outline" size="sm" disabled data-testid="button-installed">
        <Download className="w-4 h-4 mr-2" />
        Installed
      </Button>
    );
  }

  if (!isInstallable && !isIOS) {
    return null;
  }

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={promptInstall}
      data-testid="button-install-app"
    >
      <Download className="w-4 h-4 mr-2" />
      Install App
    </Button>
  );
}
