/**
 * Loads Monaco Editor from CDN once, sharing the in-flight promise across callers.
 */

const MONACO_VERSION = '0.44.0';

let loadingPromise: Promise<void> | null = null;

export function loadMonaco(): Promise<void> {
  if ((window as any).monaco) {
    return Promise.resolve();
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = new Promise((resolve) => {
    const loaderScript = document.createElement('script');
    loaderScript.src = `https://unpkg.com/monaco-editor@${MONACO_VERSION}/min/vs/loader.js`;
    loaderScript.onload = () => {
      (window as any).require.config({
        paths: {
          vs: `https://unpkg.com/monaco-editor@${MONACO_VERSION}/min/vs`
        }
      });

      (window as any).require(['vs/editor/editor.main'], () => {
        resolve();
      });
    };

    document.head.appendChild(loaderScript);
  });

  return loadingPromise;
}
