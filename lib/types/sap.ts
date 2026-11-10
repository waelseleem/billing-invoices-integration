export interface SAPConfig {
  serviceLayerUrl: string;
  companyDB: string;
  username: string;
  password: string;
}

export interface SAPSession {
  SessionId: string;
  Version: string;
  SessionTimeout: number;
  expiresAt: string; // ISO string
}

export interface SAPError {
  error: {
    code: number;
    message: {
      lang: string;
      value: string;
    };
  };
} 