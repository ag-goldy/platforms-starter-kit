import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      isInternal: boolean;
    };
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    isInternal: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    email: string;
    name?: string | null;
    isInternal: boolean;
  }
}

