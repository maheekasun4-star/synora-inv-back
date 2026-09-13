-- AlterTable
ALTER TABLE `approval_levels` MODIFY `request_type` ENUM('purchase_request', 'store_request', 'kitchen_request', 'grn_receiving') NOT NULL;

-- CreateTable
CREATE TABLE `departments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stores` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `location` VARCHAR(255) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approval_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `request_type` ENUM('purchase_request', 'store_request', 'kitchen_request', 'grn_receiving') NOT NULL,
    `requested_by` INTEGER NOT NULL,
    `department_id` INTEGER NULL,
    `status` ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
    `current_level` INTEGER NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approval_request_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `approval_request_id` INTEGER NOT NULL,
    `level_id` INTEGER NULL,
    `item_id` INTEGER NOT NULL,
    `quantity` DECIMAL(20, 4) NOT NULL,
    `unit_price` DECIMAL(20, 4) NULL,
    `vat` DECIMAL(20, 4) NOT NULL DEFAULT 0,
    `discount` DECIMAL(20, 4) NOT NULL DEFAULT 0,
    `chart_of_account` VARCHAR(50) NULL,
    `reason` VARCHAR(255) NULL,

    INDEX `approval_request_items_approval_request_id_idx`(`approval_request_id`),
    INDEX `approval_request_items_level_id_idx`(`level_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approval_actions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `approval_request_id` INTEGER NOT NULL,
    `level_id` INTEGER NOT NULL,
    `approved_by` INTEGER NOT NULL,
    `action` ENUM('approved', 'rejected') NOT NULL,
    `comment` VARCHAR(255) NULL,
    `acted_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `approval_actions_approval_request_id_idx`(`approval_request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `approval_request_id` INTEGER NOT NULL,
    `pr_code` VARCHAR(50) NOT NULL,
    `requested_date` DATE NOT NULL,
    `sub_department_id` INTEGER NULL,
    `advance_amount` DECIMAL(20, 4) NULL,
    `event_id` INTEGER NULL,
    `event_name` VARCHAR(100) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `purchase_requests_approval_request_id_key`(`approval_request_id`),
    UNIQUE INDEX `purchase_requests_pr_code_key`(`pr_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quotations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quotation_code` VARCHAR(50) NOT NULL,
    `supplier_id` INTEGER NOT NULL,
    `purchase_request_id` INTEGER NULL,
    `from_date` DATE NULL,
    `to_date` DATE NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    UNIQUE INDEX `quotations_quotation_code_key`(`quotation_code`),
    INDEX `quotations_supplier_id_idx`(`supplier_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quotation_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quotation_id` INTEGER NOT NULL,
    `item_id` INTEGER NOT NULL,
    `price` DECIMAL(20, 4) NOT NULL,
    `min_qty` DECIMAL(20, 4) NULL,
    `max_qty` DECIMAL(20, 4) NULL,
    `tax_class_id` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `po_code` VARCHAR(50) NOT NULL,
    `supplier_id` INTEGER NOT NULL,
    `purchase_request_id` INTEGER NULL,
    `order_date` DATE NOT NULL,
    `payment_type` VARCHAR(50) NULL,
    `delivery_address` VARCHAR(255) NULL,
    `gross_value` DECIMAL(20, 4) NOT NULL,
    `tax_value` DECIMAL(20, 4) NOT NULL,
    `net_value` DECIMAL(20, 4) NOT NULL,
    `status` ENUM('open', 'partially_received', 'completed', 'cancelled') NOT NULL DEFAULT 'open',
    `cancel_reason` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    UNIQUE INDEX `purchase_orders_po_code_key`(`po_code`),
    INDEX `purchase_orders_supplier_id_idx`(`supplier_id`),
    INDEX `purchase_orders_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_order_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `purchase_order_id` INTEGER NOT NULL,
    `item_id` INTEGER NOT NULL,
    `quantity` DECIMAL(20, 4) NOT NULL,
    `unit_price` DECIMAL(20, 4) NOT NULL,
    `tax_rate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `discount_rate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `line_total` DECIMAL(20, 4) NOT NULL,
    `received_qty` DECIMAL(20, 4) NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `goods_received_notes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `grn_code` VARCHAR(50) NOT NULL,
    `approval_request_id` INTEGER NOT NULL,
    `purchase_order_id` INTEGER NOT NULL,
    `supplier_id` INTEGER NOT NULL,
    `supplier_invoice_no` VARCHAR(100) NULL,
    `received_date` DATE NOT NULL,
    `gross_value` DECIMAL(20, 4) NOT NULL,
    `net_value` DECIMAL(20, 4) NOT NULL,
    `status` ENUM('pending_approval', 'approved', 'rejected') NOT NULL DEFAULT 'pending_approval',
    `current_level` INTEGER NOT NULL DEFAULT 1,
    `store_id` INTEGER NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    UNIQUE INDEX `goods_received_notes_grn_code_key`(`grn_code`),
    UNIQUE INDEX `goods_received_notes_approval_request_id_key`(`approval_request_id`),
    INDEX `goods_received_notes_purchase_order_id_idx`(`purchase_order_id`),
    INDEX `goods_received_notes_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `grn_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `grn_id` INTEGER NOT NULL,
    `item_id` INTEGER NOT NULL,
    `quantity` DECIMAL(20, 6) NOT NULL,
    `unit_price` DECIMAL(20, 6) NOT NULL,
    `discount` DECIMAL(20, 6) NOT NULL DEFAULT 0,
    `tax_value` DECIMAL(20, 6) NOT NULL DEFAULT 0,
    `net_price` DECIMAL(20, 4) NOT NULL,
    `expiry_date` DATE NULL,
    `serial_no` VARCHAR(100) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `approval_request_items` ADD CONSTRAINT `approval_request_items_approval_request_id_fkey` FOREIGN KEY (`approval_request_id`) REFERENCES `approval_requests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_request_items` ADD CONSTRAINT `approval_request_items_level_id_fkey` FOREIGN KEY (`level_id`) REFERENCES `approval_levels`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_request_items` ADD CONSTRAINT `approval_request_items_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_actions` ADD CONSTRAINT `approval_actions_approval_request_id_fkey` FOREIGN KEY (`approval_request_id`) REFERENCES `approval_requests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_actions` ADD CONSTRAINT `approval_actions_level_id_fkey` FOREIGN KEY (`level_id`) REFERENCES `approval_levels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_requests` ADD CONSTRAINT `purchase_requests_approval_request_id_fkey` FOREIGN KEY (`approval_request_id`) REFERENCES `approval_requests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_requests` ADD CONSTRAINT `purchase_requests_sub_department_id_fkey` FOREIGN KEY (`sub_department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotations` ADD CONSTRAINT `quotations_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotations` ADD CONSTRAINT `quotations_purchase_request_id_fkey` FOREIGN KEY (`purchase_request_id`) REFERENCES `purchase_requests`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotation_items` ADD CONSTRAINT `quotation_items_quotation_id_fkey` FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotation_items` ADD CONSTRAINT `quotation_items_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotation_items` ADD CONSTRAINT `quotation_items_tax_class_id_fkey` FOREIGN KEY (`tax_class_id`) REFERENCES `tax_classes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_purchase_request_id_fkey` FOREIGN KEY (`purchase_request_id`) REFERENCES `purchase_requests`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order_items` ADD CONSTRAINT `purchase_order_items_purchase_order_id_fkey` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order_items` ADD CONSTRAINT `purchase_order_items_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `goods_received_notes` ADD CONSTRAINT `goods_received_notes_approval_request_id_fkey` FOREIGN KEY (`approval_request_id`) REFERENCES `approval_requests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `goods_received_notes` ADD CONSTRAINT `goods_received_notes_purchase_order_id_fkey` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `goods_received_notes` ADD CONSTRAINT `goods_received_notes_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `goods_received_notes` ADD CONSTRAINT `goods_received_notes_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grn_items` ADD CONSTRAINT `grn_items_grn_id_fkey` FOREIGN KEY (`grn_id`) REFERENCES `goods_received_notes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grn_items` ADD CONSTRAINT `grn_items_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
