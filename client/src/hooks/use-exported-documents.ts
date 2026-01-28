import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { ExportedDocument } from "@shared/schema";

export function useExportedDocuments(subfolder?: string) {
  const queryKey = subfolder 
    ? ['/api/exported-documents', subfolder] 
    : ['/api/exported-documents'];
    
  return useQuery<ExportedDocument[]>({
    queryKey,
    queryFn: async () => {
      const url = subfolder 
        ? `/api/exported-documents?subfolder=${subfolder}` 
        : '/api/exported-documents';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch exported documents');
      return response.json();
    }
  });
}

export function useCreateExportedDocument() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (doc: { name: string; documentType: string; subfolder: string; animalId?: number }) => {
      const response = await apiRequest("POST", "/api/exported-documents", doc);
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/exported-documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/exported-documents', variables.subfolder] });
    }
  });
}

export function useDeleteExportedDocument() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/exported-documents/${id}`);
    },
    onSuccess: () => {
      // Invalidate all exported-documents queries (base and subfolder-specific)
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === '/api/exported-documents'
      });
    }
  });
}
