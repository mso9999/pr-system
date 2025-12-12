interface EnvironmentConfig {
  baseUrl: string;
  prSystemUrl: string; // PR System specific URL for notifications
  env: 'development' | 'staging' | 'production';
}

const configs: Record<string, EnvironmentConfig> = {
  development: {
    baseUrl: 'http://localhost:5173',
    prSystemUrl: 'https://pr.1pwrafrica.com', // Always use production URL for notifications
    env: 'development'
  },
  staging: {
    baseUrl: 'https://staging.1pwr.com',
    prSystemUrl: 'https://pr.1pwrafrica.com', // Always use production URL for notifications
    env: 'staging'
  },
  production: {
    baseUrl: 'https://app.1pwr.com',
    prSystemUrl: 'https://pr.1pwrafrica.com',
    env: 'production'
  }
};

export function getEnvironmentConfig(): EnvironmentConfig {
  const env = import.meta.env.VITE_APP_ENV || 'development';
  return configs[env];
}

/**
 * Get the PR System base URL for generating notification links
 * Always returns production URL regardless of environment
 */
export function getPRSystemUrl(): string {
  return 'https://pr.1pwrafrica.com';
}
