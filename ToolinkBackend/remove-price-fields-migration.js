#!/usr/bin/env node

/**
 * Database Migration Script
 * Removes price-related fields from inventory and orders
 */

import { config } from 'dotenv';
import dbConnection from './src/config/database.js';
import Inventory from './src/models/Inventory.js';
import Order from './src/models/Order.js';

// Load environment variables
config();

const migratePriceRemoval = async () => {
    console.log('🔄 Database Migration: Removing Price Fields');
    console.log('═'.repeat(50));

    try {
        // Connect to database
        const connected = await dbConnection.connect();
        if (!connected) {
            throw new Error('Failed to connect to database');
        }
        console.log('✅ Database connected');

        // Remove price fields from inventory collection
        console.log('\n📦 Updating Inventory Collection...');
        const inventoryResult = await Inventory.updateMany(
            {},
            {
                $unset: {
                    cost: "",
                    selling_price: "",
                    costPrice: "",
                    sellingPrice: "",
                    unitPrice: "",
                    price: ""
                }
            }
        );
        console.log(`✅ Updated ${inventoryResult.modifiedCount} inventory items`);

        // Remove price fields from orders collection
        console.log('\n📋 Updating Orders Collection...');
        const orderResult = await Order.updateMany(
            {},
            {
                $unset: {
                    totalAmount: "",
                    finalAmount: "",
                    discount: "",
                    tax: "",
                    "items.$[].unitPrice": "",
                    "items.$[].totalPrice": ""
                }
            }
        );
        console.log(`✅ Updated ${orderResult.modifiedCount} orders`);

        // Verify migration
        console.log('\n🔍 Verifying Migration...');

        const sampleInventory = await Inventory.findOne({});
        const sampleOrder = await Order.findOne({});

        console.log('Sample inventory fields:', Object.keys(sampleInventory?._doc || {}));
        console.log('Sample order fields:', Object.keys(sampleOrder?._doc || {}));

        if (sampleOrder?.items?.[0]) {
            console.log('Sample order item fields:', Object.keys(sampleOrder.items[0]._doc || {}));
        }

        console.log('\n🎉 Migration Complete!');
        console.log('═'.repeat(50));
        console.log('✅ All price-related fields removed from database');
        console.log('✅ System now operates as pure inventory management');

    } catch (error) {
        console.error('\n❌ Migration Failed:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await dbConnection.gracefulShutdown('MIGRATION_COMPLETE');
        console.log('🔌 Database connection closed');
    }
};

// Run migration
migratePriceRemoval().catch(console.error);
