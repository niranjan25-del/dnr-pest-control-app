// src/modules/addresses/interfaces/index.ts

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress?: string;
  normalized?: {
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
}

export interface EligibilityResult {
  address_id: string;
  postal_code: string;
  covered: boolean;
  areas: { id: string; name: string }[];
  coordinates: { latitude: number; longitude: number } | null;
}
