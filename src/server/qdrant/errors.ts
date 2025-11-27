export const normalizeQdrantError = (error: unknown) => {
  if (error instanceof Error && /fetch failed/i.test(error.message)) {
    return new Error(
      "Unable to connect to Qdrant. Verify QDRANT_URL and QDRANT_API_KEY and ensure the service is reachable."
    );
  }

  if (error && typeof error === "object") {
    const status =
      typeof (error as { status?: unknown }).status === "number"
        ? (error as { status: number }).status
        : undefined;
    const statusText =
      typeof (error as { statusText?: unknown }).statusText === "string"
        ? (error as { statusText: string }).statusText
        : undefined;
    const data = (error as { data?: unknown }).data;

    const detail =
      typeof data === "string"
        ? data
        : data && typeof data === "object"
        ? typeof (data as { error?: unknown }).error === "string"
          ? (data as { error: string }).error
          : typeof (data as { message?: unknown }).message === "string"
          ? (data as { message: string }).message
          : (() => {
              try {
                return JSON.stringify(data);
              } catch {
                return undefined;
              }
            })()
        : undefined;

    if (status || statusText || detail) {
      const label = status ? `Qdrant request failed (${status})` : "Qdrant request failed";
      const reason = detail ?? statusText ?? "Request was rejected without details.";
      return new Error(`${label}: ${reason}`, {
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  return error instanceof Error ? error : new Error(String(error));
};
