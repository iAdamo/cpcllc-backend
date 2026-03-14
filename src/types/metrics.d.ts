// types/index.ts
export type TimeGranularity = 'daily' | 'monthly';

export interface MetricsRequest {
  granularity: TimeGranularity;
  year: number;
  month?: number | null; // Required for daily view
}

export interface MetricsSummary {
  users: number; // Total all-time users
  clients: number; // Total all-time clients
  providers: number; // Total all-time providers
  activeProviders: number; // Currently active providers
  newUsers: number; // New users in selected period
  growthRate: number; // Percentage change vs previous period
}

export interface TimeSeriesDataPoint {
  date: string;
  label: string;
  users: number; // New users in this period (not cumulative)
  clients: number; // New clients in this period
  providers: number; // New providers in this period
  activeProviders: number; // New active providers in this period
}

export interface PeriodComparison {
  usersChange: number;
  clientsChange: number;
  providersChange: number;
  activeProvidersChange: number;
  newUsersChange: number;
  percentageChange: number;
}

export interface Insight {
  type: 'positive' | 'negative' | 'neutral';
  message: string;
  metric: string;
  value: number;
}

export interface MetricsResponse {
  summary: MetricsSummary;
  timeSeries: TimeSeriesDataPoint[];
  comparison: PeriodComparison;
  insights: Insight[];
}

export type TimeRange = '1d' | '7d' | '30d' | '90d' | '1y' | 'custom';
