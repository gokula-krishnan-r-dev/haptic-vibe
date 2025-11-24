import React from 'react';

interface GenerationLoaderProps {
  /** Optional custom status message to display */
  status?: string;
}

/**
 * GenerationLoader - Professional loading overlay for AHAP generation
 * 
 * Displays a smooth animated spinner with status message during export operations
 */
export const GenerationLoader: React.FC<GenerationLoaderProps> = ({
  status = 'Optimizing Pattern Data...'
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm transition-all duration-300">
      <div className="flex flex-col items-center gap-6 p-8 rounded-2xl bg-gray-900/90 border border-gray-800 shadow-2xl transform scale-100 animate-in fade-in zoom-in duration-200">

        {/* Modern Spinner */}
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-gray-800"></div>
          <div className="absolute inset-0 rounded-full border-4 border-t-accent-cyan border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
          <div className="absolute inset-2 rounded-full border-4 border-gray-800"></div>
          <div className="absolute inset-2 rounded-full border-4 border-b-accent-magenta border-t-transparent border-r-transparent border-l-transparent animate-spin-reverse opacity-70"></div>
        </div>

        <div className="text-center space-y-2">
          <h3 className="text-xl font-bold text-white tracking-tight">Generating AHAP</h3>
          <p className="text-sm text-gray-400 font-mono animate-pulse">{status}</p>
        </div>
      </div>

      <style>{`
        @keyframes spin-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        .animate-spin-reverse {
          animation: spin-reverse 1.5s linear infinite;
        }
      `}</style>
    </div>
  );
};
