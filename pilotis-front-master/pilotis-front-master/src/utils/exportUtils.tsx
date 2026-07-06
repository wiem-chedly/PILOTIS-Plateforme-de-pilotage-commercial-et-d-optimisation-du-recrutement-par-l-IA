interface CompanyStat {
  display_name: string;
  prospects: number;
  clients: number;
  partners: number;
  total: number;
}

export const convertToCSV = (data: CompanyStat[]): string => {
  const headers = ['Société', 'Prospects', 'Clients', 'Partenaires', 'Total'];

  const rows = data.map(item => [
    item.display_name,
    item.prospects,
    item.clients,
    item.partners,
    item.total
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  return csvContent;
};

export const downloadCSV = (data: CompanyStat[], filename: string = 'statistiques.csv') => {
  const csv = convertToCSV(data);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const downloadExcel = (data: CompanyStat[], filename: string = 'statistiques.xlsx') => {
  downloadCSV(data, filename.replace('.xlsx', '.csv'));
};

export const getFilenameWithDate = (prefix: string = 'statistiques', extension: string = 'csv'): string => {
  const date = new Date();
  const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  return `${prefix}-${formattedDate}.${extension}`;
};
