/**
 * Default list of short motivational/blessing phrases printed at the
 * bottom of each receipt. Users can override this list via Settings.
 */
export const DEFAULT_BLESSINGS: string[] = [
  "Dios te bendiga",
  "Dios es bueno",
  "Hoy es un gran día",
  "Lo mejor está por venir",
  "Tu sonrisa nos alegra el día",
  "Con amor, Dulce Fresita",
  "Gracias por regalarnos tu visita",
  "Cada día es una oportunidad",
  "Sueña en grande",
  "Nunca dejes de creer",
  "Sigue adelante, vales mucho",
  "Eres parte de nuestra historia",
  "Que tengas un día dulce",
  "La vida es mejor con fresas",
  "Confía en Dios y en ti",
  "Sé luz donde vayas",
  "Un dulce momento en tu día",
  "Que tu día sea bendecido",
  "El esfuerzo siempre trae recompensa",
  "Pequeños momentos, grandes recuerdos",
];

/** Pick one phrase at random from a list. Returns undefined if list is empty. */
export function pickRandomBlessing(phrases: string[] = DEFAULT_BLESSINGS): string | undefined {
  if (!phrases || phrases.length === 0) return undefined;
  return phrases[Math.floor(Math.random() * phrases.length)];
}
