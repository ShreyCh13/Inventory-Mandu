
import React, { useState } from 'react';
import { InventoryItem } from '../types';
import { Trash } from './Icons';

interface ItemManagerProps {
  items: InventoryItem[];
  onAdd: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
}

const ItemManager: React.FC<ItemManagerProps> = ({ items, onDelete }) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    if (confirmDeleteId === id) {
      onDelete(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
      // Reset confirmation after 4 seconds
      setTimeout(() => setConfirmDeleteId(null), 4000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[32px] border-2 border-slate-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 border-b-2 border-slate-100">
              <tr>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Name / Units</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest hidden sm:table-cell">Folder</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-50">
              {items.map(item => (
                <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-6">
                    <div className="font-black text-slate-900 text-lg sm:text-xl leading-tight">{item.name}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">
                      Tracking: {item.unit} • Alert at {item.minStock}
                    </div>
                  </td>
                  <td className="px-6 py-6 hidden sm:table-cell">
                    <span className="text-xs font-black px-3 py-1.5 bg-indigo-50 rounded-lg text-indigo-600 border border-indigo-100 uppercase">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-6 py-6 text-right">
                    <button 
                      onClick={() => handleDelete(item.id)}
                      className={`min-h-[50px] min-w-[140px] px-5 py-2.5 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 ml-auto ${
                        confirmDeleteId === item.id 
                        ? 'bg-rose-600 text-white animate-pulse shadow-lg shadow-rose-200' 
                        : 'text-rose-500 bg-rose-50 hover:bg-rose-100'
                      }`}
                    >
                      {confirmDeleteId === item.id ? (
                        'CONFIRM DELETE'
                      ) : (
                        <>
                          <Trash size={18} />
                          <span>DELETE</span>
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-20 text-center text-slate-300 font-black italic">
                    NO ITEMS IN CATALOG
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="bg-amber-50 border-2 border-amber-100 p-6 rounded-3xl text-amber-800">
        <p className="text-sm font-bold leading-relaxed">
          <span className="font-black underline">Note:</span> To add new items, use the 
          <span className="font-black"> "Receive Stock"</span> button on the main Dashboard. 
          This keeps your records and catalog updated at the same time.
        </p>
      </div>
    </div>
  );
};

export default ItemManager;
