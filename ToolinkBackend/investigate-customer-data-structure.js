import mongoose from 'mongoose';
import SubOrder from './src/models/SubOrder.js';
import Order from './src/models/Order.js';
import MainOrder from './src/models/MainOrder.js';
import User from './src/models/User.js';

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/toollink');
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

const investigateCustomerDataStructure = async () => {
    try {
        const subOrderId = '68daecc94c322b37555e38d7';

        console.log('🔍 INVESTIGATING CUSTOMER DATA STRUCTURE');
        console.log('='.repeat(60));

        // 1. Get the sub-order with ALL fields
        const subOrder = await SubOrder.findById(subOrderId).lean();
        console.log('\n📦 RAW SUB-ORDER DATA:');
        console.log('='.repeat(30));
        console.log(JSON.stringify(subOrder, null, 2));

        // 2. Get the main order with ALL fields
        if (subOrder.mainOrderId) {
            console.log('\n📋 MAIN ORDER DATA:');
            console.log('='.repeat(30));
            const mainOrder = await MainOrder.findById(subOrder.mainOrderId).lean();
            if (mainOrder) {
                console.log(JSON.stringify(mainOrder, null, 2));
            } else {
                console.log('❌ MainOrder not found, checking regular Order collection...');

                const regularOrder = await Order.findById(subOrder.mainOrderId).lean();
                if (regularOrder) {
                    console.log('✅ Found in Order collection:');
                    console.log(JSON.stringify(regularOrder, null, 2));
                }
            }
        }

        // 3. Check if there's customer info in the sub-order itself
        console.log('\n🔍 CHECKING SUB-ORDER FIELDS FOR CUSTOMER DATA:');
        console.log('='.repeat(50));

        Object.keys(subOrder).forEach(key => {
            const value = subOrder[key];
            if (typeof value === 'string' && (
                value.toLowerCase().includes('ayesha') ||
                value.toLowerCase().includes('nipuni') ||
                value.includes('iit21063') ||
                value.includes('+94123456780') ||
                value.toLowerCase().includes('note:')
            )) {
                console.log(`🎯 FOUND CUSTOMER DATA IN FIELD "${key}":`, value);
            }
        });

        // 4. Check notes field specifically
        if (subOrder.notes) {
            console.log('\n📝 NOTES FIELD CONTENT:');
            console.log('='.repeat(25));
            console.log(`Notes: "${subOrder.notes}"`);

            // Try to parse customer info from notes
            const noteLines = subOrder.notes.split('\n');
            console.log('\n📝 PARSING NOTES LINE BY LINE:');
            noteLines.forEach((line, index) => {
                console.log(`Line ${index + 1}: "${line}"`);

                // Check for customer patterns
                if (line.toLowerCase().includes('customer') ||
                    line.toLowerCase().includes('name') ||
                    line.toLowerCase().includes('email') ||
                    line.toLowerCase().includes('phone')) {
                    console.log(`  🎯 Potential customer info: "${line}"`);
                }
            });
        }

        // 5. Check if customer info is in items or other nested structures
        console.log('\n🔍 CHECKING NESTED STRUCTURES:');
        console.log('='.repeat(35));

        if (subOrder.items && subOrder.items.length > 0) {
            subOrder.items.forEach((item, index) => {
                console.log(`\nItem ${index + 1}:`, JSON.stringify(item, null, 2));
            });
        }

        // 6. Check history field if it exists
        if (subOrder.history && subOrder.history.length > 0) {
            console.log('\n📜 HISTORY FIELD:');
            console.log('='.repeat(20));
            subOrder.history.forEach((historyItem, index) => {
                console.log(`History ${index + 1}:`, JSON.stringify(historyItem, null, 2));
            });
        }

        // 7. Look for any field that might contain "note:"
        console.log('\n🔍 SEARCHING FOR "note:" PATTERN:');
        console.log('='.repeat(40));

        const searchForNotePattern = (obj, path = '') => {
            Object.keys(obj).forEach(key => {
                const value = obj[key];
                const currentPath = path ? `${path}.${key}` : key;

                if (typeof value === 'string' && value.toLowerCase().includes('note:')) {
                    console.log(`🎯 FOUND "note:" in ${currentPath}:`, value);
                } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    searchForNotePattern(value, currentPath);
                } else if (Array.isArray(value)) {
                    value.forEach((item, index) => {
                        if (typeof item === 'object' && item !== null) {
                            searchForNotePattern(item, `${currentPath}[${index}]`);
                        } else if (typeof item === 'string' && item.toLowerCase().includes('note:')) {
                            console.log(`🎯 FOUND "note:" in ${currentPath}[${index}]:`, item);
                        }
                    });
                }
            });
        };

        searchForNotePattern(subOrder);

    } catch (error) {
        console.error('Error investigating customer data:', error);
    }
};

const main = async () => {
    await connectDB();
    await investigateCustomerDataStructure();
    mongoose.disconnect();
};

main().catch(console.error);
