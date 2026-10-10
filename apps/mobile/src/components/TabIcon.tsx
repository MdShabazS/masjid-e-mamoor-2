import { StyleSheet, View, type ColorValue } from "react-native";

type TabIconName = "home" | "community" | "work" | "meetings" | "donations" | "finance" | "accounts" | "notifications" | "profile" | "more";

export function TabIcon({ color, name }: { color: ColorValue; name: TabIconName }) {
  if (name === "home") {
    return (
      <View style={styles.frame}>
        <View style={[styles.homeRoof, { borderColor: color }]} />
        <View style={[styles.homeBody, { borderColor: color }]} />
      </View>
    );
  }

  if (name === "community") {
    return (
      <View style={styles.frame}>
        <View style={[styles.personHead, styles.communityHeadLeft, { borderColor: color }]} />
        <View style={[styles.personHead, styles.communityHeadRight, { borderColor: color }]} />
        <View style={[styles.communityBody, { borderColor: color }]} />
      </View>
    );
  }

  if (name === "donations") {
    return (
      <View style={styles.frame}>
        <View style={[styles.donationBody, { borderColor: color }]} />
        <View style={[styles.donationLine, { backgroundColor: color }]} />
      </View>
    );
  }

  if (name === "work") {
    return (
      <View style={styles.frame}>
        <View style={[styles.workBoard, { borderColor: color }]} />
        <View style={[styles.workCheck, { borderColor: color }]} />
      </View>
    );
  }

  if (name === "meetings" || name === "finance" || name === "accounts" || name === "notifications") {
    return (
      <View style={styles.frame}>
        <View style={[styles.moduleBox, { borderColor: color }]} />
        <View style={[styles.moduleLine, { backgroundColor: color }]} />
        {name === "notifications" ? <View style={[styles.notificationDot, { backgroundColor: color }]} /> : null}
      </View>
    );
  }

  if (name === "more") {
    return (
      <View style={[styles.frame, styles.moreFrame]}>
        {[0, 1, 2].map((index) => <View key={index} style={[styles.moreDot, { backgroundColor: color }]} />)}
      </View>
    );
  }

  return (
    <View style={styles.frame}>
      <View style={[styles.profileHead, { borderColor: color }]} />
      <View style={[styles.profileBody, { borderColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { height: 24, position: "relative", width: 24 },
  homeRoof: {
    borderLeftWidth: 2,
    borderTopWidth: 2,
    height: 13,
    left: 5,
    position: "absolute",
    top: 3,
    transform: [{ rotate: "45deg" }],
    width: 13,
  },
  homeBody: {
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    bottom: 3,
    height: 11,
    left: 5,
    position: "absolute",
    width: 14,
  },
  personHead: { borderRadius: 5, borderWidth: 2, height: 8, position: "absolute", top: 3, width: 8 },
  communityHeadLeft: { left: 3 },
  communityHeadRight: { right: 3 },
  communityBody: { borderRadius: 9, borderWidth: 2, bottom: 3, height: 10, left: 2, position: "absolute", width: 20 },
  donationBody: { borderRadius: 3, borderWidth: 2, height: 17, left: 3, position: "absolute", top: 4, width: 18 },
  donationLine: { height: 2, left: 7, position: "absolute", top: 9, width: 10 },
  workBoard: { borderRadius: 3, borderWidth: 2, height: 18, left: 4, position: "absolute", top: 3, width: 16 },
  workCheck: { borderBottomWidth: 2, borderRightWidth: 2, height: 8, left: 9, position: "absolute", top: 7, transform: [{ rotate: "45deg" }], width: 5 },
  moduleBox: { borderRadius: 4, borderWidth: 2, height: 18, left: 3, position: "absolute", top: 3, width: 18 },
  moduleLine: { height: 2, left: 7, position: "absolute", top: 9, width: 10 },
  notificationDot: { borderRadius: 3, height: 5, position: "absolute", right: 1, top: 1, width: 5 },
  moreFrame: { alignItems: "center", flexDirection: "row", gap: 3, justifyContent: "center" },
  moreDot: { borderRadius: 3, height: 5, width: 5 },
  profileHead: { borderRadius: 6, borderWidth: 2, height: 10, left: 7, position: "absolute", top: 2, width: 10 },
  profileBody: { borderRadius: 10, borderWidth: 2, bottom: 2, height: 10, left: 3, position: "absolute", width: 18 },
});
