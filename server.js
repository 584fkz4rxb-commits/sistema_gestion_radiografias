const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const session = require('express-session');
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs').promises;
require('dotenv').config();

// Configurar pool de conexiones MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER || 'gestor_radiografias',
  password: process.env.DB_PASSWORD || '17Oct2005',
  database: process.env.DB_NAME || 'sistema_gestion_radiografias',
  timezone: process.env.TIMEZONE || 'America/Tijuana',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Configurar almacenamiento de archivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = 'uploads/';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido'), false);
    }
  }
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configurar sesión
app.use(session({
  secret: process.env.SESSION_SECRET || 'clave_super_secreta',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production'
  }
}));

// Middleware de autenticación
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

// Middleware de roles
function requireRole(roles) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.redirect('/login');
    }
    
    const userRole = req.session.user.tipo_usuario;
    const hasAccess = Array.isArray(roles) 
      ? roles.includes(userRole)
      : roles === userRole;

    if (hasAccess) {
      next();
    } else {
      res.status(403).render('error', {
        title: 'Acceso Denegado',
        message: 'No tienes permisos para acceder a esta página.',
        user: req.session.user
      });
    }
  };
}

// Configurar EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ========== RUTAS PÚBLICAS ==========

// Ruta de login
app.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render('login', { 
    title: 'Iniciar Sesión',
    error: null 
  });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const [users] = await pool.query(
      'SELECT * FROM usuarios WHERE username = ?',
      [username]
    );
    
    if (users.length === 0) {
      return res.render('login', {
        title: 'Iniciar Sesión',
        error: 'Usuario no encontrado'
      });
    }
    
    const user = users[0];
    const match = await bcrypt.compare(password, user.password);
    
    if (!match) {
      return res.render('login', {
        title: 'Iniciar Sesión',
        error: 'Contraseña incorrecta'
      });
    }
    
    req.session.user = {
      id: user.id,
      username: user.username,
      tipo_usuario: user.tipo_usuario,
      nombre_completo: user.nombre_completo
    };
    
    res.redirect('/');
    
  } catch (err) {
    console.error('Error en login:', err);
    res.render('login', {
      title: 'Iniciar Sesión',
      error: 'Error interno del servidor'
    });
  }
});

// Ruta de registro
app.get('/registro', (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render('registro', { 
    title: 'Registro',
    error: null 
  });
});

app.post('/registro', async (req, res) => {
  const { username, password, codigo_acceso, nombre_completo, email } = req.body;
  
  try {
    // Verificar código de acceso (insensible a mayúsculas)
    const [codigos] = await pool.query(
      'SELECT * FROM codigos_acceso WHERE UPPER(codigo) = UPPER(?) AND usado = FALSE',
      [codigo_acceso]
    );
    
    if (codigos.length === 0) {
      return res.render('registro', {
        title: 'Registro',
        error: 'Código de acceso inválido o ya utilizado'
      });
    }
    
    const codigo = codigos[0];
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Iniciar transacción
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      // Insertar usuario
      const [result] = await connection.query(
        `INSERT INTO usuarios (username, password, tipo_usuario, nombre_completo, email) 
         VALUES (?, ?, ?, ?, ?)`,
        [username, hashedPassword, codigo.tipo_usuario, nombre_completo, email]
      );
      
      const userId = result.insertId;
      
      // Si es paciente, crear registro en tabla pacientes
      if (codigo.tipo_usuario === 'paciente') {
        await connection.query(
          `INSERT INTO pacientes (nombre, usuario_id) VALUES (?, ?)`,
          [nombre_completo, userId]
        );
      }
      
      // Marcar código como usado
      await connection.query(
        'UPDATE codigos_acceso SET usado = TRUE, fecha_uso = NOW() WHERE id = ?',
        [codigo.id]
      );
      
      await connection.commit();
      connection.release();
      
      // Mostrar página de éxito
      res.send(`
        <html>
          <head>
            <link rel="stylesheet" href="/styles.css">
            <title>Registro Exitoso</title>
          </head>
          <body>
            <div class="success-container">
              <h1>✅ Registro Exitoso</h1>
              <p>Usuario <strong>${username}</strong> registrado como <strong>${codigo.tipo_usuario}</strong></p>
              <p>Ya puedes iniciar sesión con tus credenciales.</p>
              <a href="/login" class="btn btn-primary">Iniciar Sesión</a>
            </div>
          </body>
        </html>
      `);
      
    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
    
  } catch (err) {
    console.error('Error en registro:', err);
    res.render('registro', {
      title: 'Registro',
      error: 'Error al registrar usuario. Intente nuevamente.'
    });
  }
});

// ========== RUTAS PROTEGIDAS ==========

// Dashboard principal
app.get('/', requireLogin, async (req, res) => {
  try {
    // Obtener estadísticas básicas
    const [stats] = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM pacientes) as total_pacientes,
        (SELECT COUNT(*) FROM usuarios WHERE tipo_usuario = 'medico') as total_medicos,
        (SELECT COUNT(*) FROM usuarios WHERE tipo_usuario = 'paciente') as total_pacientes_usuarios
    `);
    
    res.render('dashboard', {
      title: 'Dashboard',
      user: req.session.user,
      stats: stats[0]
    });
    
  } catch (err) {
    console.error('Error cargando dashboard:', err);
    res.render('dashboard', {
      title: 'Dashboard',
      user: req.session.user,
      stats: { total_pacientes: 0, total_medicos: 0, total_pacientes_usuarios: 0 }
    });
  }
});

// API para menú dinámico
app.get('/api/menu', requireLogin, (req, res) => {
  const baseMenu = [
    { nombre: 'Dashboard', url: '/', icon: '🏠' },
    { nombre: 'Pacientes', url: '/pacientes', icon: '👨‍⚕️' },
    { nombre: 'Búsqueda', url: '/busqueda', icon: '🔍' }
  ];
  
  if (req.session.user.tipo_usuario === 'admin') {
    baseMenu.push(
      { nombre: 'Usuarios', url: '/usuarios', icon: '👥' },
      { nombre: 'Códigos', url: '/codigos', icon: '🔑' },
      { nombre: 'Estadísticas', url: '/estadisticas', icon: '📈' }
    );
  } else if (req.session.user.tipo_usuario === 'medico') {
    baseMenu.push(
      { nombre: 'Mis Pacientes', url: '/mis-pacientes', icon: '👨‍⚕️' },
      { nombre: 'Reportes', url: '/reportes', icon: '📄' }
    );
  } else if (req.session.user.tipo_usuario === 'paciente') {
    baseMenu.push(
      { nombre: 'Mis Datos', url: '/mis-datos', icon: '👤' }
    );
  }
  
  baseMenu.push({ nombre: 'Cerrar Sesión', url: '/logout', icon: '🚪' });
  
  res.json(baseMenu);
});

// Gestión de pacientes
app.get('/pacientes', requireLogin, requireRole(['admin', 'medico']), async (req, res) => {
  try {
    const [pacientes] = await pool.query('SELECT * FROM pacientes LIMIT 50');
    
    res.render('pacientes', {
      title: 'Pacientes',
      user: req.session.user,
      pacientes
    });
    
  } catch (err) {
    console.error('Error cargando pacientes:', err);
    res.render('error', {
      title: 'Error',
      message: 'Error al cargar pacientes',
      user: req.session.user
    });
  }
});

// Formulario para crear nuevo paciente
app.get('/pacientes/nuevo', requireLogin, requireRole(['admin', 'medico']), (req, res) => {
  res.render('paciente-nuevo', {
    title: 'Nuevo Paciente',
    user: req.session.user,
    error: null
  });
});

// Crear nuevo paciente
app.post('/pacientes/nuevo', requireLogin, requireRole(['admin', 'medico']), async (req, res) => {
  const { nombre, edad, genero } = req.body;
  
  try {
    // Validar datos
    if (!nombre || nombre.trim() === '') {
      return res.render('paciente-nuevo', {
        title: 'Nuevo Paciente',
        user: req.session.user,
        error: 'El nombre del paciente es requerido'
      });
    }
    
    // Insertar paciente
    const [result] = await pool.query(
      'INSERT INTO pacientes (nombre, edad, genero) VALUES (?, ?, ?)',
      [nombre, edad || null, genero || null]
    );
    
    res.redirect('/pacientes');
    
  } catch (err) {
    console.error('Error creando paciente:', err);
    res.render('paciente-nuevo', {
      title: 'Nuevo Paciente',
      user: req.session.user,
      error: 'Error al crear paciente'
    });
  }
});

// Búsqueda en tiempo real
app.get('/busqueda', requireLogin, (req, res) => {
  res.render('busqueda', {
    title: 'Búsqueda',
    user: req.session.user
  });
});

// Ver paciente específico
app.get('/pacientes/:id', requireLogin, requireRole(['admin', 'medico']), async (req, res) => {
  try {
    const [pacientes] = await pool.query('SELECT * FROM pacientes WHERE id = ?', [req.params.id]);
    
    if (pacientes.length === 0) {
      return res.status(404).render('error', {
        title: 'Paciente no encontrado',
        message: 'El paciente que buscas no existe.',
        user: req.session.user
      });
    }
    
    const paciente = pacientes[0];
    const [radiografias] = await pool.query('SELECT * FROM radiografias WHERE paciente_id = ?', [req.params.id]);
    
    res.render('paciente-detalle', {
      title: `Paciente: ${paciente.nombre}`,
      user: req.session.user,
      paciente,
      radiografias
    });
    
  } catch (err) {
    console.error('Error cargando paciente:', err);
    res.render('error', {
      title: 'Error',
      message: 'Error al cargar paciente',
      user: req.session.user
    });
  }
});

// API para búsqueda en tiempo real
app.get('/api/buscar/pacientes', requireLogin, async (req, res) => {
  const { q } = req.query;
  
  if (!q || q.length < 2) {
    return res.json([]);
  }
  
  try {
    const [resultados] = await pool.query(
      'SELECT id, nombre, edad FROM pacientes WHERE nombre LIKE ? LIMIT 10',
      [`%${q}%`]
    );
    
    res.json(resultados);
  } catch (err) {
    console.error('Error en búsqueda:', err);
    res.json([]);
  }
});

// Importar/Exportar
app.get('/importar-exportar', requireLogin, requireRole(['admin', 'medico']), (req, res) => {
  res.render('importar-exportar', {
    title: 'Importar/Exportar',
    user: req.session.user
  });
});

// Importar desde Excel
app.post('/importar/pacientes', 
  requireLogin, 
  requireRole(['admin', 'medico']), 
  upload.single('archivo'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.send(`
          <html>
            <head><link rel="stylesheet" href="/styles.css"></head>
            <body>
              <div class="error-container">
                <h2>Error</h2>
                <p>No se subió ningún archivo</p>
                <a href="/importar-exportar" class="btn">Volver</a>
              </div>
            </body>
          </html>
        `);
      }
      
      const workbook = xlsx.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
      
      let importados = 0;
      let errores = 0;
      
      for (const row of data) {
        try {
          await pool.query(
            `INSERT INTO pacientes (nombre, edad, genero) VALUES (?, ?, ?)`,
            [row.nombre || row.Nombre, row.edad || row.Edad, row.genero || row.Genero]
          );
          importados++;
        } catch (err) {
          console.error('Error insertando fila:', err);
          errores++;
        }
      }
      
      // Eliminar archivo temporal
      await fs.unlink(req.file.path);
      
      res.send(`
        <html>
          <head><link rel="stylesheet" href="/styles.css"></head>
          <body>
            <div class="success-container">
              <h2>✅ Importación Completa</h2>
              <p>Registros importados: <strong>${importados}</strong></p>
              <p>Errores: <strong>${errores}</strong></p>
              <a href="/importar-exportar" class="btn btn-primary">Volver</a>
            </div>
          </body>
        </html>
      `);
      
    } catch (err) {
      console.error('Error importando Excel:', err);
      res.send(`
        <html>
          <head><link rel="stylesheet" href="/styles.css"></head>
          <body>
            <div class="error-container">
              <h2>Error</h2>
              <p>Error procesando el archivo Excel</p>
              <a href="/importar-exportar" class="btn">Volver</a>
            </div>
          </body>
        </html>
      `);
    }
});

// Exportar a Excel
app.get('/exportar/pacientes', requireLogin, requireRole(['admin', 'medico']), async (req, res) => {
  try {
    const [pacientes] = await pool.query('SELECT * FROM pacientes');
    
    const worksheet = xlsx.utils.json_to_sheet(pacientes);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Pacientes');
    
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=pacientes.xlsx');
    res.send(buffer);
    
  } catch (err) {
    console.error('Error exportando Excel:', err);
    res.status(500).send('Error exportando datos');
  }
});

// Gestión de usuarios (solo admin)
app.get('/usuarios', requireLogin, requireRole('admin'), async (req, res) => {
  try {
    const [usuarios] = await pool.query('SELECT id, username, tipo_usuario, nombre_completo, email FROM usuarios');
    
    res.render('usuarios', {
      title: 'Usuarios',
      user: req.session.user,
      usuarios
    });
    
  } catch (err) {
    console.error('Error cargando usuarios:', err);
    res.render('error', {
      title: 'Error',
      message: 'Error al cargar usuarios',
      user: req.session.user
    });
  }
});

// Gestión de códigos (solo admin)
app.get('/codigos', requireLogin, requireRole('admin'), async (req, res) => {
  try {
    const [codigos] = await pool.query('SELECT * FROM codigos_acceso');
    
    res.render('codigos', {
      title: 'Códigos de Acceso',
      user: req.session.user,
      codigos
    });
    
  } catch (err) {
    console.error('Error cargando códigos:', err);
    res.render('error', {
      title: 'Error',
      message: 'Error al cargar códigos',
      user: req.session.user
    });
  }
});

// Crear nuevo código (solo admin)
app.post('/codigos/nuevo', requireLogin, requireRole('admin'), async (req, res) => {
  const { codigo, tipo_usuario } = req.body;
  
  try {
    await pool.query(
      'INSERT INTO codigos_acceso (codigo, tipo_usuario) VALUES (?, ?)',
      [codigo, tipo_usuario]
    );
    
    res.redirect('/codigos');
  } catch (err) {
    console.error('Error creando código:', err);
    res.render('error', {
      title: 'Error',
      message: 'Error al crear código',
      user: req.session.user
    });
  }
});

// Estadísticas
app.get('/estadisticas', requireLogin, requireRole(['admin', 'medico']), async (req, res) => {
  try {
    const [estadisticas] = await pool.query(`
      SELECT 
        COUNT(*) as total_pacientes,
        AVG(edad) as edad_promedio,
        COUNT(CASE WHEN genero = 'M' THEN 1 END) as hombres,
        COUNT(CASE WHEN genero = 'F' THEN 1 END) as mujeres
      FROM pacientes
    `);
    
    const [usuariosPorTipo] = await pool.query(`
      SELECT tipo_usuario, COUNT(*) as cantidad 
      FROM usuarios 
      GROUP BY tipo_usuario
    `);
    
    res.render('estadisticas', {
      title: 'Estadísticas',
      user: req.session.user,
      estadisticas: estadisticas[0],
      usuariosPorTipo
    });
    
  } catch (err) {
    console.error('Error cargando estadísticas:', err);
    res.render('error', {
      title: 'Error',
      message: 'Error al cargar estadísticas',
      user: req.session.user
    });
  }
});

// Logout
app.get('/logout', requireLogin, (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// ========== RUTAS DE API ADICIONALES ==========

// Obtener tipo de usuario
app.get('/api/tipo-usuario', requireLogin, (req, res) => {
  res.json({ tipo_usuario: req.session.user.tipo_usuario });
});

// ========== MANEJO DE ERRORES ==========

// 404 - Página no encontrada
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Página no encontrada',
    message: 'La página que buscas no existe.',
    user: req.session.user || null
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', {
    title: 'Error del servidor',
    message: 'Ocurrió un error interno. Por favor, intenta nuevamente.',
    user: req.session.user || null
  });
});

// ========== INICIAR SERVIDOR ==========

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📊 Base de datos: ${process.env.DB_NAME || 'gestion_radiografias'}`);
});