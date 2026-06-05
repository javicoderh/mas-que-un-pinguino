export const flowConfig = {
  apiKey: import.meta.env.FLOW_API_KEY ?? "",
  secretKey: import.meta.env.FLOW_SECRET_KEY ?? "",
  apiUrl: import.meta.env.FLOW_API_URL ?? "https://sandbox.flow.cl/api",
  currency: "CLP",
};

export const isFlowConfigured = Boolean(flowConfig.apiKey && flowConfig.secretKey);
