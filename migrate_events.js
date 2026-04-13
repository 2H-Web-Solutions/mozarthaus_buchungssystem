const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // I'll check if this exists or use project ID

admin.initializeApp({
  projectId: 'mozarthaus-buchungssystem'
});

const db = admin.firestore();
const APP_ID = 'mozarthaus_new_buchungssystem_mozarthaus_v1';

async function migrate() {
  console.log('Starting migration...');
  const eventsColl = db.collection(`apps/${APP_ID}/events`);
  const snapshot = await eventsColl.get();
  
  console.log(`Found ${snapshot.size} events.`);
  const batch = db.batch();
  let count = 0;

  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.is_private === undefined) {
      batch.update(doc.ref, { is_private: false });
      count++;
    }
  });

  if (count > 0) {
    await batch.commit();
    console.log(`Successfully migrated ${count} events.`);
  } else {
    console.log('No events needed migration.');
  }
}

migrate().catch(console.error);
