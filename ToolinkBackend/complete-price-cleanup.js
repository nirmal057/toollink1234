#!/usr/bin/env node

/**
 * Complete Price Field Removal Script
 * Removes all price-related fields from inventory and orders
 */

import { config } from 'dotenv';
import dbConnection from './src/config/database.js';

// Load environment variables
config();

const completeCleanup = async () => {
    console.log('🧹 Complete Price Cleanup');
    console.log('═'.repeat(40));

    try {
        // Connect to database
        const connected = await dbConnection.connect();
        if (!connected) {
            throw new Error('Failed to connect to database');
        }

        const db = dbConnection.getDB();

        // Clean inventory collection
        console.log('📦 Cleaning Inventory...');
        const inventoryUpdate = await db.collection('inventories').updateMany(
            {},
            {
                $unset: {
                    cost: 1,
                    selling_price: 1,
                    costPrice: 1,
                    sellingPrice: 1,
                    unitPrice: 1,
                    price: 1
                }
            }
        );
        console.log(`✅ Cleaned ${inventoryUpdate.modifiedCount} inventory items`);

        // Clean orders collection
        console.log('📋 Cleaning Orders...');
        const orderUpdate = await db.collection('orders').updateMany(
            {},
            {
                $unset: {
                    totalAmount: 1,
                    finalAmount: 1,
                    discount: 1,
                    tax: 1
                }
            }
        );
        console.log(`✅ Cleaned ${orderUpdate.modifiedCount} orders`);

        // Clean order items
        console.log('📝 Cleaning Order Items...');
        const orderItemsUpdate = await db.collection('orders').updateMany(
            {},
            {
                $unset: {
                    "items.$[].unitPrice": 1,
                    "items.$[].totalPrice": 1
                }
            }
        );
        console.log(`✅ Cleaned ${orderItemsUpdate.modifiedCount} order items`);

        // Verify final state
        console.log('\n🔍 Final Verification...');
        const sampleInventory = await db.collection('inventories').findOne({});
        const sampleOrder = await db.collection('orders').findOne({});

        const hasInventoryPriceFields = sampleInventory && (
            sampleInventory.cost !== undefined ||
            sampleInventory.selling_price !== undefined ||
            sampleInventory.unitPrice !== undefined ||
            sampleInventory.price !== undefined
        );

        const hasOrderPriceFields = sampleOrder && (
            sampleOrder.totalAmount !== undefined ||
            sampleOrder.finalAmount !== undefined ||
            (sampleOrder.items && sampleOrder.items[0] && (
                sampleOrder.items[0].unitPrice !== undefined ||
                sampleOrder.items[0].totalPrice !== undefined
            ))
        );

        if (!hasInventoryPriceFields && !hasOrderPriceFields) {
            console.log('✅ All price fields successfully removed!');
        } else {
            console.log('⚠️  Some price fields may still exist');
            if (hasInventoryPriceFields) console.log('   - Inventory still has price fields');
            if (hasOrderPriceFields) console.log('   - Orders still have price fields');
        }

        console.log('\n🎉 Cleanup Complete!');
        console.log('Your ToolLink system is now a pure inventory management system');

    } catch (error) {
        console.error('❌ Cleanup failed:', error.message);
    } finally {
        await dbConnection.gracefulShutdown('CLEANUP_COMPLETE');
    }
};

completeCleanup();
