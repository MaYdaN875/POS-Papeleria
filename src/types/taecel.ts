export interface TaecelProduct {
  id: string;
  name: string;
  type: 'recarga' | 'servicio';
  carrier: string;
  amount?: number; // Para recargas fijas
  logoUrl?: string;
  raw?: any; // Datos crudos tal como los manda Taecel (temporal, para diagnóstico)
}

export interface TaecelTransaction {
  id: string;
  date: string;
  product_id: string;
  amount: number;
  reference: string; // Número de teléfono o referencia de servicio
  status: 'pending' | 'success' | 'failed';
  authorization_code?: string;
  error_message?: string;
}

export interface TaecelBalance {
  available: number;
  last_updated: string;
}
