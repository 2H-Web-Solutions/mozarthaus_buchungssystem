export type SeatingElement = 
  | { type: 'seat'; id: string; row: string; number: number }
  | { type: 'spacer'; width: number };

export interface RowBlueprint {
  rowId: string;
  elements: SeatingElement[];
}

function generateContinuous(rowId: string, count: number): RowBlueprint {
  return {
    rowId,
    elements: Array.from({ length: count }, (_, i) => ({
      type: 'seat',
      id: `row_${rowId.toLowerCase()}_seat_${i + 1}`,
      row: rowId,
      number: i + 1
    }))
  };
}

export const SEATING_PLAN_TEMPLATE: RowBlueprint[] = [
  generateContinuous('A', 13),
  generateContinuous('B', 13),
  generateContinuous('C', 13),
  generateContinuous('D', 11),
  generateContinuous('E', 11),
  {
    rowId: 'F',
    elements: [
      { type: 'seat', id: 'row_f_seat_1', row: 'F', number: 1 },
      { type: 'seat', id: 'row_f_seat_2', row: 'F', number: 2 },
      { type: 'seat', id: 'row_f_seat_3', row: 'F', number: 3 },
      { type: 'spacer', width: 5 },
      { type: 'seat', id: 'row_f_seat_4', row: 'F', number: 4 },
      { type: 'seat', id: 'row_f_seat_5', row: 'F', number: 5 },
      { type: 'seat', id: 'row_f_seat_6', row: 'F', number: 6 }
    ]
  }
];
