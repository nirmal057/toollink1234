#!/usr/bin/env node

/**
 * Mongoose Price Field Cleanup
 */

import mongoose from 'mongoose';
import { config } from 'dotenv';

config();

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/toollink';

const cleanupPriceFields = async () => {
    console.log('🧹 Mongoose Price Field Cleanup');
    console.log('═'.repeat(40));

    try {
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        // Clean inventory collection
        console.log('📦 Cleaning Inventory...');
        const inventoryResult = await mongoose.connection.db.collection('inventories').updateMany(
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
        console.log(`✅ Updated ${inventoryResult.modifiedCount} inventory items`);

        // Clean orders collection
        console.log('📋 Cleaning Orders...');
        const orderResult = await mongoose.connection.db.collection('orders').updateMany(
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
        console.log(`✅ Updated ${orderResult.modifiedCount} orders`);

        // Clean order items using arrayFilters
        console.log('📝 Cleaning Order Items...');
        const orderItemsResult = await mongoose.connection.db.collection('orders').updateMany(
            { "items.0": { $exists: true } },
            {
                $unset: {
                    "items.$[].unitPrice": 1,
                    "items.$[].totalPrice": 1
                }
            }
        );
        console.log(`✅ Updated ${orderItemsResult.modifiedCount} order items`);

        console.log('\n🎉 Cleanup Complete!');
        console.log('Your ToolLink system is now a pure inventory management system');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
};

cleanupPriceFields();
