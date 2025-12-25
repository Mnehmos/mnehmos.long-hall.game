export interface ThemeDef {
  id: string;
  name: string;
  description: string;
  enemyTags: string[]; // e.g., ['undead', 'skeleton']
  trapTags: string[];
  bossPool: string[];
  // Sensory templates
  ambiance: string[]; // "The air is stale.", "Water drips nearby."
}

export const THEMES: Record<string, ThemeDef> = {
  dungeon_start: {
    id: 'dungeon_start',
    name: 'Ancient Sewers',
    description: 'A damp, moss-covered sewer system beneath the city.',
    enemyTags: ['vermin', 'slime'],
    trapTags: ['tripwire', 'spikes'],
    bossPool: ['sewer_king'],
    ambiance: [
      'The smell of rot is overpowering.',
      'Scurrying sounds echo in the darkness.',
      'Slime drips from the ceiling.'
    ]
  },
  crypt: {
    id: 'crypt',
    name: 'Forgotten Crypt',
    description: 'Rows of silent tombs line the walls.',
    enemyTags: ['undead', 'skeleton'],
    trapTags: ['darts', 'curse'],
    bossPool: ['lich_acolyte'],
    ambiance: [
      'A cold draft chills your bones.',
      'Dust motes dance in the torchlight.',
      'You feel watched by the statues.'
    ]
  }
};
