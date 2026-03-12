CREATE DATABASE IF NOT EXISTS dms_db;
USE dms_db;

CREATE TABLE departments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE plants (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  location VARCHAR(200),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE plant_components (
  id INT PRIMARY KEY AUTO_INCREMENT,
  plant_id INT NOT NULL,
  department_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT
);

CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','supervisor','operator') NOT NULL DEFAULT 'operator',
  department_id INT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);

CREATE TABLE drawings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  drawing_number VARCHAR(100),
  revision VARCHAR(20) DEFAULT 'A',
  file_path VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  component_id INT,
  department_id INT NOT NULL,
  plant_id INT NOT NULL,
  status ENUM('active','archived','under_review') DEFAULT 'active',
  uploaded_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (component_id) REFERENCES plant_components(id) ON DELETE SET NULL,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
  FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT
);

-- Seed data
INSERT INTO departments (name, description) VALUES
('Civil', 'Civil engineering department'),
('Mechanical', 'Mechanical engineering department'),
('Electrical', 'Electrical engineering department'),
('Instrumentation', 'Instrumentation and control department'),
('Chemical', 'Chemical process department');

INSERT INTO plants (name, location, description) VALUES
('Plant Alpha', 'Site A, North Region', 'Main thermal power plant'),
('Plant Beta', 'Site B, South Region', 'Hydro power plant');

INSERT INTO plant_components (plant_id, department_id, name, description) VALUES
(1, 1, 'Main Building Structure', 'Primary structural components'),
(1, 2, 'Turbine Unit 1', 'Steam turbine generator unit 1'),
(1, 2, 'Boiler System', 'Main boiler and auxiliary systems'),
(1, 3, 'Main Switchyard', 'High voltage switchyard'),
(1, 4, 'Control Room', 'Main control room systems'),
(2, 1, 'Dam Structure', 'Main dam and spillway'),
(2, 2, 'Turbine Unit A', 'Hydro turbine unit A'),
(2, 3, 'Transformer Station', 'Step-up transformers');
