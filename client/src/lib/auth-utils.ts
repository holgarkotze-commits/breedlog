export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}

// Handle unauthorized errors - with device-based auth, we don't redirect to login
// Instead, we just show a notification and let the user retry
export function handleUnauthorized(toast?: (options: { title: string; description: string; variant: string }) => void) {
  if (toast) {
    toast({
      title: "Access Error",
      description: "Unable to complete this action. Please try again.",
      variant: "destructive",
    });
  }
}
