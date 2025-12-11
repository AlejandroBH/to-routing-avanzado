// Middleware de validación
const ValidationError = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Datos inválidos", errors.array());
  }
  next();
};

// Middleware de error centralizado
function AppError(error, req, res, next) {
  console.error("Error:", error);

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: error.message,
      ...(error.details && { detalles: error.details }),
      timestamp: new Date().toISOString(),
    });
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({
      error: "Datos inválidos",
      detalles: error.errors,
      timestamp: new Date().toISOString(),
    });
  }

  res.status(500).json({
    error: "Error interno del servidor",
    ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
    timestamp: new Date().toISOString(),
  });
}

// Middleware 404
function NotFoundError(req, res) {
  res.status(404).json({
    error: "Ruta no encontrada",
    metodo: req.method,
    ruta: req.url,
    sugerencias: [
      "GET / - Información de la API",
      "POST /auth/login - Autenticación",
      "GET /api/tareas - Listar tareas (requiere auth)",
    ],
    timestamp: new Date().toISOString(),
  });
}

module.exports = { AppError, NotFoundError, ValidationError };
