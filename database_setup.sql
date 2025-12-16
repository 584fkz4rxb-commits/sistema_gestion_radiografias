-- Crear base de datos
CREATE DATABASE IF NOT EXISTS sistema_gestion_radiografias;
USE sistema_gestion_radiografias;

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  tipo_usuario ENUM('admin', 'tecnico', 'paciente') NOT NULL,
  nombre_completo VARCHAR(100) NOT NULL,
  email VARCHAR(100),
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  activo BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de pacientes
CREATE TABLE IF NOT EXISTS pacientes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nombre VARCHAR(100) NOT NULL,
  usuario_id INT,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de radiografías
CREATE TABLE IF NOT EXISTS radiografias (
  id INT PRIMARY KEY AUTO_INCREMENT,
  paciente_id INT NOT NULL,
  tecnico_id INT,
  titulo VARCHAR(200) NOT NULL,
  descripcion TEXT,
  tipo_radiografia VARCHAR(50),
  archivo_path VARCHAR(255),
  fecha_captura DATE,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  activo BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  FOREIGN KEY (tecnico_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de códigos de acceso
CREATE TABLE IF NOT EXISTS codigos_acceso (
  id INT PRIMARY KEY AUTO_INCREMENT,
  codigo VARCHAR(50) UNIQUE NOT NULL,
  tipo_usuario ENUM('admin', 'tecnico', 'paciente') NOT NULL,
  usado BOOLEAN DEFAULT FALSE,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_uso TIMESTAMP NULL,
  creado_por INT,
  FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de auditoría
CREATE TABLE IF NOT EXISTS auditoria (
  id INT PRIMARY KEY AUTO_INCREMENT,
  usuario_id INT,
  accion VARCHAR(200),
  tabla_afectada VARCHAR(100),
  fecha_accion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  detalles TEXT,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar códigos de acceso iniciales
INSERT INTO codigos_acceso (codigo, tipo_usuario, usado) VALUES
('ADMIN001', 'admin', FALSE),
('TECNICO001', 'tecnico', FALSE),
('PACIENTE001', 'paciente', FALSE),
('PACIENTE002', 'paciente', FALSE);
