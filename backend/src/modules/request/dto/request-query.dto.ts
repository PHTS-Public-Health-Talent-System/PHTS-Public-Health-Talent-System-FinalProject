import { RequestStatus, RequestType } from '@/modules/request/request.types.js';

/**
 * Filters for querying requests
 */
export interface RequestFilters {
  status?: RequestStatus;
  request_type?: RequestType;
  from_date?: Date;
  to_date?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}
