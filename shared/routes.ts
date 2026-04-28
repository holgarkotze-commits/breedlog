import { z } from 'zod';
import { 
  insertAnimalSchema, 
  insertBreedingEventSchema, 
  insertOffspringSchema, 
  insertPerformanceRecordSchema, 
  insertHealthRecordSchema, 
  insertEvaluationSchema, 
  insertMatingGroupSchema,
  insertFarmSettingsSchema,
  insertDocumentSchema,
  insertEidScanEventSchema,
  animals,
  breedingEvents,
  performanceRecords,
  healthRecords,
  evaluations,
  offspring,
  matingGroups,
  farmSettings,
  documents
} from './schema';

// Shared error schemas
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  animals: {
    list: {
      method: 'GET' as const,
      path: '/api/animals',
      input: z.object({
        search: z.string().optional(),
        status: z.string().optional(),
        sex: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof animals.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/animals/:id',
      responses: {
        200: z.custom<typeof animals.$inferSelect & { dam?: any, sire?: any, evaluations?: any[] }>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/animals',
      input: insertAnimalSchema,
      responses: {
        201: z.custom<typeof animals.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/animals/:id',
      input: insertAnimalSchema.partial(),
      responses: {
        200: z.custom<typeof animals.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/animals/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
    familyTree: {
      method: 'GET' as const,
      path: '/api/animals/:id/family-tree',
      responses: {
        200: z.any(), // Complex object for D3/vis
        404: errorSchemas.notFound,
      }
    }
  },
  breeding: {
    list: {
      method: 'GET' as const,
      path: '/api/breeding-events',
      responses: {
        200: z.array(z.custom<typeof breedingEvents.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/breeding-events',
      input: insertBreedingEventSchema,
      responses: {
        201: z.custom<typeof breedingEvents.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    groups: {
        list: {
            method: 'GET' as const,
            path: '/api/mating-groups',
            responses: {
                200: z.array(z.custom<typeof matingGroups.$inferSelect>()),
            }
        },
        create: {
            method: 'POST' as const,
            path: '/api/mating-groups',
            input: insertMatingGroupSchema,
            responses: {
                201: z.custom<typeof matingGroups.$inferSelect>(),
            }
        }
    }
  },
  records: {
    performance: {
      list: {
        method: 'GET' as const,
        path: '/api/animals/:id/performance',
        responses: {
          200: z.array(z.custom<typeof performanceRecords.$inferSelect>()),
        },
      },
      create: {
        method: 'POST' as const,
        path: '/api/performance-records',
        input: insertPerformanceRecordSchema,
        responses: {
          201: z.custom<typeof performanceRecords.$inferSelect>(),
        },
      },
    },
    health: {
      list: {
        method: 'GET' as const,
        path: '/api/animals/:id/health',
        responses: {
          200: z.array(z.custom<typeof healthRecords.$inferSelect>()),
        },
      },
      create: {
        method: 'POST' as const,
        path: '/api/health-records',
        input: insertHealthRecordSchema,
        responses: {
          201: z.custom<typeof healthRecords.$inferSelect>(),
        },
      },
    },
  },
  evaluations: {
    list: {
      method: 'GET' as const,
      path: '/api/animals/:id/evaluations',
      responses: {
        200: z.array(z.custom<typeof evaluations.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/evaluations',
      input: insertEvaluationSchema,
      responses: {
        201: z.custom<typeof evaluations.$inferSelect>(),
      },
    },
  },
  settings: {
    export: {
      method: 'GET' as const,
      path: '/api/settings/export',
      responses: {
        200: z.any(), // File download
      },
    },
    import: {
      method: 'POST' as const,
      path: '/api/settings/import',
      input: z.object({
        table: z.enum(['animals', 'breedingEvents', 'performanceRecords', 'healthRecords', 'evaluations']),
        csvData: z.string(),
      }),
      responses: {
        200: z.object({ count: z.number() }),
        400: errorSchemas.validation,
      },
    },
  },
  debug: {
    test: {
      method: 'POST' as const,
      path: '/api/debug/test',
      responses: {
        200: z.object({ results: z.array(z.string()) }),
      },
    },
  },
  
  farmSettings: {
    get: {
      method: 'GET' as const,
      path: '/api/farm-settings',
      responses: {
        200: z.custom<typeof farmSettings.$inferSelect | null>(),
      },
    },
    save: {
      method: 'POST' as const,
      path: '/api/farm-settings',
      input: insertFarmSettingsSchema,
      responses: {
        200: z.custom<typeof farmSettings.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  
  documents: {
    list: {
      method: 'GET' as const,
      path: '/api/documents',
      responses: {
        200: z.array(z.custom<typeof documents.$inferSelect>()),
      },
    },
    upload: {
      method: 'POST' as const,
      path: '/api/documents',
      input: insertDocumentSchema,
      responses: {
        201: z.custom<typeof documents.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/documents/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  
  import: {
    csv: {
      method: 'POST' as const,
      path: '/api/import/csv',
      responses: {
        200: z.object({
          imported: z.number(),
          created: z.number().optional(),
          updated: z.number().optional(),
          skipped: z.number().optional(),
          duplicate: z.number().optional(),
          failed: z.number().optional(),
          validationErrors: z.array(z.string()).optional(),
          errors: z.array(z.string()),
        }),
        400: errorSchemas.validation,
      },
    },
  },
  eid: {
    scan: {
      method: 'POST' as const,
      path: '/api/eid/scan',
      input: insertEidScanEventSchema.pick({
        electronicIdRaw: true,
        readerSource: true,
        readerSessionId: true,
        payload: true,
      }),
      responses: {
        200: z.object({
          matched: z.boolean(),
          animal: z.custom<typeof animals.$inferSelect>().nullable(),
          scanEvent: z.custom<any>(),
          status: z.enum(['matched', 'unassigned']),
        }),
        400: errorSchemas.validation,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
