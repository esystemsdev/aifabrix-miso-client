import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { ErrorDetails } from '../types';

/**
 * Props for ErrorDetailsDialog component
 */
interface ErrorDetailsDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Error details to display */
  errorDetails: ErrorDetails | null;
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

  return (
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
  );
}

