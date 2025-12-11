// api-rest-completa.js
const express = require("express");
const { body, param, query, validationResult } = require("express-validator");
const { AppError, NotFoundError, ValidationError } = require("./errores");

// Crear aplicación
const app = express();
app.use(express.json());

// Base de datos simulada
let tareas = [
  {
    id: 1,
    titulo: "Aprender Express",
    descripcion: "Completar tutorial",
    completada: false,
    prioridad: "alta",
    usuarioId: 1,
  },
  {
    id: 2,
    titulo: "Crear API",
    descripcion: "Implementar endpoints",
    completada: true,
    prioridad: "media",
    usuarioId: 1,
  },
  {
    id: 3,
    titulo: "Testing",
    descripcion: "Probar con Postman",
    completada: false,
    prioridad: "baja",
    usuarioId: 2,
  },
];

let usuarios = [
  { id: 1, nombre: "Admin", email: "admin@example.com" },
  { id: 2, nombre: "Usuario", email: "user@example.com" },
];

let siguienteIdTarea = 4;

// Funciones helper
function encontrarTarea(id, usuarioId = null) {
  const tarea = tareas.find((t) => t.id === parseInt(id));
  if (!tarea) {
    throw new NotFoundError("Tarea");
  }
  if (usuarioId && tarea.usuarioId !== usuarioId) {
    throw new AppError("No tienes permisos para acceder a esta tarea", 403);
  }
  return tarea;
}

function encontrarUsuario(id) {
  const usuario = usuarios.find((u) => u.id === parseInt(id));
  if (!usuario) {
    throw new NotFoundError("Usuario");
  }
  return usuario;
}

// Middleware de autenticación simulada
function autenticar(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AppError("Token de autenticación requerido", 401);
  }

  const token = authHeader.substring(7);

  // Simular validación de token
  const payload = { userId: token === "admin-token" ? 1 : 2 };
  req.usuario = payload;
  next();
}

// Crear routers modulares
const tareasRouter = express.Router();
const usuariosRouter = express.Router();

// Middleware común para routers
tareasRouter.use(autenticar);
usuariosRouter.use(autenticar);

// RUTAS DE TAREAS

// GET /tareas - Listar tareas con filtros avanzados
tareasRouter.get(
  "/",
  [
    query("completada")
      .optional()
      .isIn(["true", "false"])
      .withMessage("completada debe ser true o false"),
    query("prioridad")
      .optional()
      .isIn(["baja", "media", "alta"])
      .withMessage("prioridad inválida"),
    query("usuario_id")
      .optional()
      .isInt({ min: 1 })
      .withMessage("usuario_id debe ser un número positivo"),
    query("pagina")
      .optional()
      .isInt({ min: 1 })
      .withMessage("pagina debe ser un número positivo"),
    query("limite")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("limite debe estar entre 1 y 100"),
    query("ordenar")
      .optional()
      .isIn(["titulo", "prioridad", "fecha"])
      .withMessage("ordenar inválido"),
  ],
  ValidationError,
  (req, res) => {
    let resultados = [...tareas];
    const {
      completada,
      prioridad,
      usuario_id,
      pagina = 1,
      limite = 10,
      ordenar,
      q, // búsqueda
    } = req.query;

    // Filtrar por usuario autenticado
    resultados = resultados.filter((t) => t.usuarioId === req.usuario.userId);

    // Filtros adicionales
    if (completada !== undefined) {
      resultados = resultados.filter(
        (t) => t.completada === (completada === "true")
      );
    }

    if (prioridad) {
      resultados = resultados.filter((t) => t.prioridad === prioridad);
    }

    if (usuario_id) {
      resultados = resultados.filter(
        (t) => t.usuarioId === parseInt(usuario_id)
      );
    }

    // Búsqueda
    if (q) {
      const termino = q.toLowerCase();
      resultados = resultados.filter(
        (t) =>
          t.titulo.toLowerCase().includes(termino) ||
          t.descripcion.toLowerCase().includes(termino)
      );
    }

    // Ordenamiento
    if (ordenar) {
      switch (ordenar) {
        case "titulo":
          resultados.sort((a, b) => a.titulo.localeCompare(b.titulo));
          break;
        case "prioridad":
          const prioridades = { baja: 1, media: 2, alta: 3 };
          resultados.sort(
            (a, b) => prioridades[b.prioridad] - prioridades[a.prioridad]
          );
          break;
      }
    }

    // Paginación
    const paginaNum = parseInt(pagina);
    const limiteNum = parseInt(limite);
    const inicio = (paginaNum - 1) * limiteNum;
    const paginados = resultados.slice(inicio, inicio + limiteNum);

    res.json({
      tareas: paginados,
      total: resultados.length,
      pagina: paginaNum,
      limite: limiteNum,
      paginasTotal: Math.ceil(resultados.length / limiteNum),
    });
  }
);

// GET /tareas/:id - Obtener tarea específica
tareasRouter.get(
  "/:id",
  param("id").isInt({ min: 1 }).withMessage("ID debe ser un número positivo"),
  ValidationError,
  (req, res) => {
    const tarea = encontrarTarea(req.params.id, req.usuario.userId);
    res.json(tarea);
  }
);

// POST /tareas - Crear nueva tarea
tareasRouter.post(
  "/",
  [
    body("titulo")
      .trim()
      .isLength({ min: 3, max: 100 })
      .withMessage("Título debe tener entre 3 y 100 caracteres"),
    body("descripcion")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Descripción no puede exceder 500 caracteres"),
    body("prioridad")
      .optional()
      .isIn(["baja", "media", "alta"])
      .withMessage("Prioridad inválida"),
    body("completada")
      .optional()
      .isBoolean()
      .withMessage("completada debe ser un booleano"),
  ],
  ValidationError,
  (req, res) => {
    const nuevaTarea = {
      id: siguienteIdTarea++,
      titulo: req.body.titulo,
      descripcion: req.body.descripcion || "",
      completada: req.body.completada || false,
      prioridad: req.body.prioridad || "media",
      usuarioId: req.usuario.userId,
      fechaCreacion: new Date().toISOString(),
    };

    tareas.push(nuevaTarea);
    res.status(201).json(nuevaTarea);
  }
);

// PUT /tareas/:id - Actualizar tarea completa
tareasRouter.put(
  "/:id",
  [
    param("id").isInt({ min: 1 }).withMessage("ID debe ser un número positivo"),
    body("titulo")
      .trim()
      .isLength({ min: 3, max: 100 })
      .withMessage("Título requerido"),
    body("descripcion")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Descripción muy larga"),
    body("prioridad")
      .isIn(["baja", "media", "alta"])
      .withMessage("Prioridad inválida"),
    body("completada").isBoolean().withMessage("completada debe ser booleano"),
  ],
  ValidationError,
  (req, res) => {
    const tarea = encontrarTarea(req.params.id, req.usuario.userId);

    tarea.titulo = req.body.titulo;
    tarea.descripcion = req.body.descripcion || "";
    tarea.prioridad = req.body.prioridad;
    tarea.completada = req.body.completada;
    tarea.fechaActualizacion = new Date().toISOString();

    res.json(tarea);
  }
);

// PATCH /tareas/:id - Actualizar parcialmente
tareasRouter.patch(
  "/:id",
  param("id").isInt({ min: 1 }).withMessage("ID debe ser un número positivo"),
  ValidationError,
  (req, res) => {
    const tarea = encontrarTarea(req.params.id, req.usuario.userId);
    const camposPermitidos = [
      "titulo",
      "descripcion",
      "prioridad",
      "completada",
    ];

    // Validar que al menos un campo sea proporcionado
    const camposActualizados = Object.keys(req.body);
    if (camposActualizados.length === 0) {
      throw new ValidationError(
        "Debe proporcionar al menos un campo para actualizar"
      );
    }

    // Validar campos individuales
    const errors = [];
    for (const campo of camposActualizados) {
      if (!camposPermitidos.includes(campo)) {
        errors.push(`${campo}: campo no permitido`);
        continue;
      }

      switch (campo) {
        case "titulo":
          if (
            typeof req.body[campo] !== "string" ||
            req.body[campo].trim().length < 3
          ) {
            errors.push("titulo: debe tener al menos 3 caracteres");
          }
          break;
        case "descripcion":
          if (
            typeof req.body[campo] !== "string" ||
            req.body[campo].length > 500
          ) {
            errors.push("descripcion: no puede exceder 500 caracteres");
          }
          break;
        case "prioridad":
          if (!["baja", "media", "alta"].includes(req.body[campo])) {
            errors.push("prioridad: debe ser baja, media o alta");
          }
          break;
        case "completada":
          if (typeof req.body[campo] !== "boolean") {
            errors.push("completada: debe ser un booleano");
          }
          break;
      }
    }

    if (errors.length > 0) {
      throw new ValidationError("Errores de validación", errors);
    }

    // Aplicar actualizaciones
    for (const campo of camposActualizados) {
      tarea[campo] =
        campo === "titulo" || campo === "descripcion"
          ? req.body[campo].trim()
          : req.body[campo];
    }

    tarea.fechaActualizacion = new Date().toISOString();
    res.json(tarea);
  }
);

// DELETE /tareas/:id - Eliminar tarea
tareasRouter.delete(
  "/:id",
  param("id").isInt({ min: 1 }).withMessage("ID debe ser un número positivo"),
  ValidationError,
  (req, res) => {
    const indice = tareas.findIndex(
      (t) =>
        t.id === parseInt(req.params.id) && t.usuarioId === req.usuario.userId
    );

    if (indice === -1) {
      throw new NotFoundError("Tarea");
    }

    const tareaEliminada = tareas.splice(indice, 1)[0];
    res.json({ mensaje: "Tarea eliminada", tarea: tareaEliminada });
  }
);

// RUTAS DE USUARIOS

// GET /usuarios/:id - Obtener perfil de usuario
usuariosRouter.get(
  "/:id",
  param("id").isInt({ min: 1 }).withMessage("ID debe ser un número positivo"),
  ValidationError,
  (req, res) => {
    const usuario = encontrarUsuario(req.params.id);
    // Solo devolver datos públicos
    const { id, nombre, email } = usuario;
    res.json({ id, nombre, email });
  }
);

// Usar routers en la aplicación
app.use("/api/tareas", tareasRouter);
app.use("/api/usuarios", usuariosRouter);

// Ruta de login simulada
app.post("/auth/login", (req, res) => {
  const { email, password } = req.body;

  if (email === "admin@example.com" && password === "admin123") {
    res.json({ token: "admin-token", usuario: { id: 1, nombre: "Admin" } });
  } else if (email === "user@example.com" && password === "user123") {
    res.json({ token: "user-token", usuario: { id: 2, nombre: "Usuario" } });
  } else {
    res.status(401).json({ error: "Credenciales inválidas" });
  }
});

// Información de la API
app.get("/", (req, res) => {
  res.json({
    nombre: "API REST Completa con Express",
    version: "1.0.0",
    descripcion: "API con routing avanzado, validación y manejo de errores",
    endpoints: {
      auth: {
        "POST /auth/login": "Autenticación",
      },
      tareas: {
        "GET /api/tareas": "Listar tareas (con filtros)",
        "GET /api/tareas/:id": "Obtener tarea específica",
        "POST /api/tareas": "Crear tarea",
        "PUT /api/tareas/:id": "Actualizar tarea completa",
        "PATCH /api/tareas/:id": "Actualizar tarea parcial",
        "DELETE /api/tareas/:id": "Eliminar tarea",
      },
      usuarios: {
        "GET /api/usuarios/:id": "Obtener perfil de usuario",
      },
    },
    autenticacion: "Bearer token en header Authorization",
    ejemplos: {
      login:
        'POST /auth/login con {"email":"admin@example.com","password":"admin123"}',
      listar: "GET /api/tareas (con header: Authorization: Bearer admin-token)",
      crear: "POST /api/tareas con body y header de auth",
    },
  });
});

app.use(AppError); // Middleware de error centralizado
app.use(NotFoundError); // Middleware 404

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 API REST Completa ejecutándose en http://localhost:${PORT}`);
  console.log(`📖 Documentación en http://localhost:${PORT}`);
  console.log(`🔐 Login: POST /auth/login con credenciales de ejemplo`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n👋 Cerrando servidor...");
  process.exit(0);
});
