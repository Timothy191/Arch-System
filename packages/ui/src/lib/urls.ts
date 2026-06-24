export type ServiceUrls = {
  api: string;
  portal: string;
};

export const getServiceUrls = (): ServiceUrls => ({
  api:
    process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_N8N_URL ?? "http://localhost:5678",
  portal:
    process.env.NEXT_PUBLIC_PORTAL_URL ??
    process.env.NEXT_PUBLIC_FLOWISE_URL ??
    "http://localhost:3001",
});
