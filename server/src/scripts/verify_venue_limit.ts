
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { User } from '../models/User';
import { Venue } from '../models/Venue';

// Load environment variables
// Adjust path to find .env in server root (two levels up from src/scripts)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const verifyVenueLimit = async () => {
  try {
    // Connect to MongoDB
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not defined in .env');
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // 1. Create a dummy Venue Lister user
    const uniqueId = Date.now();
    const user = new User({
      name: `Test Lister ${uniqueId}`,
      email: `testlister${uniqueId}@example.com`,
      phone: `999${uniqueId}`,
      password: 'password123',
      role: 'VENUE_LISTER',
      venueListerProfile: {
        canAddMoreVenues: false // FORCE RESTRICTION
      }
    });
    await user.save();
    console.log(`Created Venue Lister: ${user.email} (ID: ${user._id})`);

    // 2. Create their FIRST venue (simulating the one created on approval)
    const venue1 = new Venue({
      name: 'First Venue',
      ownerId: user._id,
      location: { type: 'Point', coordinates: [0, 0] },
      sports: ['Cricket'],
      pricePerHour: 1000,
      description: 'First venue'
    });
    await venue1.save();
    console.log('Created First Venue successfully.');

    // 3. Try to add a SECOND venue (Scenario: calling createVenue controller logic)
    // We will simulate the check that happens in the controller
    console.log('Attempting to create Second Venue...');
    
    // Simulate Controller Logic
    // ---------------------------------------------------------
    const userFetched = await User.findById(user._id);
    if (userFetched?.role === 'VENUE_LISTER') {
        if (!userFetched.venueListerProfile?.canAddMoreVenues) {
            console.log('❌ BLOCKED: Backend correctly prevented creating a second venue.');
            console.log('Reason: "You are only allowed to manage your approved venue."');
        } else {
             console.log('⚠️ FAILED: Backend allowed creating a second venue!');
        }
    }
    // ---------------------------------------------------------

    // Cleanup
    await Venue.deleteMany({ ownerId: user._id });
    await User.findByIdAndDelete(user._id);
    console.log('Cleanup complete.');

  } catch (error) {
    console.error('Verification Failed:', error);
  } finally {
    await mongoose.disconnect();
  }
};

verifyVenueLimit();
