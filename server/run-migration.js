#!/usr/bin/env node

/**
 * Migration Runner Script
 * 
 * This script runs database migrations to set up the notification system.
 * 
 * Usage:
 *   node run-migration.js
 */

import { runMigrations } from './src/migrations/index.js';

async function main() {
    console.log('🚀 Starting notification system migration...\n');

    try {
        await runMigrations();
        console.log('\n✅ Migration completed successfully!');
        console.log('\nNext steps:');
        console.log('  1. Start the server: npm run dev');
        console.log('  2. Test friend request flow');
        console.log('  3. Check notifications in MongoDB');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    }
}

main();
