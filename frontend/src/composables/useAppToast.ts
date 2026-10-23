import { toast } from "vue-sonner";

export function notifyError(message: string, description?: string): void {
  toast.error(message, description ? { description, duration: 6500 } : { duration: 6500 });
}

export function notifyWarning(message: string, description?: string): void {
  toast.warning(message, description ? { description } : undefined);
}

