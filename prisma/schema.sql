-- AnmeraStore Database Schema
-- Compatible con PostgreSQL y MySQL
-- Generado desde Prisma Schema

-- Tabla de Usuarios
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    street VARCHAR(255),
    neighborhood VARCHAR(255),
    city VARCHAR(255),
    department VARCHAR(255),
    role VARCHAR(20) DEFAULT 'CUSTOMER' NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
    INDEX idx_users_email (email)
);

-- Tabla de Categorías
CREATE TABLE categories (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
);

-- Tabla de Productos
CREATE TABLE products (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    price INT NOT NULL,
    images JSON NOT NULL, -- Array de URLs
    stock INT DEFAULT 0 NOT NULL,
    sizes JSON NOT NULL, -- Array de tallas
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    featured BOOLEAN DEFAULT FALSE NOT NULL,
    category_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    INDEX idx_products_category (category_id),
    INDEX idx_products_active (is_active),
    INDEX idx_products_featured (featured)
);

-- Tabla de Colores de Producto (Variantes)
CREATE TABLE product_colors (
    id VARCHAR(36) PRIMARY KEY,
    product_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    hex VARCHAR(7) NOT NULL,
    stock INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_product_colors_product (product_id)
);

-- Tabla de Órdenes
CREATE TABLE orders (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    subtotal INT NOT NULL,
    shipping_cost INT DEFAULT 0 NOT NULL,
    total INT NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' NOT NULL,
    payment_method VARCHAR(20) DEFAULT 'MERCADOPAGO' NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'PENDING' NOT NULL,
    payment_reference VARCHAR(255),
    notes TEXT,
    shipping_name VARCHAR(255) NOT NULL,
    shipping_phone VARCHAR(20) NOT NULL,
    shipping_street VARCHAR(255) NOT NULL,
    shipping_neighborhood VARCHAR(255) NOT NULL,
    shipping_city VARCHAR(255) NOT NULL,
    shipping_department VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_orders_user (user_id),
    INDEX idx_orders_status (status),
    INDEX idx_orders_payment_status (payment_status)
);

-- Tabla de Items de Orden
CREATE TABLE order_items (
    id VARCHAR(36) PRIMARY KEY,
    order_id VARCHAR(36) NOT NULL,
    product_id VARCHAR(36) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    product_image VARCHAR(500),
    price INT NOT NULL,
    quantity INT NOT NULL,
    color VARCHAR(100),
    size VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    INDEX idx_order_items_order (order_id),
    INDEX idx_order_items_product (product_id)
);

-- Tabla de Pagos
CREATE TABLE payments (
    id VARCHAR(36) PRIMARY KEY,
    order_id VARCHAR(36) UNIQUE NOT NULL,
    provider VARCHAR(20) NOT NULL,
    amount INT NOT NULL,
    currency VARCHAR(3) DEFAULT 'COP' NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' NOT NULL,
    payment_session_id VARCHAR(255) NOT NULL,
    payment_url TEXT,
    external_reference VARCHAR(255),
    raw_response JSON,
    webhook_data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_payments_order (order_id),
    INDEX idx_payments_session (payment_session_id),
    INDEX idx_payments_reference (external_reference)
);

-- Comentarios sobre las relaciones:
-- 1. users -> orders (1:N) - Un usuario puede tener múltiples órdenes
-- 2. categories -> products (1:N) - Una categoría puede tener múltiples productos
-- 3. products -> product_colors (1:N) - Un producto puede tener múltiples colores
-- 4. products -> order_items (1:N) - Un producto puede estar en múltiples items de orden
-- 5. orders -> order_items (1:N) - Una orden puede tener múltiples items
-- 6. orders -> payments (1:1) - Una orden tiene un único pago asociado

-- Constraints de integridad:
-- - ON DELETE CASCADE: Al eliminar un registro padre, se eliminan los hijos
-- - ON DELETE RESTRICT: No permite eliminar si hay registros relacionados
-- - UNIQUE: Garantiza unicidad de valores
-- - NOT NULL: Campo obligatorio

-- Índices para optimización:
-- - Índices en foreign keys para joins rápidos
-- - Índices en campos de búsqueda frecuente (email, status, etc.)
-- - Índices compuestos donde sea necesario
