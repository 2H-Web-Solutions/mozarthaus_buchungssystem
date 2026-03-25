import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';
import { RegiondoEventBlueprint } from '../types/event';

/**
 * Initializes the static Regiondo master data into the base Firestore schema.
 * Target collection: apps/[APP_ID]/event_templates
 */
export async function seedRegiondoEvents() {
  const blueprintId = 'mozart_ensemble';
  const docRef = doc(db, `apps/${APP_ID}/event_templates`, blueprintId);

  const data: RegiondoEventBlueprint = {
    id: blueprintId,
    title: 'Mozart Ensemble',
    shortDescription: 'Erleben Sie einen unvergesslichen Abend mit klassischer Musik auf höchstem Niveau! Wählen Sie zwischen einem stilechten Streichquartett oder einem topbesetzten Klaviertrio.',
    highlights: [
      'Zertifikat für Exzellenz',
      'ältester Konzertsaal Wiens, wo Mozart spielte',
      'kostenlose Stornierung bis 48h vorher'
    ],
    languages: ['Deutsch', 'Englisch'],
    variants: [
      {
        id: 'streichquartett',
        name: 'Streichquartett',
        schedule: 'Mi, Fr, So 20:00 Uhr; Sa 18:00 Uhr',
        repertoire: 'Mozart, Haydn, Schubert, Beethoven'
      },
      {
        id: 'klaviertrio',
        name: 'Klaviertrio',
        schedule: 'Di, Do 20:00 Uhr',
        repertoire: 'Chopin, Liszt, Bach, Schubert'
      }
    ],
    // Categories embedded internally to optimize subcollection reading during transactions
    ticketCategories: [
      {
        id: 'cat_a',
        name: 'Kategorie A',
        price: 69.00,
        capacityInfo: 'ca. 36-45 Plätze'
      },
      {
        id: 'cat_b',
        name: 'Kategorie B',
        price: 59.00,
        capacityInfo: 'ca. 20-22 Plätze'
      },
      {
        id: 'student',
        name: 'Student',
        price: 42.00,
        capacityInfo: 'ca. 10 Plätze'
      }
    ],
    isBaseTemplate: true,
    createdAt: Timestamp.now()
  };

  await setDoc(docRef, data);
}
