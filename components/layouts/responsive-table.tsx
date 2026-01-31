'use client';

import { ReactNode } from 'react';

interface ResponsiveTableProps {
  headers: string[];
  rows: ReactNode[][];
  className?: string;
}

export function ResponsiveTable({ headers, rows, className = '' }: ResponsiveTableProps) {
  return (
    <>
      {/* Desktop table view */}
      <div className="hidden md:block overflow-x-auto">
        <table className={`w-full text-sm ${className}`}>
          <thead>
            <tr className="border-b">
              {headers.map((header, idx) => (
                <th key={idx} className="text-left p-2 font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx} className="border-b hover:bg-gray-50">
                {row.map((cell, cellIdx) => (
                  <td key={cellIdx} className="p-2">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card view */}
      <div className="md:hidden space-y-4">
        {rows.map((row, rowIdx) => (
          <div key={rowIdx} className="border rounded-lg p-4 bg-white space-y-2">
            {headers.map((header, cellIdx) => (
              <div key={cellIdx} className="flex flex-col">
                <span className="text-xs font-medium text-gray-500 mb-1">{header}</span>
                <span className="text-sm">{row[cellIdx]}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

