export const MUSCLE_GROUPS = ["chest", "back", "shoulders", "arms", "legs", "core"] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const EQUIPMENT_TYPES = ["machine", "cable", "free-weight", "bodyweight", "smith-machine"] as const;
export type EquipmentType = (typeof EQUIPMENT_TYPES)[number];
