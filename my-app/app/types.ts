// User marker data type
export interface UserMarker {
  id: string;
  lat: number;
  lng: number;
  description: string;
  image?: string; // base64 image data
  createdAt: string;
}

