/**
 * Lazy Import Utilities
 *
 * Provides dynamic imports for heavy dependencies to reduce initial bundle size.
 * Use these instead of static imports for components/utilities that aren't needed immediately.
 *
 * Bundle Size Savings (estimated):
 * - Monaco Editor: ~180KB
 * - Mermaid: ~200KB
 * - Recharts: ~250KB
 * - Canvas: ~150KB
 * - AWS SDKs: ~500KB (when all are loaded)
 * - Azure SDKs: ~300KB
 */

// ============================================================================
// Types
// ============================================================================

export interface LazyModule<T> {
  load: () => Promise<T>;
  isLoaded: () => boolean;
}

// ============================================================================
// Lazy Module Factory
// ============================================================================

function createLazyModule<T>(importFn: () => Promise<T>): LazyModule<T> {
  let cached: T | null = null;
  let loading: Promise<T> | null = null;

  return {
    load: async () => {
      if (cached) return cached;
      if (loading) return loading;

      loading = importFn().then(mod => {
        cached = mod;
        return mod;
      });

      return loading;
    },
    isLoaded: () => cached !== null
  };
}

// ============================================================================
// Monaco Editor (180KB)
// ============================================================================

export const MonacoEditor = createLazyModule(async () => {
  const mod = await import('@monaco-editor/react');
  return mod.default;
});

export const loadMonaco = () => MonacoEditor.load();

// ============================================================================
// Mermaid (200KB)
// ============================================================================

export const Mermaid = createLazyModule(async () => {
  const mod = await import('mermaid');
  return mod.default;
});

export const loadMermaid = async () => {
  const mermaid = await Mermaid.load();
  mermaid.initialize({ startOnLoad: false, theme: 'default' });
  return mermaid;
};

// ============================================================================
// Recharts (250KB)
// ============================================================================

export const Recharts = createLazyModule(async () => {
  const mod = await import('recharts');
  return mod;
});

export const loadRecharts = () => Recharts.load();

// Typed lazy component helpers
export async function getLineChart() {
  const { LineChart } = await loadRecharts();
  return LineChart;
}

export async function getBarChart() {
  const { BarChart } = await loadRecharts();
  return BarChart;
}

export async function getAreaChart() {
  const { AreaChart } = await loadRecharts();
  return AreaChart;
}

export async function getPieChart() {
  const { PieChart } = await loadRecharts();
  return PieChart;
}

// ============================================================================
// AWS SDKs (500KB total when all loaded)
// ============================================================================

export const AWSS3 = createLazyModule(async () => {
  const mod = await import('@aws-sdk/client-s3');
  return mod;
});

export const AWSLambda = createLazyModule(async () => {
  const mod = await import('@aws-sdk/client-lambda');
  return mod;
});

export const AWSRDS = createLazyModule(async () => {
  const mod = await import('@aws-sdk/client-rds');
  return mod;
});

export const AWSECS = createLazyModule(async () => {
  const mod = await import('@aws-sdk/client-ecs');
  return mod;
});

export const AWSEC2 = createLazyModule(async () => {
  const mod = await import('@aws-sdk/client-ec2');
  return mod;
});

export const AWSCloudFormation = createLazyModule(async () => {
  const mod = await import('@aws-sdk/client-cloudformation');
  return mod;
});

export const AWSSTS = createLazyModule(async () => {
  const mod = await import('@aws-sdk/client-sts');
  return mod;
});

export const AWSAPIGateway = createLazyModule(async () => {
  const mod = await import('@aws-sdk/client-apigatewayv2');
  return mod;
});

// Convenience loaders
export const loadAWSS3 = () => AWSS3.load();
export const loadAWSLambda = () => AWSLambda.load();
export const loadAWSRDS = () => AWSRDS.load();
export const loadAWSECS = () => AWSECS.load();
export const loadAWSEC2 = () => AWSEC2.load();
export const loadAWSCloudFormation = () => AWSCloudFormation.load();
export const loadAWSSTS = () => AWSSTS.load();
export const loadAWSAPIGateway = () => AWSAPIGateway.load();

// ============================================================================
// Azure SDKs (300KB total when all loaded)
// ============================================================================

export const AzureIdentity = createLazyModule(async () => {
  const mod = await import('@azure/identity');
  return mod;
});

export const AzureResources = createLazyModule(async () => {
  const mod = await import('@azure/arm-resources');
  return mod;
});

export const AzureAppService = createLazyModule(async () => {
  const mod = await import('@azure/arm-appservice');
  return mod;
});

export const AzurePostgres = createLazyModule(async () => {
  const mod = await import('@azure/arm-postgresql-flexible');
  return mod;
});

export const AzureAppContainers = createLazyModule(async () => {
  const mod = await import('@azure/arm-appcontainers');
  return mod;
});

export const AzureMonitor = createLazyModule(async () => {
  const mod = await import('@azure/arm-monitor');
  return mod;
});

// Convenience loaders
export const loadAzureIdentity = () => AzureIdentity.load();
export const loadAzureResources = () => AzureResources.load();
export const loadAzureAppService = () => AzureAppService.load();
export const loadAzurePostgres = () => AzurePostgres.load();
export const loadAzureAppContainers = () => AzureAppContainers.load();
export const loadAzureMonitor = () => AzureMonitor.load();

// ============================================================================
// PDF & Canvas (150KB each)
// ============================================================================

export const PDFLib = createLazyModule(async () => {
  const mod = await import('pdfjs-dist');
  return mod;
});

export const loadPDFLib = () => PDFLib.load();

// Canvas is typically used server-side, so we check for it
export const Canvas = createLazyModule(async () => {
  try {
    const mod = await import('canvas');
    return mod;
  } catch {
    // Canvas may not be available in all environments
    return null;
  }
});

export const loadCanvas = () => Canvas.load();

// ============================================================================
// React DnD (50KB)
// ============================================================================

export const ReactDnD = createLazyModule(async () => {
  const [dnd, html5Backend] = await Promise.all([
    import('react-dnd'),
    import('react-dnd-html5-backend')
  ]);
  return { ...dnd, ...html5Backend };
});

export const loadReactDnD = () => ReactDnD.load();

// ============================================================================
// React Arborist (Tree component - 40KB)
// ============================================================================

export const ReactArborist = createLazyModule(async () => {
  const mod = await import('react-arborist');
  return mod;
});

export const loadReactArborist = () => ReactArborist.load();

// ============================================================================
// Framer Motion (60KB)
// ============================================================================

export const FramerMotion = createLazyModule(async () => {
  const mod = await import('framer-motion');
  return mod;
});

export const loadFramerMotion = () => FramerMotion.load();

// ============================================================================
// Preload Utilities
// ============================================================================

/**
 * Preload modules in the background when the app is idle.
 * Call this after initial render to warm up commonly used modules.
 */
export function preloadCommonModules(): void {
  if (typeof window === 'undefined') return;

  // Use requestIdleCallback if available, otherwise setTimeout
  const schedulePreload = (fn: () => void) => {
    if ('requestIdleCallback' in window) {
      (window as typeof window & { requestIdleCallback: (cb: () => void) => void })
        .requestIdleCallback(fn);
    } else {
      setTimeout(fn, 1000);
    }
  };

  // Preload in priority order
  schedulePreload(() => {
    // Most commonly used
    loadRecharts();
    loadFramerMotion();
  });
}

/**
 * Check which heavy modules are currently loaded
 */
export function getLoadedModules(): string[] {
  const modules: string[] = [];

  if (MonacoEditor.isLoaded()) modules.push('monaco-editor');
  if (Mermaid.isLoaded()) modules.push('mermaid');
  if (Recharts.isLoaded()) modules.push('recharts');
  if (AWSS3.isLoaded()) modules.push('aws-s3');
  if (AWSLambda.isLoaded()) modules.push('aws-lambda');
  if (AzureIdentity.isLoaded()) modules.push('azure-identity');
  if (PDFLib.isLoaded()) modules.push('pdfjs-dist');
  if (ReactDnD.isLoaded()) modules.push('react-dnd');
  if (FramerMotion.isLoaded()) modules.push('framer-motion');

  return modules;
}
