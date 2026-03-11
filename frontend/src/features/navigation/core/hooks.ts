/**
 * navigation module - React query hooks
 *
 */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/providers/auth-provider";
import { getNavigation } from "./api";

export const useNavigation = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["navigation", user?.id ?? "anonymous", user?.role ?? "unknown"],
    queryFn: getNavigation,
    enabled: Boolean(user),
    staleTime: 0,
    refetchInterval: 1000 * 15,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    gcTime: 1000 * 60 * 15,
  });
};
