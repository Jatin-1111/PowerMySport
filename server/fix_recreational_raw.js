const mongoose = require('mongoose');
require('dotenv').config();

async function fix() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const result = await mongoose.connection.db.collection('users').updateMany(
    { role: 'Recreational' },
    { $set: { role: 'Player' } }
  );
  console.log('Updated users:', result.modifiedCount);
  process.exit(0);
}

fix().catch(console.error);
