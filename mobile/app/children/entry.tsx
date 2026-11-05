import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import {
  CHILD_HISTORY_LIMITS,
  type ChildEventDatePrecision,
  type ChildEventKind,
} from "@powermysport/shared-types";
import { Button } from "@components/ui/Button";
import { Input } from "@components/ui/Input";
import { DobFields } from "@components/ui/DobFields";
import { childrenApi } from "@/modules/children/services/children";
import { childHistoryApi } from "@/modules/children/services/childHistory";
import {
  PhotoUploadError,
  pickPhoto,
  uploadPhoto,
  type PickedPhoto,
} from "@/modules/children/services/photoUpload";
import { PhotoField } from "@/modules/children/components/PhotoField";
import {
  ENTRY_KINDS,
  EMPTY_PARTS,
  KIND_HINTS,
  KIND_LABELS,
  PRECISIONS,
  cleanLink,
  dateFromParts,
  partsFromIso,
  type DateParts,
} from "@/modules/children/utils/entries";
import { COLORS } from "@lib/constants";

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`rounded-button min-h-[44px] justify-center border px-4 ${
        selected ? "border-ink bg-ink" : "border-hairline bg-surface"
      }`}
    >
      <Text className={`text-sm font-medium ${selected ? "text-white" : "text-ink"}`}>{label}</Text>
    </TouchableOpacity>
  );
}

const messageOf = (err: unknown): string =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
  "Please try again.";

export default function EntryScreen() {
  const {
    childId,
    entryId,
    editionSlug,
    title: presetTitle,
  } = useLocalSearchParams<{
    childId: string;
    entryId?: string;
    editionSlug?: string;
    title?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const editing = Boolean(entryId);
  const fromTournament = Boolean(editionSlug);

  const [kind, setKind] = useState<ChildEventKind>(
    fromTournament ? "tournament_result" : ENTRY_KINDS[0]
  );
  const [title, setTitle] = useState(presetTitle ?? "");
  const [precision, setPrecision] = useState<ChildEventDatePrecision>(
    fromTournament ? "day" : "month"
  );
  const [parts, setParts] = useState<DateParts>(EMPTY_PARTS);
  const [resultLabel, setResultLabel] = useState("");
  const [link, setLink] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(editing);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  // The photo: what the entry already has, what was just picked, and whether the old one is to go.
  const [hadPhoto, setHadPhoto] = useState(false);
  const [storedPhotoUrl, setStoredPhotoUrl] = useState<string | null>(null);
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  const [picked, setPicked] = useState<PickedPhoto | null>(null);
  const [removeStored, setRemoveStored] = useState(false);

  // Editing starts from the stored entry. The list rows already on screen are not passed in, so a
  // change made on the website since is never overwritten with an old copy.
  useEffect(() => {
    if (!entryId) return;
    let alive = true;
    childrenApi
      .history(childId)
      .then((view) => {
        if (!alive) return;
        const row = view.timeline.find((r) => r.id === entryId && r.editable);
        if (!row || row.kind === "milestone" || row.kind === "ranking") {
          setLoadFailed(true);
          return;
        }
        setKind(row.kind);
        setTitle(row.title);
        setPrecision(row.datePrecision);
        setParts(partsFromIso(row.occurredOn, row.datePrecision));
        setResultLabel(row.resultLabel ?? "");
        setLink(row.resultUrl ?? "");
        setNotes(row.detail ?? "");
        if (row.hasPhoto) {
          setHadPhoto(true);
          setLoadingPhoto(true);
          // A short link to the stored photo. If it cannot be fetched the entry can still be edited.
          childHistoryApi
            .photoUrl(childId, entryId)
            .then((url) => alive && setStoredPhotoUrl(url))
            .catch(() => undefined)
            .finally(() => alive && setLoadingPhoto(false));
        }
      })
      .catch(() => alive && setLoadFailed(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [childId, entryId]);

  const hints = KIND_HINTS[kind];
  const clear = (field: string) => errors[field] && setErrors((e) => ({ ...e, [field]: "" }));

  const save = async () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "Give this entry a title";
    const date = dateFromParts(parts, precision);
    if (!date.ok) e.date = date.error;
    const url = cleanLink(link);
    if (!url.ok) e.link = "Use a link that starts with https://";
    setErrors(e);
    if (Object.keys(e).length > 0 || !date.ok || !url.ok) return;

    setSaving(true);
    // The entry is saved first; the photo follows. If only the photo fails, the entry is kept and
    // the parent is told, so nothing typed is lost.
    let savedId = entryId;
    try {
      if (entryId) {
        await childHistoryApi.updateEntry(childId, entryId, {
          title: title.trim(),
          resultLabel: resultLabel.trim() || null,
          detail: notes.trim() || null,
          resultUrl: url.url,
          date: date.iso,
          datePrecision: precision,
        });
      } else {
        const created = await childHistoryApi.addEntry(childId, {
          kind,
          title: title.trim(),
          date: date.iso,
          datePrecision: precision,
          ...(resultLabel.trim() ? { resultLabel: resultLabel.trim() } : {}),
          ...(notes.trim() ? { detail: notes.trim() } : {}),
          ...(url.url ? { resultUrl: url.url } : {}),
          ...(editionSlug ? { editionSlug } : {}),
        });
        savedId = created.id;
      }
    } catch (err) {
      Alert.alert("Could not save this entry", messageOf(err));
      setSaving(false);
      return;
    }

    try {
      if (savedId && hadPhoto && (removeStored || picked)) {
        await childHistoryApi.deletePhoto(childId, savedId);
      }
      if (savedId && picked) await uploadPhoto(childId, savedId, picked);
    } catch (err) {
      const reason = err instanceof PhotoUploadError ? err.message : messageOf(err);
      Alert.alert(
        "Entry saved, photo not saved",
        `${reason} Open the entry again to add the photo.`
      );
    } finally {
      setSaving(false);
    }
    router.back();
  };

  const choosePhoto = async (source: "camera" | "library") => {
    const result = await pickPhoto(source);
    if (result.ok) {
      setPicked(result.photo);
    } else if (result.reason !== "cancelled") {
      Alert.alert("Could not add the photo", result.message);
    }
  };

  const clearPhoto = () => {
    setPicked(null);
    if (hadPhoto) setRemoveStored(true);
  };

  // What the photo area shows: a photo just picked, else the stored one unless it is to be removed.
  const showStored = hadPhoto && !removeStored && !picked;
  const previewUri = picked ? picked.uri : showStored ? storedPhotoUrl : null;

  const remove = () => {
    if (!entryId) return;
    Alert.alert("Delete this entry?", "It is removed from the record and from any new link.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setSaving(true);
          try {
            await childHistoryApi.deleteEntry(childId, entryId);
            router.back();
          } catch (err) {
            Alert.alert("Could not delete this entry", messageOf(err));
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView
        className="bg-canvas flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 20,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          className="rounded-tile bg-surface mb-6 h-9 w-9 items-center justify-center"
        >
          <ArrowLeft size={18} color={COLORS.ink} />
        </TouchableOpacity>

        <Text className="text-ink mb-1 text-2xl font-bold">
          {editing ? "Edit entry" : fromTournament ? "Add a result" : "Add an entry"}
        </Text>
        <Text className="text-muted mb-6 text-sm">
          Only what you type is saved. Nothing here is shared unless you make a link.
        </Text>

        {loading ? (
          <View className="items-center py-16">
            <ActivityIndicator color={COLORS.action} />
          </View>
        ) : loadFailed ? (
          <View className="items-center py-16">
            <Text className="text-ink mb-1 text-base font-semibold">Could not load this entry</Text>
            <Text className="text-muted mb-4 text-center text-sm">
              It may have been removed. Go back and try again.
            </Text>
            <Button onPress={() => router.back()}>Go back</Button>
          </View>
        ) : (
          <>
            {!editing && !fromTournament && (
              <>
                <Text className="text-ink mb-2 text-sm font-medium">What is it</Text>
                <View className="mb-5 flex-row flex-wrap gap-2">
                  {ENTRY_KINDS.map((k) => (
                    <Chip
                      key={k}
                      label={KIND_LABELS[k]}
                      selected={kind === k}
                      onPress={() => setKind(k)}
                    />
                  ))}
                </View>
              </>
            )}

            <Input
              label="Title"
              placeholder={hints.title}
              value={title}
              maxLength={CHILD_HISTORY_LIMITS.titleChars}
              onChangeText={(v) => {
                setTitle(v);
                clear("title");
              }}
              autoCapitalize="sentences"
              error={errors.title}
            />

            <Text className="text-ink mb-2 text-sm font-medium">How exact is the date</Text>
            <View className="mb-4 flex-row flex-wrap gap-2">
              {PRECISIONS.map((p) => (
                <Chip
                  key={p.value}
                  label={p.label}
                  selected={precision === p.value}
                  onPress={() => {
                    setPrecision(p.value);
                    clear("date");
                  }}
                />
              ))}
            </View>
            <View className="mb-1">
              <DobFields
                value={parts}
                onChange={(next) => {
                  setParts(next);
                  clear("date");
                }}
                showDay={precision === "day"}
                showMonth={precision !== "year"}
              />
            </View>
            {errors.date ? (
              <Text className="text-danger mb-3 mt-1 text-xs">{errors.date}</Text>
            ) : (
              <View className="mb-4" />
            )}

            <Input
              label={`${hints.resultLabel} (optional)`}
              placeholder={hints.result}
              value={resultLabel}
              maxLength={CHILD_HISTORY_LIMITS.resultLabelChars}
              onChangeText={setResultLabel}
              autoCapitalize="sentences"
            />

            <Input
              label="Link to the draw or result page (optional)"
              placeholder="https://"
              value={link}
              onChangeText={(v) => {
                setLink(v);
                clear("link");
              }}
              keyboardType="url"
              autoCorrect={false}
              error={errors.link}
              hint="A reader can open it to check the entry."
            />

            <Text className="text-ink mb-1.5 text-sm font-medium">Notes (optional)</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              multiline
              maxLength={CHILD_HISTORY_LIMITS.detailChars}
              textAlignVertical="top"
              placeholderTextColor={COLORS.muted}
              accessibilityLabel="Notes"
              className="rounded-button border-hairline bg-surface text-ink mb-6 min-h-[96px] border px-4 py-3 text-base"
            />

            <PhotoField
              previewUri={previewUri}
              loadingPreview={showStored && loadingPhoto}
              disabled={saving}
              onTake={() => void choosePhoto("camera")}
              onChoose={() => void choosePhoto("library")}
              onRemove={clearPhoto}
            />

            <Button size="lg" onPress={save} loading={saving}>
              {editing ? "Save changes" : "Add entry"}
            </Button>
            {editing && (
              <View className="mt-3">
                <Button variant="outline" size="lg" onPress={remove} disabled={saving}>
                  Delete entry
                </Button>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
