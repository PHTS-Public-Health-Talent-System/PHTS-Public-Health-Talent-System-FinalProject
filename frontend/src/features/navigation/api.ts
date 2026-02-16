import api from '@/shared/api/axios';
import type { NavigationPayload } from './types';

export const getNavigation = async (): Promise<NavigationPayload> => {
  const response = await api.get('/navigation');
  return response.data.data as NavigationPayload;
};
