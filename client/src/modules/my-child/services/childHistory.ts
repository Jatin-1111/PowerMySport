import axiosInstance from "@/lib/api/axios";
import type {
  ChildAcademicBoard,
  ChildEventDatePrecision,
  ChildEventKind,
  ChildHistoryView,
  ChildShareListItem,
  ChildSharePublicView,
  ChildShareSection,
  ChildTimelineRow,
  ChildVideoContentType,
  ChildVideoView,
} from "@powermysport/shared-types";

/**
 * A child's sporting history, as the server builds it.
 *
 * The timeline, the tiles and the derived rows (a tournament marked played, the sport the family
 * chose, a ranking) all arrive already assembled, so nothing here works out what counts as a
 * tournament or how recent a ranking is. Writes return the one entry they touched; the screen
 * re-reads the page so the tiles and the replaced "played" row stay right.
 */

export interface NewEntry {
  kind: ChildEventKind;
  title: string;
  detail?: string;
  resultLabel?: string;
  /** `YYYY-MM-DD`. A month or a year is sent as its first day; `datePrecision` says which. */
  date: string;
  datePrecision: ChildEventDatePrecision;
  endedOn?: string;
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
  endedOn?: string | null;
  resultUrl?: string | null;
}

export interface AcademicsChanges {
  board?: ChildAcademicBoard | null;
  graduationYear?: number | null;
  school?: string | null;
  intendedField?: string | null;
}

export interface StartVideo {
  contentType: ChildVideoContentType;
  sizeBytes: number;
  /** What the browser read from the file. The server cannot read it, so it is advisory. */
  durationSeconds?: number;
  title?: string;
}

export interface UploadPlan {
  videoId: string;
  partBytes: number;
  parts: Array<{ partNumber: number; url: string; sizeBytes: number }>;
}

export interface UploadedPart {
  partNumber: number;
  etag: string;
}

export interface ShareChoice {
  sections: ChildShareSection[];
  /** The clips ticked. Left out, every finished clip goes with the link. */
  videoIds?: string[];
}

export interface NewShare extends ShareChoice {
  recipientLabel: string;
  /** The parent's agreement to the sharing notice. The server refuses anything but true. */
  consent: true;
}

export interface CreatedShare {
  share: ChildShareListItem;
  /** The link. It exists only in this response and cannot be shown again. */
  url: string;
}

const base = (childId: string) => `/child-history/${childId}`;

export const childHistoryApi = {
  async get(childId: string): Promise<ChildHistoryView> {
    const { data } = await axiosInstance.get(base(childId));
    return data.data;
  },

  async addEntry(childId: string, entry: NewEntry): Promise<ChildTimelineRow> {
    const { data } = await axiosInstance.post(`${base(childId)}/events`, entry);
    return data.data;
  },

  async updateEntry(
    childId: string,
    entryId: string,
    changes: EntryChanges
  ): Promise<ChildTimelineRow> {
    const { data } = await axiosInstance.patch(`${base(childId)}/events/${entryId}`, changes);
    return data.data;
  },

  async deleteEntry(childId: string, entryId: string): Promise<void> {
    await axiosInstance.delete(`${base(childId)}/events/${entryId}`);
  },

  async saveAcademics(childId: string, changes: AcademicsChanges): Promise<void> {
    await axiosInstance.put(`${base(childId)}/academics`, changes);
  },

  /** Records the parent's agreement to the video notice. Asked once. */
  async recordVideoConsent(): Promise<void> {
    await axiosInstance.post("/child-history/video-consent", { accepted: true });
  },

  /** Opens an upload and returns one signed link per part. The file goes straight to storage. */
  async startVideo(childId: string, clip: StartVideo): Promise<UploadPlan> {
    const { data } = await axiosInstance.post(`${base(childId)}/videos`, clip);
    return data.data;
  },

  async completeVideo(
    childId: string,
    videoId: string,
    parts: UploadedPart[]
  ): Promise<ChildVideoView> {
    const { data } = await axiosInstance.post(`${base(childId)}/videos/${videoId}/complete`, {
      parts,
    });
    return data.data;
  },

  /** Removes a clip, or cancels one still uploading. */
  async deleteVideo(childId: string, videoId: string): Promise<void> {
    await axiosInstance.delete(`${base(childId)}/videos/${videoId}`);
  },

  /** What a coach would see for this choice. Creates nothing. */
  async previewShare(childId: string, choice: ShareChoice): Promise<ChildSharePublicView> {
    const { data } = await axiosInstance.post(`${base(childId)}/shares/preview`, choice);
    return data.data;
  },

  /** The parent's own copy of the CV for a choice, as a file. Creates no link. */
  async downloadCv(childId: string, choice: ShareChoice): Promise<Blob> {
    const { data } = await axiosInstance.get(`${base(childId)}/cv.pdf`, {
      params: {
        sections: choice.sections.join(","),
        ...(choice.videoIds?.length ? { videoIds: choice.videoIds.join(",") } : {}),
      },
      responseType: "blob",
    });
    return data as Blob;
  },

  async createShare(childId: string, share: NewShare): Promise<CreatedShare> {
    const { data } = await axiosInstance.post(`${base(childId)}/shares`, share);
    return data.data;
  },

  async listShares(childId: string): Promise<ChildShareListItem[]> {
    const { data } = await axiosInstance.get(`${base(childId)}/shares`);
    return data.data;
  },

  /** Stops a link. It answers "no longer active" from then on. */
  async revokeShare(childId: string, shareId: string): Promise<ChildShareListItem> {
    const { data } = await axiosInstance.delete(`${base(childId)}/shares/${shareId}`);
    return data.data;
  },

  /** A link that plays the clip for a few minutes. */
  async videoPlayback(childId: string, videoId: string): Promise<{ url: string }> {
    const { data } = await axiosInstance.get(`${base(childId)}/videos/${videoId}/playback`);
    return data.data;
  },
};
