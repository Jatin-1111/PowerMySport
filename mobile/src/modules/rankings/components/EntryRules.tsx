import React from "react";
import { View, Text, Linking } from "react-native";
import {
  ENTRY_BANDS,
  JUNIOR_LADDER,
  RULES_SOURCE,
  annualEntryCap,
  isJuniorBracket,
} from "@powermysport/shared-types";
import { Body, Heading, Panel, SmallButton } from "@/modules/planner/components/ui";

// The source's range uses an en dash; the app writes "to".
const bandRange = (range: string) => range.replace(/\s*–\s*/, " to ");

/**
 * "What a rank opens and closes", for junior lists only. The rules bar the top of a list from the
 * lower rungs; they promise nobody entry to the higher ones, so nothing here says a level is "open to you".
 */
export function EntryRules({ subcategory, listLabel }: { subcategory: string; listLabel: string }) {
  if (!isJuniorBracket(subcategory)) return null;
  const cap = annualEntryCap(subcategory);
  const age = Number(subcategory.replace(/\D/g, ""));
  const hasTalent = age === 12 || age === 14 || age === 16;

  return (
    <View className="mb-6">
      <Heading>What a rank opens and closes</Heading>
      <Panel>
        <Text className="text-body mb-2 text-sm">
          Junior tournaments in India run in levels, easiest first:
        </Text>
        {JUNIOR_LADDER.map((l) => (
          <Text key={l.name} className="text-body mb-1 text-sm">
            <Text className="text-ink font-semibold">{l.name}</Text>: {l.plain}
          </Text>
        ))}

        {hasTalent ? (
          <>
            <View className="mt-3">
              <Body>
                Here is the part that surprises most parents: a better rank closes the entry level.
                Once a player is inside the top 75 of their age group, AITA no longer lets them
                enter Talent Series. Those draws are kept for players still working their way up.
                Every other level stays open.
              </Body>
            </View>
            <View className="rounded-button border-hairline mt-3 overflow-hidden border">
              {ENTRY_BANDS.map((b, i) => (
                <View
                  key={b.range}
                  className={`px-3 py-2.5 ${i > 0 ? "border-hairline border-t" : ""}`}
                >
                  <Text className="text-ink text-sm font-semibold">{bandRange(b.range)}</Text>
                  <Text className="text-body text-sm">{b.effect}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <View className="mt-3">
            <Body>
              Under 18 runs no Talent Series events, and Championship Series has no ranking bar, so
              every level here is open to enter at any rank.
            </Body>
          </View>
        )}

        {cap ? (
          <View className="mt-3">
            <Body>
              Tournament limit: a {listLabel} player may enter {cap} tournaments in a year. Entering
              an older age group uses up the same allowance. It is one budget for the year, not one
              per list.
            </Body>
          </View>
        ) : null}

        <Text className="text-muted mt-3 text-xs leading-relaxed">
          Rules from the AITA Junior Tournament Structure, effective 1 January 2026. Check the
          current regulations with AITA or your state association before planning entries.
        </Text>
        <View className="mt-2 flex-row">
          <SmallButton
            label="Open the AITA rules"
            onPress={() => void Linking.openURL(RULES_SOURCE.href)}
          />
        </View>
      </Panel>
    </View>
  );
}
