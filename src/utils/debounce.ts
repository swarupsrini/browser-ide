export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): T & { cancel: () => void } {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  // This is the function that will be returned
  const debounced = function (this: any, ...args: Parameters<T>) {
    // Clear the previous timeout if it exists
    if (timeout) {
      clearTimeout(timeout);
    }

    // Set a new timeout
    timeout = setTimeout(() => {
      func.apply(this, args);
      timeout = null;
    }, wait);
  } as T;

  // Add cancel method
  (debounced as any).cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return debounced as T & { cancel: () => void };
}

// Usage example:
const debouncedUpdate = debounce((value: string) => {
  console.log("Updating with:", value);
}, 300);
