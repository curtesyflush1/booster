/**
 * Migration: Implement Granular RBAC System
 * 
 * This migration enhances the existing role-based system with granular permissions
 * and creates tables for managing roles and permissions more effectively.
 */

exports.up = function(knex) {
  return knex.schema
    // Create roles table for custom role definitions
    .createTable('roles', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('name', 100).notNullable().unique();
      table.string('slug', 100).notNullable().unique();
      table.text('description');
      table.json('permissions').defaultTo('[]'); // Array of permission strings
      table.boolean('is_system_role').defaultTo(false); // System vs custom roles
      table.json('categories').defaultTo('[]'); // Permission categories this role covers
      table.integer('level').defaultTo(0); // Role hierarchy level
      table.boolean('is_active').defaultTo(true);
      table.uuid('created_by'); // User who created this role
      table.timestamps(true, true);
      
      // Indexes
      table.index(['is_system_role', 'is_active']);
      table.index('level');
      table.index('created_by');
    })
    
    // Create user_roles table for many-to-many relationship
    .createTable('user_roles', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').notNullable();
      table.uuid('role_id').notNullable();
      table.uuid('assigned_by').notNullable(); // Who assigned this role
      table.text('assignment_reason'); // Why this role was assigned
      table.timestamp('assigned_at').defaultTo(knex.fn.now());
      table.timestamp('expires_at'); // Optional role expiration
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
      
      // Foreign keys
      table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.foreign('role_id').references('id').inTable('roles').onDelete('CASCADE');
      table.foreign('assigned_by').references('id').inTable('users');
      
      // Unique constraint to prevent duplicate role assignments
      table.unique(['user_id', 'role_id']);
      
      // Indexes
      table.index(['user_id', 'is_active']);
      table.index(['role_id', 'is_active']);
      table.index('assigned_by');
      table.index('expires_at');
    })
    
    // Create permission_audit_log table for tracking permission changes
    .createTable('permission_audit_log', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('actor_user_id').notNullable(); // Who made the change
      table.uuid('target_user_id').notNullable(); // Who was affected
      table.string('action', 50).notNullable(); // 'grant', 'revoke', 'role_change', etc.
      table.string('permission_or_role', 100); // What permission/role was changed
      table.json('old_value'); // Previous state
      table.json('new_value'); // New state
      table.text('reason'); // Reason for the change
      table.string('ip_address', 45); // IPv4 or IPv6
      table.text('user_agent');
      table.json('metadata').defaultTo('{}'); // Additional context
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      // Foreign keys
      table.foreign('actor_user_id').references('id').inTable('users');
      table.foreign('target_user_id').references('id').inTable('users');
      
      // Indexes for audit queries
      table.index(['target_user_id', 'created_at']);
      table.index(['actor_user_id', 'created_at']);
      table.index(['action', 'created_at']);
      table.index('created_at');
    })
    
    // Update users table to support the new RBAC system
    .alterTable('users', function(table) {
      // Add new columns for enhanced RBAC
      table.json('direct_permissions').defaultTo('[]'); // Direct permissions outside of roles
      table.timestamp('role_last_updated'); // When role was last changed
      table.uuid('role_updated_by'); // Who last updated the role
      table.json('permission_metadata').defaultTo('{}'); // Additional permission context
      
      // Add foreign key for role_updated_by
      table.foreign('role_updated_by').references('id').inTable('users');
      
      // Add index for role queries
      table.index(['role', 'created_at']);
    })
    
    // Insert default system roles
    .then(function() {
      return knex('roles').insert([
        {
          id: knex.raw('gen_random_uuid()'),
          name: 'Super Administrator',
          slug: 'super_admin',
          description: 'Full system access with all permissions',
          permissions: JSON.stringify([]), // Will be populated by application logic
          is_system_role: true,
          categories: JSON.stringify(['user_management', 'system_administration', 'ml_operations', 'analytics', 'content_management', 'security', 'billing', 'monitoring']),
          level: 100,
          is_active: true,
          created_at: knex.fn.now(),
          updated_at: knex.fn.now()
        },
        {
          id: knex.raw('gen_random_uuid()'),
          name: 'Administrator',
          slug: 'admin',
          description: 'Administrative access with most permissions',
          permissions: JSON.stringify([]), // Will be populated by application logic
          is_system_role: true,
          categories: JSON.stringify(['user_management', 'system_administration', 'analytics', 'content_management', 'security', 'monitoring']),
          level: 80,
          is_active: true,
          created_at: knex.fn.now(),
          updated_at: knex.fn.now()
        },
        {
          id: knex.raw('gen_random_uuid()'),
          name: 'User Manager',
          slug: 'user_manager',
          description: 'Manage users and basic administrative tasks',
          permissions: JSON.stringify([]), // Will be populated by application logic
          is_system_role: true,
          categories: JSON.stringify(['user_management', 'analytics']),
          level: 60,
          is_active: true,
          created_at: knex.fn.now(),
          updated_at: knex.fn.now()
        },
        {
          id: knex.raw('gen_random_uuid()'),
          name: 'Content Manager',
          slug: 'content_manager',
          description: 'Manage products, retailers, and content',
          permissions: JSON.stringify([]), // Will be populated by application logic
          is_system_role: true,
          categories: JSON.stringify(['content_management', 'analytics']),
          level: 50,
          is_active: true,
          created_at: knex.fn.now(),
          updated_at: knex.fn.now()
        },
        {
          id: knex.raw('gen_random_uuid()'),
          name: 'ML Engineer',
          slug: 'ml_engineer',
          description: 'Manage machine learning models and data',
          permissions: JSON.stringify([]), // Will be populated by application logic
          is_system_role: true,
          categories: JSON.stringify(['ml_operations', 'analytics']),
          level: 50,
          is_active: true,
          created_at: knex.fn.now(),
          updated_at: knex.fn.now()
        },
        {
          id: knex.raw('gen_random_uuid()'),
          name: 'Analyst',
          slug: 'analyst',
          description: 'View and analyze system data and metrics',
          permissions: JSON.stringify([]), // Will be populated by application logic
          is_system_role: true,
          categories: JSON.stringify(['analytics']),
          level: 40,
          is_active: true,
          created_at: knex.fn.now(),
          updated_at: knex.fn.now()
        },
        {
          id: knex.raw('gen_random_uuid()'),
          name: 'Support Agent',
          slug: 'support_agent',
          description: 'Provide customer support and basic user management',
          permissions: JSON.stringify([]), // Will be populated by application logic
          is_system_role: true,
          categories: JSON.stringify(['user_management']),
          level: 30,
          is_active: true,
          created_at: knex.fn.now(),
          updated_at: knex.fn.now()
        },
        {
          id: knex.raw('gen_random_uuid()'),
          name: 'Billing Manager',
          slug: 'billing_manager',
          description: 'Manage billing, subscriptions, and financial data',
          permissions: JSON.stringify([]), // Will be populated by application logic
          is_system_role: true,
          categories: JSON.stringify(['billing', 'analytics']),
          level: 50,
          is_active: true,
          created_at: knex.fn.now(),
          updated_at: knex.fn.now()
        },
        {
          id: knex.raw('gen_random_uuid()'),
          name: 'Security Officer',
          slug: 'security_officer',
          description: 'Manage security, audit logs, and compliance',
          permissions: JSON.stringify([]), // Will be populated by application logic
          is_system_role: true,
          categories: JSON.stringify(['security', 'monitoring']),
          level: 70,
          is_active: true,
          created_at: knex.fn.now(),
          updated_at: knex.fn.now()
        },
        {
          id: knex.raw('gen_random_uuid()'),
          name: 'User',
          slug: 'user',
          description: 'Standard user with no administrative permissions',
          permissions: JSON.stringify([]),
          is_system_role: true,
          categories: JSON.stringify([]),
          level: 0,
          is_active: true,
          created_at: knex.fn.now(),
          updated_at: knex.fn.now()
        }
      ]);
    });
};

exports.down = function(knex) {
  return knex.schema
    // Remove foreign key constraints first
    .alterTable('users', function(table) {
      table.dropForeign('role_updated_by');
      table.dropColumn('direct_permissions');
      table.dropColumn('role_last_updated');
      table.dropColumn('role_updated_by');
      table.dropColumn('permission_metadata');
    })
    
    // Drop tables in reverse order
    .dropTableIfExists('permission_audit_log')
    .dropTableIfExists('user_roles')
    .dropTableIfExists('roles');
};