const STATUS_MESSAGES = {
  401: "Your session has expired. Please log in again",
  403: "You don't have permission for this action",
  404: "The requested resource was not found",
  409: "This record is linked to other records",
  429: "Too many requests. Please wait a moment and try again",
};

export function getApiErrorMessage(error, fallback = "Something went wrong. Please try again") {
  if (error?.response?.data?.message) return error.response.data.message;
  const status = error?.response?.status;
  if (status && STATUS_MESSAGES[status]) return STATUS_MESSAGES[status];
  if (status >= 500) return "A server error occurred. Please try again later";
  if (!error?.response) return "Could not reach the server. Check your connection";
  return fallback;
}
