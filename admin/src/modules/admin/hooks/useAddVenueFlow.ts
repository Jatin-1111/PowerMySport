import { useEffect, useRef, useState } from "react";
import { toast } from "@/lib/toast";
import { adminApi } from "@/modules/admin/services/admin";
import { useRouter } from "next/navigation";
import { getDefaultOpeningHours } from "@/modules/onboarding/components/OpeningHoursInput";
import { geoApi, GeoSuggestion } from "@/modules/geo/services/geo";
import {
  FormErrors,
  getApiConflictPayload,
  VenueFormData,
  VenuePayload,
  WizardStep,
} from "@/modules/admin/utils/venueFormHelpers";

/**
 * All state, effects and handlers for the admin AddVenueForm wizard —
 * extracted so the component holds only composition and JSX. `handlePublish`
 * in particular is unchanged: it publishes a real venue (with a
 * convert-existing-user retry path on 409), so this was a pure relocation,
 * not a rewrite.
 */
export function useAddVenueFlow() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [errors, setErrors] = useState<FormErrors>({});
  const [venueId, setVenueId] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [samePriceForAll, setSamePriceForAll] = useState(true);
  const [basePricePerHour, setBasePricePerHour] = useState("");
  const skipAutocompleteRef = useRef(false);

  const [formData, setFormData] = useState<VenueFormData>({
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
    name: "",
    address: "",
    sports: [],
    pricePerHour: "",
    sportPricing: {},
    amenities: [],
    description: "",
    latitude: "",
    longitude: "",
    location: null,
    openingHours: getDefaultOpeningHours(),
    allowExternalCoaches: true,
    approvalStatus: "APPROVED",
    generalImages: [],
    generalImageKeys: [],
    sportImages: {},
    sportImageKeys: {},
    coverPhotoUrl: "",
    coverPhotoKey: "",
  });

  useEffect(() => {
    setAddressQuery(formData.address);
  }, [formData.address]);

  useEffect(() => {
    if (skipAutocompleteRef.current) {
      skipAutocompleteRef.current = false;
      return;
    }

    const query = addressQuery.trim();

    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    const timeout = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await geoApi.autocomplete(query);
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [addressQuery]);

  const buildPricingMap = (): Record<string, number> => {
    if (samePriceForAll) {
      const price = Number(basePricePerHour || 0);
      return formData.sports.reduce<Record<string, number>>((acc, sport) => {
        acc[sport] = price;
        return acc;
      }, {});
    }

    return formData.sports.reduce<Record<string, number>>((acc, sport) => {
      acc[sport] = formData.sportPricing[sport] || 0;
      return acc;
    }, {});
  };

  const buildBasePayload = (): VenuePayload | null => {
    if (!formData.location) {
      return null;
    }

    const pricingMap = buildPricingMap();
    const pricePerHour = samePriceForAll
      ? Number(basePricePerHour || 0)
      : Math.min(...Object.values(pricingMap).filter((value) => value > 0));

    return {
      ownerName: formData.ownerName.trim(),
      ownerEmail: formData.ownerEmail.trim(),
      ownerPhone: formData.ownerPhone.trim(),
      name: formData.name.trim(),
      address: formData.address.trim(),
      sports: formData.sports,
      pricePerHour: Number.isFinite(pricePerHour) ? pricePerHour : 0,
      sportPricing: pricingMap,
      amenities: formData.amenities,
      description: formData.description.trim(),
      location: formData.location,
      openingHours: formData.openingHours,
      allowExternalCoaches: formData.allowExternalCoaches,
      approvalStatus: formData.approvalStatus,
    };
  };

  const buildFinalPayload = (): VenuePayload | null => {
    const basePayload = buildBasePayload();
    if (!basePayload) {
      return null;
    }

    return {
      ...basePayload,
      generalImages: formData.generalImages,
      generalImageKeys: formData.generalImageKeys,
      sportImages: formData.sportImages,
      sportImageKeys: formData.sportImageKeys,
      coverPhotoUrl: formData.coverPhotoUrl,
      coverPhotoKey: formData.coverPhotoKey,
    };
  };

  const invalidateDraft = () => {
    setVenueId("");
    setFormData((prev) => ({
      ...prev,
      generalImages: [],
      generalImageKeys: [],
      sportImages: {},
      sportImageKeys: {},
      coverPhotoUrl: "",
      coverPhotoKey: "",
    }));
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setErrors((prev) => ({ ...prev, [name]: "" }));

    if (type === "checkbox") {
      setFormData((prev) => ({ ...prev, [name]: checked }));
      return;
    }

    if (name === "pricePerHour") {
      const nextValue = value === "" ? "" : Number(value);
      setBasePricePerHour(value);
      setFormData((prev) => ({ ...prev, pricePerHour: nextValue }));
      return;
    }

    if (name === "approvalStatus") {
      setFormData((prev) => ({
        ...prev,
        approvalStatus: value as VenueFormData["approvalStatus"],
      }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectSuggestion = (suggestion: GeoSuggestion) => {
    skipAutocompleteRef.current = true;
    setSuggestions([]);
    setFormData((prev) => ({
      ...prev,
      address: suggestion.label,
      latitude: suggestion.lat,
      longitude: suggestion.lon,
      location: {
        type: "Point",
        coordinates: [suggestion.lon, suggestion.lat],
      },
    }));
    setErrors((prev) => ({ ...prev, address: "" }));
  };

  const clearLocation = () => {
    skipAutocompleteRef.current = true;
    setFormData((prev) => ({
      ...prev,
      latitude: "",
      longitude: "",
      location: null,
    }));
  };

  const handleBasePriceChange = (value: number | "") => {
    const textValue = value === "" ? "" : String(value);
    setBasePricePerHour(textValue);
    setFormData((prev) => ({
      ...prev,
      pricePerHour: value,
    }));

    if (samePriceForAll && value !== "") {
      const priceNum = typeof value === "number" ? value : 0;
      const pricing: Record<string, number> = {};
      formData.sports.forEach((sport) => {
        pricing[sport] = priceNum;
      });
      setFormData((prev) => ({ ...prev, sportPricing: pricing }));
    }
  };

  const handleSportPriceChange = (sport: string, price: number) => {
    setFormData((prev) => ({
      ...prev,
      sportPricing: {
        ...prev.sportPricing,
        [sport]: price,
      },
    }));
  };

  const toggleSamePriceMode = (same: boolean) => {
    setSamePriceForAll(same);

    if (same && basePricePerHour !== "") {
      const pricing: Record<string, number> = {};
      formData.sports.forEach((sport) => {
        pricing[sport] = Number(basePricePerHour);
      });
      setFormData((prev) => ({ ...prev, sportPricing: pricing }));
    }
  };

  const validateStep1 = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.ownerName.trim()) {
      newErrors.ownerName = "Owner name is required";
    }

    if (!formData.ownerEmail.trim()) {
      newErrors.ownerEmail = "Owner email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.ownerEmail)) {
      newErrors.ownerEmail = "Enter a valid email address";
    }

    if (!formData.ownerPhone.trim()) {
      newErrors.ownerPhone = "Owner mobile number is required";
    } else {
      const phoneRegex = /^[+]?[0-9\s().\-]+$/;
      const digitsOnly = formData.ownerPhone.replace(/\D/g, "");
      if (digitsOnly.length < 10) {
        newErrors.ownerPhone = "Owner mobile number must have at least 10 digits";
      } else if (!phoneRegex.test(formData.ownerPhone)) {
        newErrors.ownerPhone = "Enter a valid mobile number";
      }
    }

    if (!formData.name.trim()) {
      newErrors.name = "Venue name is required";
    }

    if (!formData.address.trim() || !formData.location) {
      newErrors.address = "Please select a valid address from suggestions";
    }

    setErrors((prev) => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: FormErrors = {};

    if (formData.sports.length === 0) {
      newErrors.sports = "At least one sport is required";
    }

    if (samePriceForAll) {
      if (basePricePerHour === "" || Number(basePricePerHour) <= 0) {
        newErrors.pricePerHour = "Price must be greater than 0";
      }
    } else {
      const invalidSport = formData.sports.find(
        (sport) => (formData.sportPricing[sport] || 0) <= 0
      );
      if (invalidSport) {
        newErrors.sportPricing = `Please enter valid price for ${invalidSport}`;
      }
    }

    setErrors((prev) => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const ensureDraftVenue = async (): Promise<string> => {
    if (venueId) {
      return venueId;
    }

    const basePayload = buildBasePayload();
    if (!basePayload) {
      throw new Error("Venue location is required");
    }

    const response = await adminApi.createVenue(basePayload);

    if (!response.success || !response.data) {
      throw new Error(response.message || "Failed to create draft venue");
    }

    const createdVenueId = (response.data as any).id || (response.data as any)._id;
    if (!createdVenueId) {
      throw new Error("Created venue ID not found");
    }

    setVenueId(createdVenueId);
    return createdVenueId;
  };

  const handleNextFromStep1 = () => {
    if (validateStep1()) {
      setCurrentStep(2);
    }
  };

  const handleNextFromStep2 = async () => {
    if (!validateStep2()) {
      return;
    }

    setLoading(true);
    try {
      await ensureDraftVenue();
      setCurrentStep(3);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create draft venue");
    } finally {
      setLoading(false);
    }
  };

  const handleImagesReady = (images: {
    generalImages: string[];
    generalImageKeys: string[];
    sportImages: Record<string, string[]>;
    sportImageKeys: Record<string, string[]>;
    coverPhotoUrl: string;
    coverPhotoKey: string;
  }) => {
    setFormData((prev) => ({
      ...prev,
      ...images,
    }));
    setCurrentStep(4);
  };

  const handleContinueWithoutDocuments = () => {
    setCurrentStep(5);
  };

  const handlePublish = async () => {
    if (!venueId) {
      toast.error("Draft venue not found. Please go back and create it again.");
      return;
    }

    const payload = buildFinalPayload();
    if (!payload) {
      toast.error("Venue location is required");
      return;
    }

    if (payload.images && payload.images.length === 0) {
      toast.error("Please upload all required images");
      return;
    }

    setLoading(true);
    try {
      const attemptPublish = async (convertExistingUser?: boolean) =>
        adminApi.updateVenue(venueId, {
          ...payload,
          ...(convertExistingUser ? { convertExistingUser: true } : {}),
        });

      const response = await attemptPublish();

      if (response.success) {
        toast.success("Venue created successfully!");
        router.push("/admin/venues");
        return;
      }

      toast.error(response.message || "Failed to create venue");
    } catch (error) {
      const { status, data } = getApiConflictPayload(error);

      if (status === 409 && data?.requiresConversion) {
        const shouldConvert = window.confirm(
          data.message ||
            "An account already exists for this owner. Convert it to a venue lister to continue?"
        );

        if (shouldConvert) {
          try {
            const retryResponse = await adminApi.updateVenue(venueId, {
              ...payload,
              convertExistingUser: true,
            });

            if (retryResponse.success) {
              toast.success("Venue created successfully!");
              router.push("/admin/venues");
              return;
            }

            toast.error(retryResponse.message || "Failed to create venue");
          } catch (retryError) {
            toast.error(
              retryError instanceof Error ? retryError.message : "Failed to create venue"
            );
          }
        }

        return;
      }

      toast.error(error instanceof Error ? error.message : "Failed to create venue");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as WizardStep);
    }
  };

  const handleStepJump = (targetStep: WizardStep) => {
    if (loading || targetStep >= currentStep) {
      return;
    }

    setCurrentStep(targetStep);
  };

  return {
    router,
    loading,
    currentStep,
    setCurrentStep,
    errors,
    venueId,
    addressQuery,
    setAddressQuery,
    suggestions,
    isSearching,
    samePriceForAll,
    basePricePerHour,
    formData,
    setFormData,
    setErrors,

    invalidateDraft,
    handleInputChange,
    handleSelectSuggestion,
    clearLocation,
    handleBasePriceChange,
    handleSportPriceChange,
    toggleSamePriceMode,
    handleNextFromStep1,
    handleNextFromStep2,
    handleImagesReady,
    handleContinueWithoutDocuments,
    handlePublish,
    handleBack,
    handleStepJump,
  };
}
