import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

interface ErrorDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  errorDetails: { message: string; details?: unknown; stack?: string } | null;
}

export function ErrorDetailsDialog({
  open,
  onOpenChange,
  errorDetails,
}: ErrorDetailsDialogProps) {
  // Inject style to make overlay non-interactive so page remains usable
  useEffect(() => {
    const styleId = 'error-dialog-overlay-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        [data-slot="dialog-overlay"] {
          pointer-events: none !important;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  if (!errorDetails) {
    return null;
  }

  // Always render Dialog component - let Radix handle visibility based on `open` prop

  return (
    <>
      {/* Fallback simple dialog - always visible when open */}
      {open && errorDetails && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 10002,
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            pointerEvents: 'none', // Allow clicks to pass through overlay
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '800px',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              zIndex: 10003,
              pointerEvents: 'auto', // Make dialog content interactive
              userSelect: 'text',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>Error Details</h2>
              <button
                onClick={() => onOpenChange(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '0 8px',
                }}
                aria-label="Close dialog"
              >
                ×
              </button>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'semibold', marginBottom: '8px' }}>Error Message</h3>
              <p style={{ fontSize: '14px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '4px', userSelect: 'text' }}>
                {errorDetails.message}
              </p>
            </div>
            {errorDetails.details != null && (
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'semibold', marginBottom: '8px' }}>Additional Details</h3>
                <pre style={{ fontSize: '12px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '4px', overflow: 'auto', userSelect: 'text', whiteSpace: 'pre-wrap' }}>
                  {String(JSON.stringify(errorDetails.details, null, 2))}
                </pre>
              </div>
            )}
            {errorDetails.stack && (
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 'semibold', marginBottom: '8px' }}>Stack Trace</h3>
                <pre style={{ fontSize: '12px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '4px', overflow: 'auto', maxHeight: '300px', userSelect: 'text', whiteSpace: 'pre-wrap' }}>
                  {errorDetails.stack}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
      <Dialog 
        open={open} 
        onOpenChange={onOpenChange}
      >
      <DialogContent 
        className="max-w-2xl max-h-[80vh] overflow-y-auto bg-background [&_*]:select-text"
        style={{ 
          zIndex: 10001,
          userSelect: 'text',
          WebkitUserSelect: 'text',
          MozUserSelect: 'text',
          msUserSelect: 'text',
          pointerEvents: 'auto',
        }}
        onInteractOutside={(e) => {
          // Prevent closing on outside click - only close via X button
          e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          // Prevent closing on Escape key - only close via X button
          e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Error Details</DialogTitle>
          <DialogDescription>
            Detailed information about the login error
          </DialogDescription>
        </DialogHeader>
        <div 
          className="space-y-4 select-text" 
          style={{ 
            userSelect: 'text',
            WebkitUserSelect: 'text',
            MozUserSelect: 'text',
            msUserSelect: 'text',
          }}
        >
          <div>
            <h4 className="text-sm font-semibold mb-2">Error Message</h4>
            <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md select-text">
              {errorDetails.message}
            </p>
          </div>
          
          {errorDetails.details ? (
            <div>
              <h4 className="text-sm font-semibold mb-2">Additional Details</h4>
              <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto select-text whitespace-pre-wrap">
                {String(JSON.stringify(errorDetails.details, null, 2))}
              </pre>
            </div>
          ) : null}
          
          {errorDetails.stack && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Stack Trace</h4>
              <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto max-h-60 overflow-y-auto select-text whitespace-pre-wrap">
                {errorDetails.stack}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

