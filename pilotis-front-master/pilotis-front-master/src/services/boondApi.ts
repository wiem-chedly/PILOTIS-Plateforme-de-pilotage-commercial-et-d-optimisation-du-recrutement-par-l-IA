
const API_URL = 'http://localhost:5000'; 

export interface CompanyStats {
  display_name: string;
  prospects: number;
  clients: number;
  partners: number;
  total: number;
}

export async function fetchBoondStats() {
  try {
    console.log('Connexion à:', API_URL + '/api/stats');
    const response = await fetch(`${API_URL}/api/stats`);
    const data = await response.json();
    console.log('Données reçues:', data);
    return data;
  } catch (error) {
    console.error('Erreur de connexion:', error);
    return { stats: [] };
  }
}
