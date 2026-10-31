/** Keep legacy reporting keys intact without describing historic cleans as
 * return cleans. New cleaning work happens after the vehicle returns. */
export function employeeActivityLabel(label: string): string {
  return ["How Many Cleaning Going Out?", "Cleaning trips going out"].includes(label)
    ? "Vehicles cleaned"
    : label;
}
