export type ServiceName = 'website' | 'management' | 'api';

export interface HealthResponse {
  service: ServiceName;
  status: 'ok';
  timestamp: string;
}
