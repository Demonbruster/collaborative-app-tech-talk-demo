import { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShare: (email: string) => void;
  email: string;
  onEmailChange: (email: string) => void;
}

export const ShareModal = ({ isOpen, onClose, onShare, email, onEmailChange }: ShareModalProps) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="fixed inset-0 bg-black bg-opacity-75 transition-opacity" />
        
        <div 
          className="relative bg-gray-900 rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-700"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-white" id="modal-title">
              Share Board
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-300"
              aria-label="Close"
            >
              <span className="text-2xl">&times;</span>
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                Email address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                placeholder="Enter email to share with"
                className="mt-1 block w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            
            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-800 text-gray-300 rounded-md hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => onShare(email)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors font-medium"
              >
                Share
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}; 