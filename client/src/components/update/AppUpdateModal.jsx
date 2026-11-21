import { useState, useEffect } from 'react';
import { Browser } from '@capacitor/browser';
import { DownloadCloud, Sparkles, AlertTriangle, CheckCircle2, ChevronRight, X } from 'lucide-react';
import { checkForAppUpdate, postponeUpdate } from '../../lib/appUpdateService';
import { Button } from '../ui';

export default function AppUpdateModal() {
  const [updateData, setUpdateData] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let mounted = true;
    // Delay check by 1.2s so initial route and auth load smoothly
    const timer = setTimeout(async () => {
      try {
        const res = await checkForAppUpdate();
        if (mounted && res?.isUpdateAvailable) {
          setUpdateData(res);
          setIsOpen(true);
        }
      } catch (_e) {}
    }, 1200);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, []);

  if (!isOpen || !updateData) return null;

  const isMandatory = updateData.isMandatory;

  async function handleDownload() {
    setDownloading(true);
    try {
      const targetUrl = updateData.downloadUrl;
      if (targetUrl) {
        try {
          await Browser.open({ url: targetUrl });
        } catch (_bErr) {
          window.open(targetUrl, '_system');
        }
      }
    } catch (err) {
      console.warn('[AppUpdateModal] Download action warning:', err);
    } finally {
      setTimeout(() => setDownloading(false), 2000);
    }
  }

  function handleDismiss() {
    if (isMandatory) return;
    postponeUpdate();
    setIsOpen(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-surface border border-line rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5 animate-scale-up">
        {/* Close Button (only if not mandatory) */}
        {!isMandatory && (
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-muted hover:text-ink hover:bg-bg transition-colors"
            title="Remind me later"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Header with Icon */}
        <div className="flex items-start gap-3.5">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
            isMandatory
              ? 'bg-absent/15 text-absent border border-absent/30'
              : 'bg-brand/15 text-brand border border-brand/30'
          }`}>
            {isMandatory ? <AlertTriangle className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold font-display text-ink tracking-tight">
                {isMandatory ? 'Critical Update Required' : 'App Update Available'}
              </h3>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                isMandatory
                  ? 'bg-absent/15 text-absent border border-absent/25'
                  : 'bg-brand/15 text-brand border border-brand/25'
              }`}>
                v{updateData.latestVersion}
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Current: <span className="font-mono text-ink">v{updateData.installedVersion}</span> · Size: ~{updateData.apkSizeMb} MB
            </p>
          </div>
        </div>

        {/* Release Notes Card */}
        {updateData.releaseNotes && updateData.releaseNotes.length > 0 && (
          <div className="rounded-xl bg-bg border border-line p-3.5 space-y-2">
            <p className="text-xs font-semibold text-ink flex items-center gap-1.5">
              <span>What&apos;s New in this update:</span>
            </p>
            <ul className="space-y-1.5">
              {updateData.releaseNotes.map((note, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-muted leading-relaxed">
                  <CheckCircle2 className="w-3.5 h-3.5 text-present shrink-0 mt-0.5" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Mandatory warning text */}
        {isMandatory && (
          <p className="text-xs text-absent font-medium bg-absent/10 border border-absent/25 rounded-xl p-2.5 text-center">
            ⚠️ This is a required update. Please update to continue using the SMDL Attendance portal.
          </p>
        )}

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <Button
            variant="primary"
            size="md"
            onClick={handleDownload}
            loading={downloading}
            disabled={downloading}
            className="w-full font-semibold shadow-md flex items-center justify-center gap-2"
          >
            <DownloadCloud className="w-4 h-4" />
            <span>Download &amp; Update Now</span>
            <ChevronRight className="w-4 h-4 ml-auto" />
          </Button>

          {!isMandatory && (
            <button
              type="button"
              onClick={handleDismiss}
              className="w-full py-2 text-xs text-muted hover:text-ink font-medium text-center transition-colors cursor-pointer"
            >
              Remind Me Tomorrow
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
