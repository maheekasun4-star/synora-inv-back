-- CreateTable
CREATE TABLE `tax_classes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tax_class_rates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tax_class_id` INTEGER NOT NULL,
    `tax_name` VARCHAR(50) NOT NULL,
    `rate` DECIMAL(5, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `item_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `parent_id` INTEGER NULL,
    `level` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `item_code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` VARCHAR(500) NULL,
    `category_id` INTEGER NOT NULL,
    `unit_type` VARCHAR(30) NOT NULL,
    `reorder_level` DECIMAL(20, 4) NULL,
    `reorder_qty` DECIMAL(20, 4) NULL,
    `min_qty` DECIMAL(20, 4) NULL,
    `max_qty` DECIMAL(20, 4) NULL,
    `tax_class_id` INTEGER NULL,
    `chart_of_account` VARCHAR(50) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    UNIQUE INDEX `items_item_code_key`(`item_code`),
    INDEX `items_category_id_idx`(`category_id`),
    INDEX `items_tax_class_id_idx`(`tax_class_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `suppliers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `contact_info` VARCHAR(255) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approval_levels` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `request_type` ENUM('purchase_request', 'store_request', 'kitchen_request') NOT NULL,
    `level_order` INTEGER NOT NULL,
    `level_name` VARCHAR(100) NOT NULL,
    `required_role` VARCHAR(50) NOT NULL,

    UNIQUE INDEX `approval_levels_request_type_level_order_key`(`request_type`, `level_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tax_class_rates` ADD CONSTRAINT `tax_class_rates_tax_class_id_fkey` FOREIGN KEY (`tax_class_id`) REFERENCES `tax_classes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_categories` ADD CONSTRAINT `item_categories_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `item_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `items` ADD CONSTRAINT `items_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `item_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `items` ADD CONSTRAINT `items_tax_class_id_fkey` FOREIGN KEY (`tax_class_id`) REFERENCES `tax_classes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
