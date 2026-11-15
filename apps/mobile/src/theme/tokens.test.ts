import { colors } from "./colors";
import { fontFamilies, radii, touchTargets, typography } from "./tokens";

describe("Selected Mobile UI tokens", () => {
  it("uses the approved product palette", () => {
    expect(colors.background).toBe("#F8FAFD");
    expect(colors.textStrong).toBe("#10203C");
    expect(colors.textMuted).toBe("#52637D");
    expect(colors.primaryBlue).toBe("#1677F0");
    expect(colors.successGreen).toBe("#18A66F");
    expect(colors.purple).toBe("#8158DF");
    expect(colors.orange).toBe("#FF9B38");
    expect(colors.dangerRed).toBe("#ED4D53");
  });

  it("uses bundled Inter families and accessible dimensions", () => {
    expect(typography.body.fontFamily).toBe(fontFamilies.regular);
    expect(typography.sectionTitle.fontFamily).toBe(fontFamilies.semibold);
    expect(typography.pageTitle.fontFamily).toBe(fontFamilies.bold);
    expect(radii.card).toBeGreaterThanOrEqual(16);
    expect(radii.card).toBeLessThanOrEqual(18);
    expect(touchTargets.minimum).toBeGreaterThanOrEqual(44);
  });
});
