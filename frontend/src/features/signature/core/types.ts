export type SignatureData = {
  data_url: string;
};

export type SignatureCheckResult = {
  has_signature: boolean;
};

export type SignatureRefreshResult = {
  queued: boolean;
  delay_ms: number;
};
