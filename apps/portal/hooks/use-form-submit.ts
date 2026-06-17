import { useState } from "react";
import { toast } from "sonner";
import { extractErrorMessage, handleApiError } from "@/lib/errors/utils";

export interface FormSubmitResult<T = any> {
  success?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  data?: T;
}

export function useFormSubmit<
  TArgs extends any[],
  TResult extends FormSubmitResult,
>(
  // eslint-disable-next-line no-unused-vars
  action: (...args: TArgs) => Promise<TResult>,
  options?: {
    onSuccess?: (_result: TResult) => void;
    onError?: (_error: TResult | Error | string) => void;
    successMessage?: string | ((_result: TResult) => string);
  },
) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (...args: TArgs) => {
    setIsSubmitting(true);
    try {
      const result = await action(...args);

      if (result?.error || result?.fieldErrors || result?.success === false) {
        if (result.error || !result.fieldErrors) {
          const errorMsg = extractErrorMessage(result);
          toast.error(errorMsg);
        }
        options?.onError?.(result);
        return result;
      }

      const successMsg =
        (typeof options?.successMessage === "function"
          ? options.successMessage(result)
          : options?.successMessage) ||
        result?.message ||
        "Success";

      toast.success(successMsg);
      options?.onSuccess?.(result);
      return result;
    } catch (error) {
      const errorMsg = handleApiError(error);
      options?.onError?.(errorMsg);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  return { submit, isSubmitting };
}
