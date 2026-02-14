/**
 * Initialize Sports Collection with Default Sports and Templates
 * Run this script to populate the sports collection with common sports
 * 
 * Usage:
 * npm run initialize-sports
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
const serviceAccountPath = join(__dirname, '..', 'playtime-d9b83-firebase-adminsdk-fbsvc-a6f77401f4.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'playtime-d9b83'
  });
}

const db = admin.firestore();

// Default sports with templates
const defaultSports = [
  {
    name: 'Badminton',
    description: 'Racquet sport played with shuttlecocks',
    icon: 'sports_tennis',
    color: '#10b981',
    order: 1,
    isActive: true,
    defaultMinTeamSize: 1,
    defaultMaxTeamSize: 4,
    defaultMatchDuration: 60,
    defaultScoringFormat: 'Best of 3 sets, First to 21',
    sportSpecificOptions: {
      courtType: ['Indoor', 'Outdoor', 'Both'],
      gameTypes: ['Singles', 'Doubles', 'Mixed Doubles'],
      shuttleType: ['Plastic', 'Feather'],
      scoringSystem: ['21 Points', '15 Points', '11 Points']
    }
  },
  {
    name: 'Cricket',
    description: 'Bat and ball game played between two teams',
    icon: 'sports_cricket',
    color: '#f59e0b',
    order: 2,
    isActive: true,
    defaultMinTeamSize: 11,
    defaultMaxTeamSize: 11,
    defaultMatchDuration: 180,
    defaultScoringFormat: 'Runs scored',
    sportSpecificOptions: {
      format: ['T20', 'ODI', 'Test', 'T10'],
      overs: [6, 10, 20, 50],
      ballType: ['Leather', 'Tennis', 'Plastic'],
      pitchType: ['Turf', 'Concrete', 'Matting', 'Synthetic'],
      teamSize: [11, 7, 5]
    }
  },
  {
    name: 'Football',
    description: 'Association football, also known as soccer',
    icon: 'sports_soccer',
    color: '#3b82f6',
    order: 3,
    isActive: true,
    defaultMinTeamSize: 5,
    defaultMaxTeamSize: 11,
    defaultMatchDuration: 90,
    defaultScoringFormat: 'Goals scored',
    sportSpecificOptions: {
      fieldSize: ['5v5', '7v7', '9v9', '11v11'],
      matchDuration: [20, 30, 45, 90],
      ballSize: ['Size 4', 'Size 5'],
      fieldType: ['Turf', 'Grass', 'Artificial', 'Indoor']
    }
  },
  {
    name: 'Tennis',
    description: 'Racquet sport played individually or in pairs',
    icon: 'sports_tennis',
    color: '#8b5cf6',
    order: 4,
    isActive: true,
    defaultMinTeamSize: 1,
    defaultMaxTeamSize: 2,
    defaultMatchDuration: 90,
    defaultScoringFormat: 'Best of 3 sets',
    sportSpecificOptions: {
      courtSurface: ['Hard', 'Clay', 'Grass', 'Carpet', 'Synthetic'],
      matchFormat: ['Best of 3', 'Best of 5'],
      gameType: ['Singles', 'Doubles', 'Mixed Doubles']
    }
  },
  {
    name: 'Basketball',
    description: 'Team sport played on a rectangular court',
    icon: 'sports_basketball',
    color: '#ef4444',
    order: 5,
    isActive: true,
    defaultMinTeamSize: 5,
    defaultMaxTeamSize: 5,
    defaultMatchDuration: 48,
    defaultScoringFormat: 'Points scored',
    sportSpecificOptions: {
      courtType: ['Indoor', 'Outdoor'],
      ballSize: ['Size 6', 'Size 7'],
      gameFormat: ['Full Court', 'Half Court', '3v3']
    }
  },
  {
    name: 'Volleyball',
    description: 'Team sport played with a ball over a net',
    icon: 'sports_volleyball',
    color: '#ec4899',
    order: 6,
    isActive: true,
    defaultMinTeamSize: 6,
    defaultMaxTeamSize: 6,
    defaultMatchDuration: 60,
    defaultScoringFormat: 'Best of 3 sets, First to 25',
    sportSpecificOptions: {
      courtType: ['Indoor', 'Outdoor', 'Beach'],
      gameFormat: ['6v6', '4v4', 'Beach Volleyball'],
      netHeight: ['Men: 2.43m', 'Women: 2.24m', 'Mixed: 2.24m']
    }
  },
  {
    name: 'Table Tennis',
    description: 'Fast-paced racquet sport played on a table',
    icon: 'sports_handball',
    color: '#06b6d4',
    order: 7,
    isActive: true,
    defaultMinTeamSize: 1,
    defaultMaxTeamSize: 2,
    defaultMatchDuration: 30,
    defaultScoringFormat: 'Best of 5 games, First to 11',
    sportSpecificOptions: {
      gameTypes: ['Singles', 'Doubles', 'Mixed Doubles'],
      tableType: ['Indoor', 'Outdoor'],
      paddleType: ['Standard', 'Professional']
    }
  }
];

async function initializeSports() {
  try {
    console.log('🚀 Initializing sports collection...\n');

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const sport of defaultSports) {
      // Check if sport already exists by name
      const existingQuery = await db.collection('sports')
        .where('name', '==', sport.name)
        .limit(1)
        .get();

      if (!existingQuery.empty) {
        const existingDoc = existingQuery.docs[0];
        const existingData = existingDoc.data();
        
        // Check if update is needed
        const needsUpdate = JSON.stringify(existingData.sportSpecificOptions || {}) !== JSON.stringify(sport.sportSpecificOptions) ||
                           existingData.defaultMinTeamSize !== sport.defaultMinTeamSize ||
                           existingData.defaultMaxTeamSize !== sport.defaultMaxTeamSize;
        
        if (needsUpdate) {
          console.log(`⚠️  Sport "${sport.name}" already exists. Updating...`);
          
          // Update existing sport
          await db.collection('sports').doc(existingDoc.id).update({
            ...sport,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          updatedCount++;
        } else {
          console.log(`⏭️  Sport "${sport.name}" already exists and is up to date. Skipping...`);
          skippedCount++;
        }
      } else {
        // Create new sport
        const sportRef = db.collection('sports').doc();
        await sportRef.set({
          ...sport,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✅ Created sport: ${sport.name}`);
        createdCount++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   Created: ${createdCount} sports`);
    console.log(`   Updated: ${updatedCount} sports`);
    console.log(`   Skipped: ${skippedCount} sports`);
    console.log('\n✨ Sports initialization completed!');

    // List all sports
    const allSports = await db.collection('sports').get();
    console.log(`\n📋 Total sports in database: ${allSports.size}`);
    allSports.forEach(doc => {
      const data = doc.data();
      console.log(`   - ${data.name} (${data.isActive ? 'Active' : 'Inactive'})`);
    });

  } catch (error) {
    console.error('❌ Error initializing sports:', error);
    process.exit(1);
  }
}

// Run the initialization
initializeSports()
  .then(() => {
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

