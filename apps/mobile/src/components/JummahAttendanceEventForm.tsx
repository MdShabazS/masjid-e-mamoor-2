import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, TextInput, View } from "react-native";

import { AppButton, InformationCard } from "./InstitutionalUI";
import { AppIcon } from "./AppIcon";
import { AppText as Text } from "./AppText";
import { getCurrentJummahLocation, type JummahAttendanceEventDraft } from "../modules/jummah-attendance";
import { colors } from "../theme/colors";
import { fontFamilies, radii, spacing, touchTargets } from "../theme/tokens";

type EventField = "scheduledFor" | "checkinOpensAt" | "checkinClosesAt";
type PickerState = { field: EventField; mode: "date" | "time" };

interface Props {
  pending: boolean;
  onSubmit: (draft: JummahAttendanceEventDraft) => void;
}

const labels: Record<EventField, string> = {
  scheduledFor: "Jummah event time",
  checkinOpensAt: "Check-in opens",
  checkinClosesAt: "Check-in closes",
};

export function JummahAttendanceEventForm({ pending, onSubmit }: Props) {
  const [times, setTimes] = useState<Record<EventField, Date | null>>({
    scheduledFor: null,
    checkinOpensAt: null,
    checkinClosesAt: null,
  });
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  const setDatePart = (field: EventField, mode: PickerState["mode"], selected?: Date) => {
    setPicker(null);
    if (!selected) return;
    setTimes((current) => {
      const existing = current[field] ?? new Date();
      const next = new Date(existing);
      if (mode === "date") {
        next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      } else {
        next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      }
      return { ...current, [field]: next };
    });
  };

  const chooseLocation = async () => {
    if (gettingLocation) return;
    setGettingLocation(true);
    try {
      const location = await getCurrentJummahLocation();
      setLatitude(location.latitude.toFixed(7));
      setLongitude(location.longitude.toFixed(7));
    } catch {
      Alert.alert(
        "Location unavailable",
        "Allow foreground location access or enter the Masjid coordinates manually.",
      );
    } finally {
      setGettingLocation(false);
    }
  };

  const submit = () => {
    if (pending) return;
    if (!times.scheduledFor || !times.checkinOpensAt || !times.checkinClosesAt) {
      Alert.alert("Event times required", "Choose the event time and both check-in times.");
      return;
    }
    const centerLatitude = Number(latitude);
    const centerLongitude = Number(longitude);
    if (!latitude.trim() || !longitude.trim() || !Number.isFinite(centerLatitude) || !Number.isFinite(centerLongitude)) {
      Alert.alert("Masjid location required", "Enter valid latitude and longitude coordinates.");
      return;
    }
    onSubmit({
      scheduledFor: times.scheduledFor,
      checkinOpensAt: times.checkinOpensAt,
      checkinClosesAt: times.checkinClosesAt,
      centerLatitude,
      centerLongitude,
    });
  };

  return (
    <View style={styles.form}>
      <InformationCard style={styles.locationCard}>
        <View style={styles.locationTitleRow}>
          <AppIcon color={colors.primaryBlue} name="map-marker-radius-outline" size={22} />
          <Text style={styles.sectionTitle}>Masjid attendance centre</Text>
        </View>
        <Text style={styles.helper}>
          The server uses a fixed 100 metre acceptance radius. Attendee coordinates are checked by the server and are not retained.
        </Text>
        <View style={styles.coordinateRow}>
          <CoordinateInput label="Latitude" value={latitude} onChangeText={setLatitude} />
          <CoordinateInput label="Longitude" value={longitude} onChangeText={setLongitude} />
        </View>
        <AppButton
          disabled={pending || gettingLocation}
          label={gettingLocation ? "Getting location..." : "Use current location"}
          onPress={() => void chooseLocation()}
          variant="secondary"
          icon={<AppIcon color={colors.primaryBlue} name="crosshairs-gps" size={18} />}
        />
      </InformationCard>

      <InformationCard style={styles.timeCard}>
        <Text style={styles.sectionTitle}>Event schedule</Text>
        {(Object.keys(labels) as EventField[]).map((field) => (
          <View key={field} style={styles.timeField}>
            <Text style={styles.label}>{labels[field]}</Text>
            <View style={styles.timeActions}>
              <TimePartButton
                icon="calendar-blank-outline"
                label={times[field] ? times[field]!.toLocaleDateString() : "Choose date"}
                onPress={() => setPicker({ field, mode: "date" })}
              />
              <TimePartButton
                icon="clock-outline"
                label={times[field] ? times[field]!.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Choose time"}
                onPress={() => setPicker({ field, mode: "time" })}
              />
            </View>
          </View>
        ))}
      </InformationCard>

      <AppButton
        disabled={pending || gettingLocation}
        label={pending ? "Creating event..." : "Create Jummah event"}
        onPress={submit}
      />

      {picker ? (
        <DateTimePicker
          display="default"
          mode={picker.mode}
          onChange={(event: DateTimePickerEvent, selected?: Date) => {
            if (event.type === "dismissed") setPicker(null);
            else setDatePart(picker.field, picker.mode, selected);
          }}
          value={times[picker.field] ?? new Date()}
        />
      ) : null}
    </View>
  );
}

function CoordinateInput({ label, value, onChangeText }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.coordinateInput}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        keyboardType="numbers-and-punctuation"
        onChangeText={onChangeText}
        placeholder="0.0000000"
        placeholderTextColor={colors.textMuted}
        selectTextOnFocus
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function TimePartButton({ icon, label, onPress }: {
  icon: "calendar-blank-outline" | "clock-outline";
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.timeButton}>
      <AppIcon color={colors.primaryBlue} name={icon} size={17} />
      <Text numberOfLines={1} style={styles.timeButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg, marginTop: spacing.lg },
  locationCard: { gap: spacing.md, padding: spacing.lg },
  locationTitleRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  sectionTitle: { color: colors.textStrong, fontFamily: fontFamilies.semibold, fontSize: 16, lineHeight: 22 },
  helper: { color: colors.textMuted, fontFamily: fontFamilies.regular, fontSize: 13, lineHeight: 19 },
  coordinateRow: { flexDirection: "row", gap: spacing.md },
  coordinateInput: { flex: 1, gap: spacing.xs },
  label: { color: colors.textStrong, fontFamily: fontFamilies.medium, fontSize: 13 },
  input: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: radii.control, borderWidth: 1, color: colors.textStrong, fontFamily: fontFamilies.regular, fontSize: 15, minHeight: touchTargets.minimum, paddingHorizontal: spacing.md },
  timeCard: { gap: spacing.md, padding: spacing.lg },
  timeField: { gap: spacing.xs },
  timeActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  timeButton: { alignItems: "center", backgroundColor: colors.blueSurface, borderColor: colors.border, borderRadius: radii.control, borderWidth: 1, flexDirection: "row", flexGrow: 1, gap: spacing.sm, minHeight: touchTargets.minimum, paddingHorizontal: spacing.md },
  timeButtonText: { color: colors.textStrong, flexShrink: 1, fontFamily: fontFamilies.medium, fontSize: 13 },
});
