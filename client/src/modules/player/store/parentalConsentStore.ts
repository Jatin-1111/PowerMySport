import { create } from "zustand";

interface ParentalConsentStore {
  /** Set while the consent dialog is open; settled when the parent answers. */
  pending: { resolve: (agreed: boolean) => void } | null;
  /** Opens the dialog and resolves true once the parent agrees, false if they cancel. */
  request: () => Promise<boolean>;
  settle: (agreed: boolean) => void;
}

export const useParentalConsentStore = create<ParentalConsentStore>((set, get) => ({
  pending: null,
  request: () =>
    new Promise<boolean>((resolve) => {
      // A second request while one is open joins the same answer.
      const existing = get().pending;
      if (existing) {
        const first = existing.resolve;
        set({
          pending: {
            resolve: (agreed) => {
              first(agreed);
              resolve(agreed);
            },
          },
        });
        return;
      }
      set({ pending: { resolve } });
    }),
  settle: (agreed) => {
    const { pending } = get();
    set({ pending: null });
    pending?.resolve(agreed);
  },
}));

/** Asks the parent for consent through the app-wide dialog. */
export const requestParentalConsent = (): Promise<boolean> =>
  useParentalConsentStore.getState().request();
