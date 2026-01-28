import React from 'react';
import { PendingOperation } from '../lib/db';

interface SyncConflictDialogProps {
  isOpen: boolean;
  conflicts: PendingOperation[];
  onDismiss: (opId: string) => void;
  onRetry: (opId: string) => void;
  onDismissAll: () => void;
  onClose: () => void;
}

const formatDate = (timestamp: number) => {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestamp));
};

const getEntityIcon = (entity: string) => {
  switch (entity) {
    case 'items': return '📦';
    case 'transactions': return '📋';
    case 'users': return '👤';
    case 'categories': return '📁';
    case 'contractors': return '👷';
    default: return '📄';
  }
};

const getActionLabel = (action: string) => {
  switch (action) {
    case 'create': return 'Create';
    case 'update': return 'Update';
    case 'delete': return 'Delete';
    case 'upsert': return 'Save';
    default: return action;
  }
};

const SyncConflictDialog: React.FC<SyncConflictDialogProps> = ({
  isOpen,
  conflicts,
  onDismiss,
  onRetry,
  onDismissAll,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-red-500 to-orange-500 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black">Sync Conflicts</h2>
              <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mt-1">
                {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} need resolution
              </p>
            </div>
            <button
              onClick={onClose}
              className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-colors"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Explanation */}
        <div className="px-6 py-4 bg-amber-50 border-b border-amber-100">
          <p className="text-sm text-amber-800">
            These changes couldn't be synced because the data was modified by another user or device. 
            You can <strong>retry</strong> to try again, or <strong>dismiss</strong> to discard your local change.
          </p>
        </div>

        {/* Conflicts List */}
        <div className="max-h-[40vh] overflow-y-auto divide-y divide-slate-100">
          {conflicts.map(op => (
            <div key={op.id} className="p-4 hover:bg-slate-50 transition-colors">
              <div className="flex items-start gap-3">
                <div className="text-2xl shrink-0">{getEntityIcon(op.entity)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-slate-900 capitalize">{op.entity}</span>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                      op.action === 'create' ? 'bg-emerald-100 text-emerald-700' :
                      op.action === 'update' ? 'bg-blue-100 text-blue-700' :
                      op.action === 'delete' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {getActionLabel(op.action)}
                    </span>
                  </div>
                  {op.error && (
                    <p className="text-xs text-red-600 mb-2">{op.error}</p>
                  )}
                  <p className="text-[10px] text-slate-400">
                    Attempted {formatDate(op.createdAt)}
                  </p>
                  {op.payload && (op.payload as Record<string, unknown>).name && (
                    <p className="text-xs text-slate-600 mt-1 truncate">
                      "{String((op.payload as Record<string, unknown>).name)}"
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => onRetry(op.id)}
                    className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                  >
                    Retry
                  </button>
                  <button
                    onClick={() => onDismiss(op.id)}
                    className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-800 transition-colors"
          >
            Close
          </button>
          {conflicts.length > 1 && (
            <button
              onClick={onDismissAll}
              className="px-4 py-2 text-sm font-bold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
            >
              Dismiss All ({conflicts.length})
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SyncConflictDialog;
