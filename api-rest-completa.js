// api-rest-completa.js
const express = require("express");
const { body, param, query, validationResult } = require("express-validator");
const { AppError, NotFoundError } = require("./errores.js");

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
    categoriaId: 1,
  },
  {
    id: 2,
    titulo: "Crear API",
    descripcion: "Implementar endpoints",
    completada: true,
    prioridad: "media",
    usuarioId: 1,
    categoriaId: 2,
  },
  {
    id: 3,
    titulo: "Testing",
    descripcion: "Probar con Postman",
    completada: false,
    prioridad: "baja",
    usuarioId: 2,
    categoriaId: 1,
  },
];

let usuarios = [
  { id: 1, nombre: "Admin", email: "admin@example.com" },
  { id: 2, nombre: "Usuario", email: "user@example.com" },
];

let categorias = [
  { id: 1, nombre: "Desarrollo" },
  { id: 2, nombre: "Personal" },
  { id: 3, nombre: "Hogar" },
];

let siguienteIdTarea = 4;
let siguienteIdCategoria = 4;

// Middleware de validación
const validarErrores = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Datos inválidos", errors.array());
  }
  next();
};

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

function encontrarCategoria(id) {
  const categoria = categorias.find((c) => c.id === parseInt(id));
  if (!categoria) {
    throw new NotFoundError("Categoría");
  }
  return categoria;
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
const categoriasRouter = express.Router();
const estadisticasRouter = express.Router();

// Middleware común para routers
tareasRouter.use(autenticar);
usuariosRouter.use(autenticar);
categoriasRouter.use(autenticar);
estadisticasRouter.use(autenticar);

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
  validarErrores,
  (req, res) => {
    let resultados = [...tareas];
    const {
      completada,
      prioridad,
      usuario_id,
      categoria_id,
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

    if (categoria_id) {
      const catId = parseInt(categoria_id);
      resultados = resultados.filter((t) => t.categoriaId === catId);
    }

    // Búsqueda
    if (q) {
      const terminos = q
        .split(/\s+OR\s+/i)
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0);

      if (terminos.length > 1) {
        resultados = resultados.filter((t) => {
          return terminos.some(
            (termino) =>
              t.titulo.toLowerCase().includes(termino) ||
              t.descripcion.toLowerCase().includes(termino)
          );
        });
      } else if (terminos.length === 1) {
        const termino = terminos[0];
        resultados = resultados.filter(
          (t) =>
            t.titulo.toLowerCase().includes(termino) ||
            t.descripcion.toLowerCase().includes(termino)
        );
      }
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
  validarErrores,
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
    body("categoriaId")
      .isInt({ min: 1 })
      .withMessage("ID de categoría requerido y debe ser un número positivo")
      .custom((value) => {
        if (!encontrarCategoria(value)) {
          throw new Error("La categoría especificada no existe");
        }
        return true;
      }),
  ],
  validarErrores,
  (req, res) => {
    const nuevaTarea = {
      id: siguienteIdTarea++,
      titulo: req.body.titulo,
      descripcion: req.body.descripcion || "",
      completada: req.body.completada || false,
      prioridad: req.body.prioridad || "media",
      usuarioId: req.usuario.userId,
      categoriaId: req.body.categoriaId,
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
    body("categoriaId")
      .isInt({ min: 1 })
      .withMessage("ID de categoría requerido y debe ser un número positivo")
      .custom((value) => {
        if (!encontrarCategoria(value)) {
          throw new Error("La categoría especificada no existe");
        }
        return true;
      }),
  ],
  validarErrores,
  (req, res) => {
    const tarea = encontrarTarea(req.params.id, req.usuario.userId);

    tarea.titulo = req.body.titulo;
    tarea.descripcion = req.body.descripcion || "";
    tarea.prioridad = req.body.prioridad;
    tarea.completada = req.body.completada;
    tarea.categoriaId = req.body.categoriaId;
    tarea.fechaActualizacion = new Date().toISOString();

    res.json(tarea);
  }
);

// PATCH /tareas/:id - Actualizar parcialmente
tareasRouter.patch(
  "/:id",
  param("id").isInt({ min: 1 }).withMessage("ID debe ser un número positivo"),
  validarErrores,
  (req, res) => {
    const tarea = encontrarTarea(req.params.id, req.usuario.userId);
    const camposPermitidos = [
      "titulo",
      "descripcion",
      "prioridad",
      "completada",
      "categoriaId",
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

        case "categoriaId":
          const catId = parseInt(req.body[campo]);
          if (isNaN(catId) || catId <= 0 || !encontrarCategoria(catId)) {
            errors.push("categoriaId: debe ser un ID de categoría válido");
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
  validarErrores,
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
  validarErrores,
  (req, res) => {
    const usuario = encontrarUsuario(req.params.id);
    // Solo devolver datos públicos
    const { id, nombre, email } = usuario;
    res.json({ id, nombre, email });
  }
);

// RUTAS DE CATEGORÍAS

// GET /categorias - Listar todas las categorías
categoriasRouter.get("/", (req, res) => {
  res.json(categorias);
});

// GET /categorias/:id - Obtener categoría específica
categoriasRouter.get(
  "/:id",
  param("id").isInt({ min: 1 }).withMessage("ID debe ser un número positivo"),
  validarErrores,
  (req, res) => {
    const categoria = encontrarCategoria(req.params.id);
    res.json(categoria);
  }
);

// POST /categorias - Crear nueva categoría
categoriasRouter.post(
  "/",
  [
    body("nombre")
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage("Nombre debe tener entre 2 y 50 caracteres"),
  ],
  validarErrores,
  (req, res) => {
    const nuevaCategoria = {
      id: siguienteIdCategoria++,
      nombre: req.body.nombre,
    };

    categorias.push(nuevaCategoria);
    res.status(201).json(nuevaCategoria);
  }
);

// DELETE /categorias/:id - Eliminar categoría
categoriasRouter.delete(
  "/:id",
  param("id").isInt({ min: 1 }).withMessage("ID debe ser un número positivo"),
  validarErrores,
  (req, res) => {
    const catId = parseInt(req.params.id);
    const indice = categorias.findIndex((c) => c.id === catId);

    if (indice === -1) {
      throw new NotFoundError("Categoría");
    }

    const tareasAsociadas = tareas.filter((t) => t.categoriaId === catId);
    if (tareasAsociadas.length > 0) {
      throw new AppError(
        "No se puede eliminar la categoría porque tiene tareas asociadas",
        409
      );
    }

    const categoriaEliminada = categorias.splice(indice, 1)[0];
    res.json({ mensaje: "Categoría eliminada", categoria: categoriaEliminada });
  }
);

// RUTAS DE ESTADÍSTICAS

// GET /estadisticas/tareas-completadas - Conteo de tareas completadas
estadisticasRouter.get("/tareas-completadas", (req, res) => {
  const tareasDelUsuario = tareas.filter(
    (t) => t.usuarioId === req.usuario.userId
  );

  const totalTareas = tareasDelUsuario.length;
  const tareasCompletadas = tareasDelUsuario.filter((t) => t.completada).length;
  const tareasPendientes = totalTareas - tareasCompletadas;

  const porcentajeCompletadas =
    totalTareas > 0 ? (tareasCompletadas / totalTareas) * 100 : 0;

  res.json({
    usuarioId: req.usuario.userId,
    totalTareas: totalTareas,
    completadas: tareasCompletadas,
    pendientes: tareasPendientes,
    porcentajeCompletadas: parseFloat(porcentajeCompletadas.toFixed(2)),
  });
});

// GET /estadisticas/productividad-por-usuario - Productividad por usuario
estadisticasRouter.get("/productividad-por-usuario", (req, res) => {
  if (req.usuario.userId !== 1) {
    throw new AppError(
      "Acceso denegado. Solo administradores pueden ver la productividad global.",
      403
    );
  }

  const productividad = {};

  usuarios.forEach((u) => {
    productividad[u.id] = {
      nombre: u.nombre,
      totalTareas: 0,
      completadas: 0,
      pendientes: 0,
      porcentajeCompletadas: 0,
    };
  });

  tareas.forEach((tarea) => {
    const userId = tarea.usuarioId;
    if (productividad[userId]) {
      productividad[userId].totalTareas++;
      if (tarea.completada) {
        productividad[userId].completadas++;
      } else {
        productividad[userId].pendientes++;
      }
    }
  });

  Object.values(productividad).forEach((stats) => {
    if (stats.totalTareas > 0) {
      stats.porcentajeCompletadas = parseFloat(
        ((stats.completadas / stats.totalTareas) * 100).toFixed(2)
      );
    }
  });

  res.json(Object.values(productividad));
});

// Usar routers en la aplicación
app.use("/api/tareas", tareasRouter);
app.use("/api/usuarios", usuariosRouter);
app.use("/api/categorias", categoriasRouter);
app.use("/api/estadisticas", estadisticasRouter);

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
    descripcion:
      "API con routing avanzado, validación, manejo de errores y categorías",
    endpoints: {
      auth: {
        "POST /auth/login": "Autenticación",
      },
      tareas: {
        "GET /api/tareas":
          "Listar tareas (con filtros, incluyendo categoria_id)",
        "GET /api/tareas/:id": "Obtener tarea específica",
        "POST /api/tareas": "Crear tarea (requiere categoriaId)",
        "PUT /api/tareas/:id":
          "Actualizar tarea completa (requiere categoriaId)",
        "PATCH /api/tareas/:id":
          "Actualizar tarea parcial (opcionalmente categoriaId)",
        "DELETE /api/tareas/:id": "Eliminar tarea",
      },
      usuarios: {
        "GET /api/usuarios/:id": "Obtener perfil de usuario",
      },
      categorias: {
        "GET /api/categorias": "Listar todas las categorías",
        "GET /api/categorias/:id": "Obtener categoría específica",
        "POST /api/categorias": "Crear categoría",
        "DELETE /api/categorias/:id":
          "Eliminar categoría (si no tiene tareas asociadas)",
      },
      estadisticas: {
        "GET /api/estadisticas/tareas-completadas":
          "Estadísticas de tareas completadas del usuario autenticado",
        "GET /api/estadisticas/productividad-por-usuario":
          "Productividad de todos los usuarios (solo Admin)",
      },
    },
    autenticacion: "Bearer token en header Authorization",
    ejemplos: {
      login:
        'POST /auth/login con {"email":"admin@example.com","password":"admin123"}',
      listar:
        "GET /api/tareas?categoria_id=1 (con header: Authorization: Bearer admin-token)",
      crear_categoria: 'POST /api/categorias con {"nombre":"Compras"}',
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
