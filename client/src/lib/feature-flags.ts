export type FeatureFlag = 
  | 'export_pdf'
  | 'export_csv'
  | 'export_json'
  | 'ai_valuation'
  | 'bulk_import'
  | 'advanced_reports'
  | 'breeding_analytics'
  | 'health_tracking'
  | 'unlimited_animals'
  | 'cloud_sync'
  | 'premium_support';

export type LicenseMode = 'free' | 'paid' | 'offline_licensed' | 'trial';

export interface FeatureConfig {
  enabled: boolean;
  requiresOnline: boolean;
  requiresLicense: LicenseMode[];
  interceptable: boolean;
}

const defaultFeatureConfig: Record<FeatureFlag, FeatureConfig> = {
  export_pdf: {
    enabled: true,
    requiresOnline: false,
    requiresLicense: ['free', 'paid', 'offline_licensed', 'trial'],
    interceptable: true,
  },
  export_csv: {
    enabled: true,
    requiresOnline: false,
    requiresLicense: ['free', 'paid', 'offline_licensed', 'trial'],
    interceptable: true,
  },
  export_json: {
    enabled: false,
    requiresOnline: false,
    requiresLicense: ['free', 'paid', 'offline_licensed', 'trial'],
    interceptable: true,
  },
  ai_valuation: {
    enabled: true,
    requiresOnline: true,
    requiresLicense: ['paid', 'trial'],
    interceptable: true,
  },
  bulk_import: {
    enabled: true,
    requiresOnline: false,
    requiresLicense: ['free', 'paid', 'offline_licensed', 'trial'],
    interceptable: false,
  },
  advanced_reports: {
    enabled: true,
    requiresOnline: false,
    requiresLicense: ['paid', 'offline_licensed'],
    interceptable: true,
  },
  breeding_analytics: {
    enabled: true,
    requiresOnline: false,
    requiresLicense: ['free', 'paid', 'offline_licensed', 'trial'],
    interceptable: false,
  },
  health_tracking: {
    enabled: true,
    requiresOnline: false,
    requiresLicense: ['free', 'paid', 'offline_licensed', 'trial'],
    interceptable: false,
  },
  unlimited_animals: {
    enabled: true,
    requiresOnline: false,
    requiresLicense: ['paid', 'offline_licensed'],
    interceptable: false,
  },
  cloud_sync: {
    enabled: true,
    requiresOnline: true,
    requiresLicense: ['free', 'paid', 'trial'],
    interceptable: false,
  },
  premium_support: {
    enabled: true,
    requiresOnline: true,
    requiresLicense: ['paid'],
    interceptable: false,
  },
};

class FeatureFlagManager {
  private currentLicense: LicenseMode = 'free';
  private overrides: Partial<Record<FeatureFlag, boolean>> = {};
  private exportInterceptor: ((feature: FeatureFlag, data: unknown) => Promise<boolean>) | null = null;

  setLicense(mode: LicenseMode) {
    this.currentLicense = mode;
    localStorage.setItem('breedlog-license', mode);
  }

  getLicense(): LicenseMode {
    return this.currentLicense;
  }

  setOverride(feature: FeatureFlag, enabled: boolean) {
    this.overrides[feature] = enabled;
  }

  clearOverride(feature: FeatureFlag) {
    delete this.overrides[feature];
  }

  isEnabled(feature: FeatureFlag): boolean {
    if (this.overrides[feature] !== undefined) {
      return this.overrides[feature];
    }

    const config = defaultFeatureConfig[feature];
    if (!config.enabled) {
      return false;
    }

    if (config.requiresOnline && !navigator.onLine) {
      return false;
    }

    return config.requiresLicense.includes(this.currentLicense);
  }

  getConfig(feature: FeatureFlag): FeatureConfig {
    return defaultFeatureConfig[feature];
  }

  setExportInterceptor(interceptor: (feature: FeatureFlag, data: unknown) => Promise<boolean>) {
    this.exportInterceptor = interceptor;
  }

  async interceptExport(feature: FeatureFlag, data: unknown): Promise<boolean> {
    if (this.exportInterceptor && defaultFeatureConfig[feature]?.interceptable) {
      return this.exportInterceptor(feature, data);
    }
    return true;
  }

  initialize() {
    const savedLicense = localStorage.getItem('breedlog-license') as LicenseMode | null;
    if (savedLicense && ['free', 'paid', 'offline_licensed', 'trial'].includes(savedLicense)) {
      this.currentLicense = savedLicense;
    }
  }
}

export const featureFlags = new FeatureFlagManager();

featureFlags.initialize();

export function useFeatureFlag(feature: FeatureFlag): boolean {
  return featureFlags.isEnabled(feature);
}

export function useFeatureFlags() {
  return {
    isEnabled: (feature: FeatureFlag) => featureFlags.isEnabled(feature),
    getConfig: (feature: FeatureFlag) => featureFlags.getConfig(feature),
    getLicense: () => featureFlags.getLicense(),
  };
}
