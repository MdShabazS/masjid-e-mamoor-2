import { colors, roleLabels } from "./colors";

describe("mobile role labels", () => {
  it("maps canonical roles to human-readable labels", () => {
    expect(roleLabels.system_admin).toBe("System Admin");
    expect(roleLabels.committee_member).toBe("Committee Member");
    expect(roleLabels.member).toBe("Member");
  });
});

describe("institutional color system", () => {
  it("keeps primary text and controls at accessible contrast", () => {
    expect(contrast(colors.text, colors.ivory)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.surface, colors.deepEmerald)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.danger, colors.dangerSurface)).toBeGreaterThanOrEqual(4.5);
  });
});

function contrast(foreground: string, background: string) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function luminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
