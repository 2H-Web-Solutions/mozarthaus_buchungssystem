import { Timestamp } from 'firebase/firestore';

export interface TicketCategory {
  id: string; // e.g. cat_a, cat_b, student
  name: string;
  price: number;
  capacityInfo: string;
}

export interface EventVariant {
  id: string; // e.g. streichquartett, klaviertrio
  name: string;
  schedule: string;
  repertoire: string;
}

export interface EventBlueprint {
  id: string; // user predefined slug e.g. mozart_ensemble
  title: string;
  shortDescription: string;
  highlights: string[];
  languages: string[];
  variants: EventVariant[];
  ticketCategories: TicketCategory[];
  isBaseTemplate: boolean;
  createdAt: Timestamp;
}
