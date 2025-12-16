🏥 Sistema de Gestión de Radiografías

Sistema web completo para gestión médica de radiografías con autenticación por roles, base de datos MySQL y funcionalidades avanzadas para administradores, médicos y pacientes.

🚀 Características Principales

🔐 Autenticación por Roles: Admin, Médico y Paciente con permisos diferenciados
📊 Base de Datos MySQL: Usuario personalizado, tablas relacionadas, vistas SQL
🖼️ Gestión de Radiografías: Subida, visualización y organización de imágenes médicas
📈 Estadísticas Avanzadas: Funciones de agregación, subconsultas, reportes PDF
🔍 Búsqueda en Tiempo Real: Sistema de búsqueda instantánea (keyup)
📁 Importación/Exportación: Soporte para Excel y generación de reportes PDF
⚡ Transacciones SQL: Integridad de datos en operaciones críticas
🛠️ Tecnologías Utilizadas

Backend: Node.js + Express
Base de Datos: MySQL (usuario personalizado)
Frontend: HTML5, CSS3, JavaScript (EJS templates)
Seguridad: bcrypt, express-session, variables de entorno (.env)
Archivos: Multer, XLSX, PDFKit
Desarrollo: Nodemon, Git
📦 Instalación Rápida

bash
# 1. Clonar repositorio
git clone [tu-repositorio]
cd sistema_gestion_radiografias

# 2. Instalar dependencias
npm install

# 3. Configurar base de datos (MySQL)
mysql -u root -p < database_setup.sql

# 4. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# 5. Iniciar servidor
npm run dev
🎯 Credenciales de Prueba

text
Admin: usuario=admin, contraseña=admin123
Códigos de registro: ADMIN123 (admin), MEDICO456 (médico), PACIENTE001 (paciente)
📁 Estructura del Proyecto

text
sistema_gestion_radiografias/
├── server.js              # Servidor principal
├── database_setup.sql     # Script SQL completo
├── public/               # Archivos estáticos
├── views/               # Plantillas EJS
├── uploads/             # Almacenamiento de archivos
├── .env                 # Variables de entorno
└── package.json         # Dependencias
📋 Requisitos Cumplidos (Proyecto 10)

✅ Usuario personalizado MySQL
✅ Tablas con PK/FK y 4+ tipos de datos
✅ Funciones de agregación y subconsultas
✅ Vistas SQL y transacciones
✅ Variables de entorno (.env) y rutas protegidas
✅ 3 roles de usuario con permisos granulares
✅ Barra de navegación dinámica
✅ Búsqueda en tiempo real (keyup)
✅ Subida de archivos (Excel, PDF, imágenes)
✅ Reinicio automático con nodemon
✅ Funcionalidades adicionales biomédicas

🌐 Acceso

URL: http://localhost:3000
Puerto: 3000 (configurable en .env)
📝 Documentación Adicional

Reporte Técnico: Incluido en la bitácora del curso
Video Demostrativo: 5 minutos mostrando funcionalidades
Código Fuente: Disponible en GitHub
👨‍💻 Autor

Emiliano Villalobos García
Ingeniería Biomédica - 5° Semestre
Tecnológico Nacional de México en Tijuana
Materia: Tecnologías de Bases de Datos

📄 Licencia

Este proyecto fue desarrollado para fines académicos como parte del Proyecto Final de la materia de Tecnologías de Bases de Datos.

Proyecto entregado el diciembre de 2024
