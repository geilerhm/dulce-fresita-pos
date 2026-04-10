import { toast as sonnerToast } from "sonner";
import { playSuccess, playError, playClick } from "./sounds";

/** Toast wrapper that plays sounds automatically */
export const toast = {
  success: (message: string) => { playSuccess(); return sonnerToast.success(message); },
  error: (message: string) => { playError(); return sonnerToast.error(message); },
  warning: (message: string) => { playClick(); return sonnerToast.warning(message); },
  info: (message: string) => { playClick(); return sonnerToast.info(message); },
};
