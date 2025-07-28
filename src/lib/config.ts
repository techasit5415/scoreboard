import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

// Get API base URL from environment variables
export function getApiBaseUrl(): string {
  // Try private env first (server-side)
  if (env.VITE_API_BASE_URL) {
    return env.VITE_API_BASE_URL;
  }
  
  // Try public env (client-side)
  if (publicEnv.PUBLIC_API_BASE_URL) {
    return publicEnv.PUBLIC_API_BASE_URL;
  }
  
  // Fallback to localhost
  return 'http://localhost:3000';
}

// Check if running on the same machine as the API
export function getLocalApiUrl(): string {
  // You can change this to match your setup
  const possibleUrls = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://10.1.1.5:3000', // example private IP
    'http://10.1.1.2:3000'  // example private IP
  ];
  
  // For now, return the first one
  // In a production environment, you might want to test connectivity
  return possibleUrls[0];
}
