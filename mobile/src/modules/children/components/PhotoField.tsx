import React from "react";
import { View, Text, Image, TouchableOpacity, ActivityIndicator } from "react-native";
import { Camera, ImageIcon } from "lucide-react-native";
import { COLORS } from "@lib/constants";

/**
 * The photo of a certificate or result sheet on an entry. It shows what is attached (a photo just
 * chosen, or the one already stored), with the ways to change it, or two buttons to add one.
 *
 * It holds no state of its own: the screen owns what was picked and what was removed, and the
 * photo is only sent when the entry is saved.
 */
export function PhotoField({
  previewUri,
  loadingPreview,
  disabled,
  onTake,
  onChoose,
  onRemove,
}: {
  /** What to show: the photo just picked, or a short link to the stored one. */
  previewUri: string | null;
  loadingPreview: boolean;
  disabled: boolean;
  onTake: () => void;
  onChoose: () => void;
  onRemove: () => void;
}) {
  const hasPhoto = previewUri !== null || loadingPreview;

  return (
    <View className="mb-6">
      <Text className="text-ink mb-1.5 text-sm font-medium">
        Photo of the certificate (optional)
      </Text>

      {hasPhoto ? (
        <View className="rounded-tile border-hairline bg-surface overflow-hidden border">
          <View className="bg-wash h-56 items-center justify-center">
            {previewUri ? (
              <Image
                source={{ uri: previewUri }}
                resizeMode="contain"
                accessibilityLabel="Photo of the certificate"
                style={{ width: "100%", height: "100%" }}
              />
            ) : (
              <ActivityIndicator color={COLORS.action} />
            )}
          </View>
          <View className="border-hairline flex-row border-t">
            <TouchableOpacity
              onPress={onChoose}
              disabled={disabled}
              accessibilityRole="button"
              className="min-h-[48px] flex-1 items-center justify-center"
            >
              <Text className="text-action text-sm font-semibold">Choose another</Text>
            </TouchableOpacity>
            <View className="bg-hairline w-px" />
            <TouchableOpacity
              onPress={onRemove}
              disabled={disabled}
              accessibilityRole="button"
              className="min-h-[48px] flex-1 items-center justify-center"
            >
              <Text className="text-body text-sm font-semibold">Remove photo</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={onTake}
            disabled={disabled}
            accessibilityRole="button"
            className="rounded-button border-hairline bg-surface min-h-[48px] flex-1 flex-row items-center justify-center border px-3"
          >
            <Camera size={18} color={COLORS.ink} />
            <Text className="text-ink ml-2 text-sm font-semibold">Take a photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onChoose}
            disabled={disabled}
            accessibilityRole="button"
            className="rounded-button border-hairline bg-surface min-h-[48px] flex-1 flex-row items-center justify-center border px-3"
          >
            <ImageIcon size={18} color={COLORS.ink} />
            <Text className="text-ink ml-2 text-sm font-semibold">From gallery</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text className="text-muted mt-2 text-xs leading-relaxed">
        Only you can see this photo. A JPEG, PNG or WebP up to 8 MB.
      </Text>
    </View>
  );
}
