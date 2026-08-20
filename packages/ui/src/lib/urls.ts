export type ServiceUrls = {
  api: string;
  portal: string;
};

export const getServiceUrls = (): ServiceUrls => ({
  api: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api",
  portal:
    process.env.NEXT_PUBLIC_PORTAL_URL ??
    process.env.NEXT_PUBLIC_FLOWISE_URL ??
    "http://localhost:3001",
});
