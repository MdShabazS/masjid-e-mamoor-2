import { render } from "@testing-library/react-native";

import { TabIcon } from "./TabIcon";

describe("TabIcon", () => {
  it.each(["home", "community", "work", "meetings", "donations", "finance", "accounts", "notifications", "profile", "more"] as const)(
    "renders the production icon for %s",
    async (name) => {
      const view = await render(<TabIcon color="#1677F0" name={name} />);
      expect(view.toJSON()).toBeTruthy();
    },
  );
});
