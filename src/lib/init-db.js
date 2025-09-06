import { initDatabase, generateCoupons } from './database.js';

// Initialize database and generate initial coupons
async function initializeSystem() {
  try {
    console.log('Initializing database...');
    initDatabase();
    
    console.log('Generating initial coupons...');
    const count = generateCoupons(1000); // Generate 100 initial coupons for testing
    
    console.log(`System initialized successfully with ${count} coupons!`);
  } catch (error) {
    console.error('Error initializing system:', error);
  }
}

initializeSystem();
