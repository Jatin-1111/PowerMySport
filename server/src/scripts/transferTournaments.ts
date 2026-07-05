import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGO_URI;

if (!uri) {
  console.error('MONGO_URI is not set in .env');
  process.exit(1);
}

async function transferTournaments() {
  const client = new MongoClient(uri!);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const sourceDb = client.db('powermysport');
    const targetDb = client.db('test');

    const sourceCollection = sourceDb.collection('tournaments');
    const targetCollection = targetDb.collection('tournaments');

    const count = await sourceCollection.countDocuments();
    console.log(`Found ${count} tournaments in 'powermysport' database.`);

    if (count > 0) {
      const documents = await sourceCollection.find({}).toArray();
      
      console.log(`Inserting ${documents.length} tournaments into 'test' database...`);
      // Use ordered: false to continue inserting even if some duplicate key errors happen (if they already exist)
      const result = await targetCollection.insertMany(documents, { ordered: false }).catch(err => {
        if (err.code === 11000) {
           console.log('Some documents already existed (duplicate keys), ignoring those.');
           return err.result;
        }
        throw err;
      });

      console.log(`Successfully transferred documents.`);
    } else {
      console.log('No documents found in source collection.');
    }
  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    await client.close();
    console.log('Connection closed.');
  }
}

transferTournaments();
