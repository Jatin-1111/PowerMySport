import apiClient from "@lib/api/axios";
import type {
  ChildEventDatePrecision,
  ChildEventKind,
  ChildPhotoContentType,
  ChildTimelineRow,
} from "@powermysport/shared-types";

/** What a parent types for a new entry. The server checks every field again. */
export interface NewEntry {
  kind: ChildEventKind;
  title: string;
  detail?: string;
  resultLabel?: string;
  /** `YYYY-MM-DD`. A month or a year is sent as its first day; `datePrecision` says which. */
  date: string;
  datePrecision: ChildEventDatePrecision;
  resultUrl?: string;
  /** Set when the entry is the result of a tournament marked played in the planner. */
  editionSlug?: string;
}

/** `null` clears an optional field; a field left out is left alone. The kind never changes. */
export interface EntryChanges {
  title?: string;
  detail?: string | null;
  resultLabel?: string | null;
  date?: string;
  datePrecision?: ChildEventDatePrecision;
  resultUrl?: string | null;
}

const base = (childId: string) => `/child-history/${childId}`;

export interface PhotoUpload {
  url: string;
  method: "PUT";
  /** Exactly these headers: the signature covers the type, so any other value is refused. */
  headers: { "Content-Type": string };
}

export const childHistoryApi = {
  /** Opens an upload for the entry's photo. The file then goes straight to storage. */
  async startPhoto(
    childId: string,
    entryId: string,
    photo: { contentType: ChildPhotoContentType; sizeBytes: number }
  ): Promise<PhotoUpload> {
    const res = await apiClient.post(`${base(childId)}/events/${entryId}/photo`, photo);
    return res.data.data.upload;
  },

  /** Tells the server the file is stored, so it checks the size and type and counts the photo. */
  async completePhoto(childId: string, entryId: string): Promise<void> {
    await apiClient.post(`${base(childId)}/events/${entryId}/photo/complete`);
  },

  /** A link that shows the photo for ten minutes. */
  async photoUrl(childId: string, entryId: string): Promise<string> {
    const res = await apiClient.get(`${base(childId)}/events/${entryId}/photo`);
    return res.data.data.url;
  },

  async deletePhoto(childId: string, entryId: string): Promise<void> {
    await apiClient.delete(`${base(childId)}/events/${entryId}/photo`);
  },

  async addEntry(childId: string, entry: NewEntry): Promise<ChildTimelineRow> {
    const res = await apiClient.post(`${base(childId)}/events`, entry);
    return res.data.data;
  },

  async updateEntry(
    childId: string,
    entryId: string,
    changes: EntryChanges
  ): Promise<ChildTimelineRow> {
    const res = await apiClient.patch(`${base(childId)}/events/${entryId}`, changes);
    return res.data.data;
  },

  async deleteEntry(childId: string, entryId: string): Promise<void> {
    await apiClient.delete(`${base(childId)}/events/${entryId}`);
  },
};
