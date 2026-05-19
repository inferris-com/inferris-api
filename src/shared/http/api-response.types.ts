// src/shared/http/api-response.types.ts

export type ApiSuccess<T> = {
  data: T;
};

export type ApiListSuccess<T> = {
  data: T[];
  meta: {
    count: number;
  };
};

export type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
    issues?: Array<{
      path: Array<string | number>;
      message: string;
    }>;
  };
};
