export const chooseImportRequestId = (
  requestIdNullable: boolean,
): number | null => {
  return requestIdNullable ? null : 0;
};
