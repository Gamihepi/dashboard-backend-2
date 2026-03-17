-- Core RBAC tables for React + Node dashboard

CREATE TABLE IF NOT EXISTS `addon_android_dashboard_roles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `role_name` varchar(50) NOT NULL,
  `description` text,
  `is_super_admin` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_name` (`role_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `addon_android_dashboard_users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(100) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `full_name` varchar(255) DEFAULT NULL,
  `role_id` int(11) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  UNIQUE KEY `uk_email` (`email`),
  KEY `idx_role_id` (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `addon_android_dashboard_pages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `page_name` varchar(120) NOT NULL,
  `page_key` varchar(100) NOT NULL,
  `page_url` varchar(255) NOT NULL,
  `category` varchar(50) DEFAULT 'Main',
  `display_order` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_page_key` (`page_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `addon_android_dashboard_role_page_permissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `role_id` int(11) NOT NULL,
  `page_id` int(11) NOT NULL,
  `can_view` tinyint(1) NOT NULL DEFAULT 0,
  `can_edit` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_page` (`role_id`, `page_id`),
  KEY `idx_page_id` (`page_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `addon_android_mod_price_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `mod_id` int(11) NOT NULL,
  `field` varchar(100) NOT NULL DEFAULT 'price',
  `value_before` text,
  `value_after` text,
  `changed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `changed_by` int(11) DEFAULT NULL,
  `downloads_at_change` int(11) DEFAULT NULL,
  `impressions_at_change` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_mod_changed` (`mod_id`, `changed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `addon_android_dashboard_roles` (`id`, `role_name`, `description`, `is_super_admin`) VALUES
(1, 'Super Admin', 'Full access', 1),
(2, 'Viewer', 'Can view dashboard pages', 0),
(3, 'Editor', 'Can view and edit mods/users', 0),
(4, 'Manager', 'Can view analytics and manage users', 0);

INSERT IGNORE INTO `addon_android_dashboard_pages` (`id`, `page_name`, `page_key`, `page_url`, `category`, `display_order`) VALUES
(1, 'Dashboard', 'dashboard', '/dashboard', 'Main', 1),
(2, 'Category Clicks', 'category_clicks', '/category-clicks', 'Main', 2),
(3, 'All Mods', 'all_mods', '/mods', 'Main', 3),
(4, 'Mod Analysis', 'mod_analysis', '/mod-analysis', 'Main', 4),
(5, 'Timeline', 'mod_change_history', '/timeline', 'Main', 5),
(6, 'Search Keywords', 'search_keywords', '/search-keywords', 'Main', 6),
(7, 'Users', 'users', '/users', 'Management', 1),
(8, 'Roles', 'roles', '/roles', 'Admin', 1),
(9, 'Add Mod', 'add_mod', '/mods/new', 'Management', 2),
(10, 'Edit Mod', 'edit_mod', '/mods/:id/edit', 'Management', 3);

INSERT IGNORE INTO `addon_android_dashboard_role_page_permissions` (`role_id`, `page_id`, `can_view`, `can_edit`) VALUES
-- Super admin (full)
(1,1,1,1),(1,2,1,1),(1,3,1,1),(1,4,1,1),(1,5,1,1),(1,6,1,1),(1,7,1,1),(1,8,1,1),(1,9,1,1),(1,10,1,1),
-- Viewer
(2,1,1,0),(2,2,1,0),(2,3,1,0),(2,4,1,0),(2,5,1,0),(2,6,1,0),
-- Editor
(3,1,1,0),(3,2,1,0),(3,3,1,1),(3,4,1,0),(3,5,1,0),(3,6,1,0),(3,9,1,1),(3,10,1,1),
-- Manager
(4,1,1,0),(4,2,1,0),(4,3,1,1),(4,4,1,0),(4,5,1,0),(4,6,1,0),(4,7,1,1),(4,9,1,1),(4,10,1,1);

-- Password: admin123 (bcrypt)
INSERT IGNORE INTO `addon_android_dashboard_users`
(`id`, `username`, `email`, `password`, `full_name`, `role_id`, `is_active`)
VALUES
(1, 'admin', 'admin@example.com', '$2a$10$tbnyy1dQJvYxqAPyRBJdAeIEQq57UG6LXDa1h7V/KGzbIMbskxACG', 'Administrator', 1, 1);
