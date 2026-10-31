// Vercel Web Analytics resilient client stub
// Prevents 404 / text/html MIME-type errors when Vercel Web Analytics is not enabled on the deployment.
(() => {
  if (typeof window === 'undefined') return;
  if (!window.va) {
    window.va = (...params) => {
      window.vaq = window.vaq || [];
      window.vaq.push(params);
    };
  }
})();
