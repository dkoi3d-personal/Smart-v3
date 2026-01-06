/**
 * Mock Google Analytics Data API Generator
 *
 * Generates realistic mock data that mimics the GA4 Data API responses.
 * Based on: https://developers.google.com/analytics/devguides/reporting/data/v1
 */

// ============================================================================
// TYPES
// ============================================================================

export type MetricType =
  | 'METRIC_TYPE_UNSPECIFIED'
  | 'TYPE_INTEGER'
  | 'TYPE_FLOAT'
  | 'TYPE_SECONDS'
  | 'TYPE_MILLISECONDS'
  | 'TYPE_MINUTES'
  | 'TYPE_HOURS'
  | 'TYPE_STANDARD'
  | 'TYPE_CURRENCY'
  | 'TYPE_FEET'
  | 'TYPE_MILES'
  | 'TYPE_METERS'
  | 'TYPE_KILOMETERS';

export type BlockedReason = 'BLOCKED_REASON_UNSPECIFIED' | 'NO_REVENUE_METRICS' | 'NO_COST_METRICS';
export type Compatibility = 'COMPATIBILITY_UNSPECIFIED' | 'COMPATIBLE' | 'INCOMPATIBLE';
export type RestrictedMetricType = 'RESTRICTED_METRIC_TYPE_UNSPECIFIED' | 'COST_DATA' | 'REVENUE_DATA';

export interface DimensionMetadata {
  apiName: string;
  uiName: string;
  description: string;
  category: string;
  customDefinition: boolean;
  deprecatedApiNames: string[];
}

export interface MetricMetadata {
  apiName: string;
  uiName: string;
  description: string;
  category: string;
  customDefinition: boolean;
  deprecatedApiNames: string[];
  type: MetricType;
  expression: string;
  blockedReasons: BlockedReason[];
}

export interface QuotaStatus {
  consumed: number;
  remaining: number;
}

export interface PropertyQuota {
  tokensPerDay: QuotaStatus;
  tokensPerHour: QuotaStatus;
  concurrentRequests: QuotaStatus;
  serverErrorsPerProjectPerHour: QuotaStatus;
  potentiallyThresholdedRequestsPerHour: QuotaStatus;
  tokensPerProjectPerHour: QuotaStatus;
}

// ============================================================================
// MOCK DATA DEFINITIONS
// ============================================================================

export const DIMENSIONS: DimensionMetadata[] = [
  { apiName: 'country', uiName: 'Country', description: 'The country from which user activity originated.', category: 'Geography', customDefinition: false, deprecatedApiNames: [] },
  { apiName: 'city', uiName: 'City', description: 'The city from which user activity originated.', category: 'Geography', customDefinition: false, deprecatedApiNames: [] },
  { apiName: 'deviceCategory', uiName: 'Device Category', description: 'The type of device: Desktop, Tablet, or Mobile.', category: 'Platform / Device', customDefinition: false, deprecatedApiNames: [] },
  { apiName: 'browser', uiName: 'Browser', description: 'The browsers used to view your website.', category: 'Platform / Device', customDefinition: false, deprecatedApiNames: [] },
  { apiName: 'operatingSystem', uiName: 'Operating System', description: 'The operating systems used by visitors to your app or website.', category: 'Platform / Device', customDefinition: false, deprecatedApiNames: [] },
  { apiName: 'pagePath', uiName: 'Page Path', description: 'The URL path of the page.', category: 'Page / Screen', customDefinition: false, deprecatedApiNames: [] },
  { apiName: 'pageTitle', uiName: 'Page Title', description: 'The title of the page.', category: 'Page / Screen', customDefinition: false, deprecatedApiNames: [] },
  { apiName: 'eventName', uiName: 'Event Name', description: 'The name of the event.', category: 'Event', customDefinition: false, deprecatedApiNames: [] },
  { apiName: 'sessionSource', uiName: 'Session Source', description: 'The source that initiated a session.', category: 'Traffic Source', customDefinition: false, deprecatedApiNames: [] },
  { apiName: 'sessionMedium', uiName: 'Session Medium', description: 'The medium that initiated a session.', category: 'Traffic Source', customDefinition: false, deprecatedApiNames: [] },
  { apiName: 'date', uiName: 'Date', description: 'The date of the event, formatted as YYYYMMDD.', category: 'Time', customDefinition: false, deprecatedApiNames: [] },
  { apiName: 'hour', uiName: 'Hour', description: 'The hour of the day (0-23).', category: 'Time', customDefinition: false, deprecatedApiNames: [] },
  { apiName: 'newVsReturning', uiName: 'New / Returning', description: 'New or returning users.', category: 'User', customDefinition: false, deprecatedApiNames: [] },
  { apiName: 'userAgeBracket', uiName: 'Age', description: 'User age brackets.', category: 'Demographics', customDefinition: false, deprecatedApiNames: [] },
  { apiName: 'userGender', uiName: 'Gender', description: 'User gender.', category: 'Demographics', customDefinition: false, deprecatedApiNames: [] },
];

export const METRICS: MetricMetadata[] = [
  { apiName: 'activeUsers', uiName: 'Active Users', description: 'The number of distinct users who visited your site or app.', category: 'User', customDefinition: false, deprecatedApiNames: [], type: 'TYPE_INTEGER', expression: '', blockedReasons: [] },
  { apiName: 'newUsers', uiName: 'New Users', description: 'The number of users who interacted with your site for the first time.', category: 'User', customDefinition: false, deprecatedApiNames: [], type: 'TYPE_INTEGER', expression: '', blockedReasons: [] },
  { apiName: 'totalUsers', uiName: 'Total Users', description: 'The total number of users.', category: 'User', customDefinition: false, deprecatedApiNames: [], type: 'TYPE_INTEGER', expression: '', blockedReasons: [] },
  { apiName: 'sessions', uiName: 'Sessions', description: 'The number of sessions that began on your site or app.', category: 'Session', customDefinition: false, deprecatedApiNames: [], type: 'TYPE_INTEGER', expression: '', blockedReasons: [] },
  { apiName: 'sessionsPerUser', uiName: 'Sessions Per User', description: 'The average number of sessions per user.', category: 'Session', customDefinition: false, deprecatedApiNames: [], type: 'TYPE_FLOAT', expression: '', blockedReasons: [] },
  { apiName: 'averageSessionDuration', uiName: 'Average Session Duration', description: 'The average duration of sessions.', category: 'Session', customDefinition: false, deprecatedApiNames: [], type: 'TYPE_SECONDS', expression: '', blockedReasons: [] },
  { apiName: 'screenPageViews', uiName: 'Views', description: 'The number of app screens or web pages your users viewed.', category: 'Page / Screen', customDefinition: false, deprecatedApiNames: [], type: 'TYPE_INTEGER', expression: '', blockedReasons: [] },
  { apiName: 'screenPageViewsPerSession', uiName: 'Views Per Session', description: 'The average number of pages viewed per session.', category: 'Page / Screen', customDefinition: false, deprecatedApiNames: [], type: 'TYPE_FLOAT', expression: '', blockedReasons: [] },
  { apiName: 'eventCount', uiName: 'Event Count', description: 'The count of events.', category: 'Event', customDefinition: false, deprecatedApiNames: [], type: 'TYPE_INTEGER', expression: '', blockedReasons: [] },
  { apiName: 'conversions', uiName: 'Conversions', description: 'The count of conversion events.', category: 'Event', customDefinition: false, deprecatedApiNames: [], type: 'TYPE_INTEGER', expression: '', blockedReasons: [] },
  { apiName: 'bounceRate', uiName: 'Bounce Rate', description: 'The percentage of sessions that were not engaged.', category: 'Session', customDefinition: false, deprecatedApiNames: [], type: 'TYPE_FLOAT', expression: '', blockedReasons: [] },
  { apiName: 'engagementRate', uiName: 'Engagement Rate', description: 'The percentage of engaged sessions.', category: 'Session', customDefinition: false, deprecatedApiNames: [], type: 'TYPE_FLOAT', expression: '', blockedReasons: [] },
  { apiName: 'totalRevenue', uiName: 'Total Revenue', description: 'The sum of all revenue.', category: 'Revenue', customDefinition: false, deprecatedApiNames: [], type: 'TYPE_CURRENCY', expression: '', blockedReasons: ['NO_REVENUE_METRICS'] },
  { apiName: 'purchaseRevenue', uiName: 'Purchase Revenue', description: 'The sum of revenue from purchases.', category: 'Revenue', customDefinition: false, deprecatedApiNames: [], type: 'TYPE_CURRENCY', expression: '', blockedReasons: ['NO_REVENUE_METRICS'] },
];

// ============================================================================
// RANDOM DATA HELPERS
// ============================================================================

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals: number = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomBoolean(): boolean {
  return Math.random() > 0.5;
}

// ============================================================================
// MOCK DATA GENERATORS
// ============================================================================

export function generatePropertyQuota(): PropertyQuota {
  return {
    tokensPerDay: { consumed: randomInt(1000, 50000), remaining: randomInt(50000, 100000) },
    tokensPerHour: { consumed: randomInt(100, 5000), remaining: randomInt(5000, 10000) },
    concurrentRequests: { consumed: randomInt(1, 5), remaining: randomInt(5, 10) },
    serverErrorsPerProjectPerHour: { consumed: randomInt(0, 2), remaining: randomInt(8, 10) },
    potentiallyThresholdedRequestsPerHour: { consumed: randomInt(0, 50), remaining: randomInt(50, 120) },
    tokensPerProjectPerHour: { consumed: randomInt(100, 2000), remaining: randomInt(2000, 5000) },
  };
}

export function generateMetadata(): { dimensions: DimensionMetadata[]; metrics: MetricMetadata[]; name: string } {
  return {
    dimensions: DIMENSIONS,
    metrics: METRICS,
    name: 'properties/123456789/metadata',
  };
}

const COUNTRIES = ['United States', 'United Kingdom', 'Canada', 'Germany', 'France', 'Australia', 'Japan', 'Brazil', 'India', 'Mexico'];
const CITIES = ['New York', 'London', 'Toronto', 'Berlin', 'Paris', 'Sydney', 'Tokyo', 'Sao Paulo', 'Mumbai', 'Mexico City'];
const DEVICES = ['desktop', 'mobile', 'tablet'];
const BROWSERS = ['Chrome', 'Safari', 'Firefox', 'Edge', 'Opera'];
const OS = ['Windows', 'macOS', 'iOS', 'Android', 'Linux'];
const PAGES = ['/', '/about', '/products', '/contact', '/blog', '/pricing', '/features', '/signup', '/login', '/dashboard'];
const EVENTS = ['page_view', 'scroll', 'click', 'form_submit', 'purchase', 'add_to_cart', 'sign_up', 'login'];
const SOURCES = ['google', 'direct', 'facebook', 'twitter', 'linkedin', 'email', 'referral'];
const MEDIUMS = ['organic', 'cpc', 'referral', 'social', 'email', 'none'];

function generateDimensionValue(dimensionName: string): string {
  switch (dimensionName) {
    case 'country': return randomChoice(COUNTRIES);
    case 'city': return randomChoice(CITIES);
    case 'deviceCategory': return randomChoice(DEVICES);
    case 'browser': return randomChoice(BROWSERS);
    case 'operatingSystem': return randomChoice(OS);
    case 'pagePath': return randomChoice(PAGES);
    case 'pageTitle': return `Page - ${randomChoice(PAGES).replace('/', '') || 'Home'}`;
    case 'eventName': return randomChoice(EVENTS);
    case 'sessionSource': return randomChoice(SOURCES);
    case 'sessionMedium': return randomChoice(MEDIUMS);
    case 'date': {
      const d = new Date();
      d.setDate(d.getDate() - randomInt(0, 30));
      return d.toISOString().split('T')[0].replace(/-/g, '');
    }
    case 'hour': return String(randomInt(0, 23)).padStart(2, '0');
    case 'newVsReturning': return randomChoice(['new', 'returning']);
    case 'userAgeBracket': return randomChoice(['18-24', '25-34', '35-44', '45-54', '55-64', '65+']);
    case 'userGender': return randomChoice(['male', 'female']);
    default: return 'unknown';
  }
}

function generateMetricValue(metricName: string): string {
  switch (metricName) {
    case 'activeUsers':
    case 'newUsers':
    case 'totalUsers':
      return String(randomInt(100, 10000));
    case 'sessions':
      return String(randomInt(200, 15000));
    case 'sessionsPerUser':
      return randomFloat(1, 3).toString();
    case 'averageSessionDuration':
      return String(randomInt(60, 600));
    case 'screenPageViews':
      return String(randomInt(500, 50000));
    case 'screenPageViewsPerSession':
      return randomFloat(1, 5).toString();
    case 'eventCount':
      return String(randomInt(1000, 100000));
    case 'conversions':
      return String(randomInt(10, 500));
    case 'bounceRate':
      return randomFloat(0.2, 0.7).toString();
    case 'engagementRate':
      return randomFloat(0.3, 0.8).toString();
    case 'totalRevenue':
    case 'purchaseRevenue':
      return randomFloat(100, 50000).toString();
    default:
      return String(randomInt(0, 1000));
  }
}

export interface ReportRow {
  dimensionValues: { value: string }[];
  metricValues: { value: string }[];
}

export function generateReportRows(
  dimensions: string[],
  metrics: string[],
  rowCount: number = 10
): ReportRow[] {
  const rows: ReportRow[] = [];
  for (let i = 0; i < rowCount; i++) {
    rows.push({
      dimensionValues: dimensions.map(d => ({ value: generateDimensionValue(d) })),
      metricValues: metrics.map(m => ({ value: generateMetricValue(m) })),
    });
  }
  return rows;
}

export function generateRunReportResponse(request: {
  dimensions?: { name: string }[];
  metrics?: { name: string }[];
  limit?: number;
}) {
  const dimensions = request.dimensions?.map(d => d.name) || ['country'];
  const metrics = request.metrics?.map(m => m.name) || ['activeUsers'];
  const limit = request.limit || 10;

  const rows = generateReportRows(dimensions, metrics, Math.min(limit, 100));

  return {
    dimensionHeaders: dimensions.map(name => ({ name })),
    metricHeaders: metrics.map(name => ({
      name,
      type: METRICS.find(m => m.apiName === name)?.type || 'TYPE_INTEGER'
    })),
    rows,
    rowCount: rows.length,
    metadata: {
      currencyCode: 'USD',
      timeZone: 'America/New_York',
      dataLossFromOtherRow: false,
      subjectToThresholding: false,
      emptyReason: '',
      schemaRestrictionResponse: {
        activeMetricRestrictions: [],
      },
    },
    propertyQuota: generatePropertyQuota(),
    maximums: rows.length > 0 ? [rows[0]] : [],
    minimums: rows.length > 0 ? [rows[rows.length - 1]] : [],
    totals: [{
      dimensionValues: [{ value: '' }],
      metricValues: metrics.map(() => ({ value: String(randomInt(10000, 100000)) })),
    }],
    kind: 'analyticsData#runReport',
  };
}

export function generateRealtimeReportResponse(request: {
  dimensions?: { name: string }[];
  metrics?: { name: string }[];
  limit?: number;
}) {
  const dimensions = request.dimensions?.map(d => d.name) || ['country'];
  const metrics = request.metrics?.map(m => m.name) || ['activeUsers'];
  const limit = request.limit || 10;

  // Realtime data typically has fewer rows and smaller numbers
  const rows = generateReportRows(dimensions, metrics, Math.min(limit, 20));

  return {
    dimensionHeaders: dimensions.map(name => ({ name })),
    metricHeaders: metrics.map(name => ({
      name,
      type: METRICS.find(m => m.apiName === name)?.type || 'TYPE_INTEGER'
    })),
    rows,
    rowCount: rows.length,
    propertyQuota: generatePropertyQuota(),
    maximums: rows.length > 0 ? [rows[0]] : [],
    minimums: rows.length > 0 ? [rows[rows.length - 1]] : [],
    totals: [{
      dimensionValues: [{ value: '' }],
      metricValues: metrics.map(() => ({ value: String(randomInt(10, 500)) })),
    }],
    kind: 'analyticsData#runRealtimeReport',
  };
}

export function generateBatchRunReportsResponse(requests: Array<{
  dimensions?: { name: string }[];
  metrics?: { name: string }[];
  limit?: number;
}>) {
  return {
    reports: requests.map(req => generateRunReportResponse(req)),
    kind: 'analyticsData#batchRunReports',
  };
}

export function generateCheckCompatibilityResponse(request: {
  dimensions?: { name: string }[];
  metrics?: { name: string }[];
}) {
  const dimensions = request.dimensions?.map(d => d.name) || [];
  const metrics = request.metrics?.map(m => m.name) || [];

  return {
    dimensionCompatibilities: dimensions.map(name => {
      const dim = DIMENSIONS.find(d => d.apiName === name);
      return {
        dimensionMetadata: dim || {
          apiName: name,
          uiName: name,
          description: '',
          category: 'Custom',
          customDefinition: true,
          deprecatedApiNames: []
        },
        compatibility: dim ? 'COMPATIBLE' : 'INCOMPATIBLE' as Compatibility,
      };
    }),
    metricCompatibilities: metrics.map(name => {
      const met = METRICS.find(m => m.apiName === name);
      return {
        metricMetadata: met || {
          apiName: name,
          uiName: name,
          description: '',
          category: 'Custom',
          customDefinition: true,
          deprecatedApiNames: [],
          type: 'TYPE_INTEGER' as MetricType,
          expression: '',
          blockedReasons: []
        },
        compatibility: met ? 'COMPATIBLE' : 'INCOMPATIBLE' as Compatibility,
      };
    }),
  };
}

export function generatePivotReportResponse(request: {
  dimensions?: { name: string }[];
  metrics?: { name: string }[];
  pivots?: Array<{ fieldNames: string[]; limit?: number }>;
}) {
  const dimensions = request.dimensions?.map(d => d.name) || ['country'];
  const metrics = request.metrics?.map(m => m.name) || ['activeUsers'];

  const rows = generateReportRows(dimensions, metrics, 10);

  return {
    dimensionHeaders: dimensions.map(name => ({ name })),
    metricHeaders: metrics.map(name => ({
      name,
      type: METRICS.find(m => m.apiName === name)?.type || 'TYPE_INTEGER'
    })),
    pivotHeaders: (request.pivots || [{ fieldNames: dimensions, limit: 5 }]).map(pivot => ({
      pivotDimensionHeaders: Array(Math.min(pivot.limit || 5, 10)).fill(null).map(() => ({
        dimensionValues: pivot.fieldNames.map(f => ({ value: generateDimensionValue(f) })),
      })),
      rowCount: randomInt(5, 20),
    })),
    rows,
    aggregates: [{
      dimensionValues: [{ value: 'TOTAL' }],
      metricValues: metrics.map(() => ({ value: String(randomInt(10000, 100000)) })),
    }],
    metadata: {
      currencyCode: 'USD',
      timeZone: 'America/New_York',
      dataLossFromOtherRow: false,
      subjectToThresholding: false,
      emptyReason: '',
      schemaRestrictionResponse: {
        activeMetricRestrictions: [],
      },
    },
    propertyQuota: generatePropertyQuota(),
    kind: 'analyticsData#runPivotReport',
  };
}
