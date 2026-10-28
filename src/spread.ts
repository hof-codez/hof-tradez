// How far real outcomes landed from the age-curve forecast, 2010 to 2025.
// Each pair is [low, high]: the 10th and 90th percentile of actual / predicted points per game,
// k seasons ahead, by position and age band. Fitted by brownbell tc-fit-spread.
export type Band = 'young' | 'prime' | 'vet';
export const SPREAD: Record<number, Record<string, [number, number]>> = {
  1: { 'QB|young': [0.67, 1.33], 'QB|prime': [0.51, 1.28], 'QB|vet': [0.35, 1.37], 'RB|young': [0.49, 1.71], 'RB|prime': [0.44, 1.66], 'RB|vet': [0.43, 1.71], 'WR|young': [0.45, 1.49], 'WR|prime': [0.49, 1.51], 'WR|vet': [0.46, 1.53], 'TE|young': [0.47, 1.61], 'TE|prime': [0.54, 1.54], 'TE|vet': [0.51, 1.61] },
  2: { 'QB|young': [0.35, 1.52], 'QB|prime': [0.31, 1.36], 'QB|vet': [0.31, 1.36], 'RB|young': [0.4, 1.8], 'RB|prime': [0.45, 1.92], 'RB|vet': [0.47, 2.04], 'WR|young': [0.39, 1.53], 'WR|prime': [0.44, 1.63], 'WR|vet': [0.48, 1.87], 'TE|young': [0.42, 1.85], 'TE|prime': [0.55, 1.67], 'TE|vet': [0.57, 1.78] },
  3: { 'QB|young': [0.34, 1.56], 'QB|prime': [0.28, 1.32], 'QB|vet': [0.32, 1.67], 'RB|young': [0.42, 1.97], 'RB|prime': [0.53, 2.24], 'RB|vet': [0.48, 2.18], 'WR|young': [0.42, 1.66], 'WR|prime': [0.5, 2.03], 'WR|vet': [0.56, 2.31], 'TE|young': [0.5, 2.2], 'TE|prime': [0.54, 1.91], 'TE|vet': [0.52, 1.92] },
};
export const bandOf = (age: number): Band => (age < 24 ? 'young' : age < 28 ? 'prime' : 'vet');
