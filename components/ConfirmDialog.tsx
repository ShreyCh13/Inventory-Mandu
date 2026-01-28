import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export const useConfirm = (): ((options: ConfirmOptions) => Promise<boolean>) => {
  const context = useContext(ConfirmContext);
  if (!context) {
    // Fallback to native confirm if not wrapped in provider
    return async (options: ConfirmOptions) => window.confirm(`${options.title}\n\n${options.message}`);
  }
  return context.confirm;
};

interface ConfirmDialogProviderProps {
  children: ReactNode;
}

interface DialogState extends ConfirmOptions {
  isOpen: boolean;
  resolve: ((value: boolean) => void) | null;
}

export const ConfirmDialogProvider: React.FC<ConfirmDialogProviderProps> = ({ children }) => {
  const [dialog, setDialog] = useState<DialogState>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    variant: 'danger',
    resolve: null
  });

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialog({
        isOpen: true,
        title: options.title,
        message: options.message,
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        variant: options.variant || 'danger',
        resolve
      });
    });
  }, []);

  const handleClose = (result: boolean) => {
    dialog.resolve?.(result);
    setDialog(prev => ({ ...prev, isOpen: false, resolve: null }));
  };

  const variantStyles = {
    danger: {
      icon: '🗑️',
      confirmBg: 'bg-red-600 hover:bg-red-700',
      confirmShadow: 'shadow-red-200'
    },
    warning: {
      icon: '⚠️',
      confirmBg: 'bg-amber-600 hover:bg-amber-700',
      confirmShadow: 'shadow-amber-200'
    },
    info: {
      icon: 'ℹ️',
      confirmBg: 'bg-indigo-600 hover:bg-indigo-700',
      confirmShadow: 'shadow-indigo-200'
    }
  };

  const styles = variantStyles[dialog.variant || 'danger'];

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      
      {/* Dialog Overlay */}
      {dialog.isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => handleClose(false)}
        >
          <div 
            className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center text-2xl">
                {styles.icon}
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">
                {dialog.title}
              </h3>
              <p className="text-slate-500 text-sm">
                {dialog.message}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 p-4 bg-slate-50 border-t border-slate-100">
              <button
                onClick={() => handleClose(false)}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-600 bg-white border-2 border-slate-200 hover:bg-slate-100 transition-all"
              >
                {dialog.cancelText}
              </button>
              <button
                onClick={() => handleClose(true)}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-white ${styles.confirmBg} shadow-lg ${styles.confirmShadow} transition-all`}
              >
                {dialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export default ConfirmDialogProvider;
