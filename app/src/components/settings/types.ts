export interface SettingsData {
  appPassword: string;
  enableTldraw: string;
  enableLinking: string;
  corsOrigins: string;
  storageBackend: string;
  minioEndpointUrl: string;
  minioAccessKey: string;
  minioSecretKey: string;
  minioBucket: string;
  minioRegion: string;
  minioPrefix: string;
  groqApiKey: string;
  hasPassword: boolean;
  hasGroqKey: boolean;
  hasMinioCredentials: boolean;
}

export interface ObsidianImportResult {
  imported: number;
  skipped: number;
  folders: number;
}

export interface TemplateItem {
  id: string;
  name: string;
  type: string;
  createdAt: string;
}
