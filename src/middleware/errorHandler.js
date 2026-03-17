export function notFoundHandler(req, res) {
  res.status(404).json({ error: "Route not found" });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const status = error.status || 500;
  const message =
    status >= 500 ? "Internal server error" : error.message || "Request failed";

  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error(error);
  }

  res.status(status).json({ error: message });
}

