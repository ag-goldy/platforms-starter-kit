declare module 'web-push' {
  interface PushSubscription {
    endpoint: string;
    keys: {
      auth: string;
      p256dh: string;
    };
  }

  interface RequestOptions {
    headers?: Record<string, string>;
    gcmAPIKey?: string;
    vapidDetails?: {
      subject: string;
      publicKey: string;
      privateKey: string;
    };
    TTL?: number;
    contentEncoding?: 'aes128gcm' | 'aesgcm';
  }

  function setVapidDetails(
    subject: string,
    publicKey: string,
    privateKey: string
  ): void;

  function sendNotification(
    subscription: PushSubscription,
    payload?: string | Buffer,
    options?: RequestOptions
  ): Promise<{ statusCode: number; headers: Record<string, string>; body: string }>;

  function generateVAPIDKeys(): {
    publicKey: string;
    privateKey: string;
  };

  export {
    setVapidDetails,
    sendNotification,
    generateVAPIDKeys,
    PushSubscription,
    RequestOptions,
  };
  export default {
    setVapidDetails,
    sendNotification,
    generateVAPIDKeys,
  };
}
