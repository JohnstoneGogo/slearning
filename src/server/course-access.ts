export function canAccessCourse(input: {
  activated: boolean;
  preview: boolean;
  price: number | null;
  paidAt: Date | null;
}): boolean {
  return input.preview || input.activated || input.price === 0 || input.paidAt !== null;
}
