
import React from 'react';
import { Transaction, InventoryItem } from '../types';
import { ArrowDown, ArrowUp, Timer, Download } from './Icons';

interface HistoryLogProps {
  transactions: Transaction[];
  items: InventoryItem[];
  onExport: () => void;
}

const HistoryLog: React.FC<HistoryLogProps> = ({ transactions, items, onExport }) => {
  const getItem = (id: string) => items.find(i => i.id === id);

  const formatTime = (ts: number) => {
    return new Intl.DateTimeFormat('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit' 
    }).format(new Date(ts));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-black text-slate-800">Recent Activity</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{transactions.length} total actions</p>
        </div>
        <button 
          onClick={onExport}
          className="p-3 bg-white border-2 border-slate-100 rounded-xl text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all sm:hidden"
        >
          <Download size={24} />
        </button>
      </div>

      <div className="space-y-4">
        {transactions.length > 0 ? transactions.map(tx => {
          const item = getItem(tx.itemId);
          return (
            <div key={tx.id} className="bg-white border-2 border-slate-50 p-5 sm:p-6 rounded-[24px] sm:rounded-[32px] flex flex-col sm:flex-row gap-4 sm:gap-6 items-start sm:items-center shadow-sm hover:shadow-md transition-shadow">
              <div className={`p-4 rounded-2xl shrink-0 self-start sm:self-center ${
                tx.type === 'IN' ? 'bg-indigo-50 text-indigo-600' : 
                tx.type === 'OUT' ? 'bg-slate-900 text-white' : 
                'bg-amber-50 text-amber-600'
              }`}>
                {tx.type === 'IN' && <ArrowDown size={28} />}
                {tx.type === 'OUT' && <ArrowUp size={28} />}
                {tx.type === 'WIP' && <Timer size={28} />}
              </div>
              
              <div className="flex-1 min-w-0 w-full">
                <div className="flex justify-between items-start mb-1">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{item?.category || 'General'}</span>
                    <h4 className="font-black text-lg sm:text-xl text-slate-800 truncate leading-tight">{item?.name || 'Deleted Item'}</h4>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-2xl font-black tabular-nums tracking-tighter ${
                      tx.type === 'IN' ? 'text-indigo-600' : 'text-slate-900'
                    }`}>
                      {tx.type === 'IN' ? '+' : '-'}{tx.quantity}
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">{item?.unit}</div>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 pt-4 border-t border-slate-50">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500 uppercase">
                      {tx.user.charAt(0)}
                    </div>
                    <span className="text-sm font-black text-slate-800">{tx.user}</span>
                  </div>
                  <div className="flex-1 min-w-[150px]">
                    <span className="text-xs font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg inline-block w-full truncate">
                      "{tx.reason}"
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-300 ml-auto tabular-nums">{formatTime(tx.timestamp)}</span>
                </div>
              </div>
            </div>
          );
        }) : (
          <div className="py-32 text-center bg-white border-2 border-dashed border-slate-100 rounded-[40px]">
            <p className="text-slate-300 font-black text-lg">LOGBOOK IS EMPTY</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryLog;
