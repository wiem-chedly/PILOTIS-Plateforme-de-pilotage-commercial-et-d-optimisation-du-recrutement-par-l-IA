import React from 'react';
import { downloadCSV, downloadExcel, getFilenameWithDate } from '@/utils/exportUtils'

interface ExportButtonsProps {
  data: Array<{
    display_name: string;
    prospects: number;
    clients: number;
    partners: number;
    total: number;
  }>;
  month: string;
}

const ExportButtons: React.FC<ExportButtonsProps> = ({ data, month }) => {
  const handleExportCSV = () => {
    const filename = getFilenameWithDate(`statistiques-${month.replace(' ', '-')}`, 'csv');
    downloadCSV(data, filename);
  };

  const handleExportExcel = () => {
    const filename = getFilenameWithDate(`statistiques-${month.replace(' ', '-')}`, 'xlsx');
    downloadExcel(data, filename);
  };

  if (!data || data.length === 0) return null;

  return (
    <div className="flex gap-2">
      <button
        onClick={handleExportCSV}
        className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        CSV
      </button>
      <button
        onClick={handleExportExcel}
        className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
      >
        Excel
      </button>
    </div>
  );
};

export default ExportButtons;
