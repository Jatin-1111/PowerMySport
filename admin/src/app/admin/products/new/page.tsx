"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { adminEcommerceApi } from "@/modules/admin/services/ecommerce";
import { Card } from "@/modules/shared/ui/Card";
import { Button } from "@/modules/shared/ui/Button";
const Input = ({
  error,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) => (
  <div className="w-full">
    <input
      {...props}
      className={`w-full rounded-md border ${error ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "border-slate-300 focus:border-power-orange focus:ring-power-orange"} px-3 py-2 text-sm focus:outline-none focus:ring-1 ${className || ""}`}
    />
    {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
  </div>
);

const Textarea = ({
  error,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string }) => (
  <div className="w-full">
    <textarea
      {...props}
      className={`w-full rounded-md border ${error ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "border-slate-300 focus:border-power-orange focus:ring-power-orange"} px-3 py-2 text-sm focus:outline-none focus:ring-1 ${className || ""}`}
    />
    {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
  </div>
);

const Select = ({
  error,
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { error?: string }) => (
  <div className="w-full">
    <select
      {...props}
      className={`w-full rounded-md border ${error ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "border-slate-300 focus:border-power-orange focus:ring-power-orange"} bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 ${className || ""}`}
    />
    {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
  </div>
);

const Label = ({
  children,
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label
    {...props}
    className={`block text-sm font-medium text-slate-700 ${className || ""}`}
  >
    {children}
  </label>
);
import {
  Trash2,
  Plus,
  UploadCloud,
  Link as LinkIcon,
  Image as ImageIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";

export default function AddProductPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateField = (field: string, value: string) => {
    let errMsg = "";
    if (field === "name" && value.trim().length < 3)
      errMsg = "Name must be at least 3 characters.";
    if (field === "sku" && value.trim().length < 3)
      errMsg = "SKU must be at least 3 characters.";
    if (field === "basePrice") {
      const num = parseFloat(value);
      if (isNaN(num) || num <= 0) errMsg = "Base Price must be greater than 0.";
    }
    if (field === "salePrice" && value.trim() !== "") {
      const num = parseFloat(value);
      if (isNaN(num) || num < 0) errMsg = "Sale Price must be valid.";
      if (formData.basePrice && num >= parseFloat(formData.basePrice))
        errMsg = "Sale Price must be less than Base Price.";
    }
    if (field === "weight") {
      const num = parseFloat(value);
      if (isNaN(num) || num <= 0) errMsg = "Weight must be greater than 0.";
    }
    if (["dim_length", "dim_width", "dim_height"].includes(field)) {
      const num = parseFloat(value);
      if (isNaN(num) || num <= 0) errMsg = "Dimension must be greater than 0.";
    }
    setErrors((prev) => ({ ...prev, [field]: errMsg }));
    return errMsg === "";
  };

  const validateVariantField = (
    index: number,
    field: string,
    value: string,
  ) => {
    let errMsg = "";
    if (field === "price" && value.trim() !== "") {
      const num = parseFloat(value);
      if (isNaN(num) || num < 0) errMsg = "Price must be a valid number.";
    }
    if (field === "stock") {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 0) errMsg = "Stock cannot be negative.";
    }
    if ((field === "size" || field === "color") && !value.trim()) {
      // It's technically okay if both are empty (label becomes "Standard"), but usually we want at least one or it's just the default variant.
      // We will allow empty, so no error here unless we specifically require variants to be named.
    }
    setErrors((prev) => ({ ...prev, [`variant_${index}_${field}`]: errMsg }));
    return errMsg === "";
  };

  // Form State
  const [formData, setFormData] = useState({
    sku: "",
    name: "",
    shortDescription: "",
    description: "",
    brand: "GENERIC",
    material: "OTHER",
    warranty: "",
    ageGroup: "ALL",
    skillLevel: "ALL",
    gender: "UNISEX",
    category: "APPAREL",
    basePrice: "",
    salePrice: "",
    weight: "",
    taxable: true,
    taxRate: "0.18",
    isActive: true,
  });

  const [tags, setTags] = useState("");

  const [dimensions, setDimensions] = useState({
    length: "",
    width: "",
    height: "",
  });

  const [images, setImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [variants, setVariants] = useState([
    {
      sku: "",
      size: "",
      color: "",
      price: "",
      stock: "",
      reorderLevel: "10",
    },
  ]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    try {
      setUploadingImage(true);
      setError(null);

      const uploadPromises = files.map(async (file) => {
        const res = await adminEcommerceApi.generateProductImageUploadUrl(
          file.name,
          file.type,
        );

        if (!res?.data) throw new Error("Failed to get upload URL");

        await fetch(res.data.uploadUrl, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type,
          },
        });

        return res.data.downloadUrl;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      setImages((prev) => [...prev, ...uploadedUrls].filter(Boolean));
    } catch (err: any) {
      console.error(err);
      setError(
        "Failed to upload image. Ensure S3 CORS is properly configured.",
      );
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleAddImageUrl = () => {
    const url = window.prompt("Enter image URL:");
    if (url && url.trim()) {
      setImages((prev) => [...prev, url.trim()]);
    }
  };

  const handleAddVariant = () => {
    setVariants([
      ...variants,
      {
        sku: "",
        size: "",
        color: "",
        price: "",
        stock: "",
        reorderLevel: "10",
      },
    ]);
  };

  const handleRemoveVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const handleVariantChange = (
    index: number,
    field: keyof (typeof variants)[0],
    value: string,
  ) => {
    const newVariants = [...variants];
    newVariants[index][field] = value;
    setVariants(newVariants);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);

      // Clean images
      const cleanedImages = images.filter((img) => img.trim() !== "");
      if (cleanedImages.length === 0) {
        throw new Error("At least one image URL is required");
      }

      const cleanedVariants = variants.map((v) => {
        const attrs: Record<string, string> = {};
        if (v.size) attrs.size = v.size;
        if (v.color) attrs.color = v.color;

        const variantLabel =
          [v.size, v.color].filter(Boolean).join(" - ") || "Standard";

        return {
          sku: v.sku || `${formData.sku}-V${Math.floor(Math.random() * 1000)}`,
          variantLabel,
          attributes: attrs,
          price: Math.round(parseFloat(v.price || formData.basePrice) * 100),
          stock: parseInt(v.stock) || 0,
          reorderLevel: parseInt(v.reorderLevel) || 10,
        };
      });

      if (cleanedVariants.length === 0) {
        throw new Error("At least one variant is required");
      }

      const payload = {
        sku: formData.sku,
        name: formData.name,
        shortDescription: formData.shortDescription,
        description: formData.description,
        brand: formData.brand,
        material: formData.material,
        warranty: formData.warranty,
        ageGroup: formData.ageGroup,
        skillLevel: formData.skillLevel,
        gender: formData.gender,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        category: formData.category,
        basePrice: Math.round(parseFloat(formData.basePrice) * 100),
        salePrice: formData.salePrice
          ? Math.round(parseFloat(formData.salePrice) * 100)
          : undefined,
        weight: parseFloat(formData.weight),
        dimensions: {
          length: parseFloat(dimensions.length),
          width: parseFloat(dimensions.width),
          height: parseFloat(dimensions.height),
        },
        taxable: formData.taxable,
        taxRate: parseFloat(formData.taxRate),
        isActive: formData.isActive,
        images: cleanedImages,
        variants: cleanedVariants,
      };

      await adminEcommerceApi.createProduct(payload as any);
      router.push("/admin/products");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to create product");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Ecommerce"
        title="New Product"
        subtitle="Add a new product to the catalog."
      />

      <form onSubmit={handleSubmit} className="space-y-6 pb-20">
        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-sm font-medium text-red-600">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            {/* Basic Info */}
            <Card className="p-6 space-y-4">
              <h3 className="text-lg font-bold text-slate-900">
                Basic Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    required
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                      if (errors.name) validateField("name", e.target.value);
                    }}
                    onBlur={(e) => validateField("name", e.target.value)}
                    error={errors.name}
                    placeholder="E.g., Pro Tennis Racket"
                  />
                </div>
                <div className="space-y-2">
                  <Label>SKU *</Label>
                  <Input
                    required
                    value={formData.sku}
                    onChange={(e) => {
                      setFormData({ ...formData, sku: e.target.value });
                      if (errors.sku) validateField("sku", e.target.value);
                    }}
                    onBlur={(e) => validateField("sku", e.target.value)}
                    error={errors.sku}
                    placeholder="E.g., TENNIS-RK-01"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Brand</Label>
                  <Select
                    value={formData.brand}
                    onChange={(e) =>
                      setFormData({ ...formData, brand: e.target.value })
                    }
                  >
                    <option value="SG">SG</option>
                    <option value="SS">SS</option>
                    <option value="KOOKABURRA">Kookaburra</option>
                    <option value="MRF">MRF</option>
                    <option value="CEAT">CEAT</option>
                    <option value="NIKE">Nike</option>
                    <option value="ADIDAS">Adidas</option>
                    <option value="PUMA">Puma</option>
                    <option value="UNDER_ARMOUR">Under Armour</option>
                    <option value="ASICS">Asics</option>
                    <option value="WILSON">Wilson</option>
                    <option value="YONEX">Yonex</option>
                    <option value="BABOLAT">Babolat</option>
                    <option value="HEAD">Head</option>
                    <option value="GENERIC">Generic</option>
                    <option value="OTHER">Other</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Short Description</Label>
                  <Input
                    value={formData.shortDescription}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        shortDescription: e.target.value,
                      })
                    }
                    placeholder="Punchy one-liner for the catalog"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Full Description *</Label>
                <Textarea
                  required
                  className="min-h-[120px]"
                  value={formData.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Detailed product description..."
                />
              </div>
            </Card>

            {/* Targeting & Details */}
            <Card className="p-6 space-y-4">
              <h3 className="text-lg font-bold text-slate-900">
                Targeting & Specifications
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Age Group</Label>
                  <Select
                    value={formData.ageGroup}
                    onChange={(e) =>
                      setFormData({ ...formData, ageGroup: e.target.value })
                    }
                  >
                    <option value="ALL">All Ages</option>
                    <option value="KIDS">Kids</option>
                    <option value="YOUTH">Youth</option>
                    <option value="ADULT">Adult</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Skill Level</Label>
                  <Select
                    value={formData.skillLevel}
                    onChange={(e) =>
                      setFormData({ ...formData, skillLevel: e.target.value })
                    }
                  >
                    <option value="ALL">All Levels</option>
                    <option value="BEGINNER">Beginner</option>
                    <option value="INTERMEDIATE">Intermediate</option>
                    <option value="ADVANCED">Advanced</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select
                    value={formData.gender}
                    onChange={(e) =>
                      setFormData({ ...formData, gender: e.target.value })
                    }
                  >
                    <option value="UNISEX">Unisex</option>
                    <option value="BOYS">Boys</option>
                    <option value="GIRLS">Girls</option>
                    <option value="MEN">Men</option>
                    <option value="WOMEN">Women</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Material</Label>
                  <Select
                    value={formData.material}
                    onChange={(e) =>
                      setFormData({ ...formData, material: e.target.value })
                    }
                  >
                    <option value="ENGLISH_WILLOW">English Willow</option>
                    <option value="KASHMIR_WILLOW">Kashmir Willow</option>
                    <option value="CARBON_FIBER">Carbon Fiber</option>
                    <option value="FIBERGLASS">Fiberglass</option>
                    <option value="ALUMINUM">Aluminum</option>
                    <option value="LEATHER">Leather</option>
                    <option value="SYNTHETIC_LEATHER">Synthetic Leather</option>
                    <option value="RUBBER">Rubber</option>
                    <option value="COTTON">Cotton</option>
                    <option value="POLYESTER">Polyester</option>
                    <option value="NYLON">Nylon</option>
                    <option value="BLENDED">Blended</option>
                    <option value="OTHER">Other</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Warranty / Cert</Label>
                  <Input
                    value={formData.warranty}
                    onChange={(e) =>
                      setFormData({ ...formData, warranty: e.target.value })
                    }
                    placeholder="E.g., 6 Months, CE Marked"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tags (Comma separated)</Label>
                  <Input
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="bat, cricket, training"
                  />
                </div>
              </div>
            </Card>

            {/* Images */}
            <Card className="p-6 space-y-4">
              <h3 className="text-lg font-bold text-slate-900">Images *</h3>
              {images.length > 0 && (
                <div className="flex flex-wrap gap-4 mb-4">
                  {images.map((img, index) => (
                    <div
                      key={index}
                      className="relative group h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm transition-all hover:border-slate-300"
                    >
                      {img ? (
                        <img
                          src={img}
                          alt="Preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <ImageIcon className="h-8 w-8 text-slate-300" />
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute right-1 top-1 rounded-full bg-black/60 p-1.5 text-white opacity-0 backdrop-blur-sm transition-all hover:scale-110 hover:bg-red-500 group-hover:opacity-100"
                        title="Remove image"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="relative" ref={dropdownRef}>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  disabled={uploadingImage}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {uploadingImage ? "Uploading..." : "Add Image"}
                </Button>

                {isDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg z-10">
                    <div className="p-1">
                      <label className="flex w-full cursor-pointer items-center rounded-sm px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                        <UploadCloud className="mr-2 h-4 w-4 text-slate-500" />{" "}
                        Upload File to S3
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => {
                            setIsDropdownOpen(false);
                            handleFileUpload(e);
                          }}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        className="flex w-full items-center rounded-sm px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                        onClick={() => {
                          setIsDropdownOpen(false);
                          handleAddImageUrl();
                        }}
                      >
                        <LinkIcon className="mr-2 h-4 w-4 text-slate-500" />{" "}
                        Enter Image URL
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Variants */}
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">Variants</h3>
                <Button type="button" size="sm" onClick={handleAddVariant}>
                  <Plus className="mr-2 h-4 w-4" /> Add Variant
                </Button>
              </div>
              <div className="space-y-4">
                {variants.map((variant, index) => (
                  <div
                    key={index}
                    className="relative rounded-lg border border-slate-200 p-4"
                  >
                    {variants.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveVariant(index)}
                        className="absolute right-2 top-2 text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Variant SKU</Label>
                        <Input
                          placeholder="Optional auto-generated"
                          value={variant.sku}
                          onChange={(e) =>
                            handleVariantChange(index, "sku", e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Size</Label>
                        <Input
                          placeholder="E.g., L, XL, 42"
                          value={variant.size}
                          onChange={(e) =>
                            handleVariantChange(index, "size", e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Color</Label>
                        <Input
                          placeholder="E.g., Red, Black"
                          value={variant.color}
                          onChange={(e) =>
                            handleVariantChange(index, "color", e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Price (in ₹)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="E.g., 999.00"
                          value={variant.price}
                          onChange={(e) => {
                            handleVariantChange(index, "price", e.target.value);
                            if (errors[`variant_${index}_price`])
                              validateVariantField(
                                index,
                                "price",
                                e.target.value,
                              );
                          }}
                          onBlur={(e) =>
                            validateVariantField(index, "price", e.target.value)
                          }
                          error={errors[`variant_${index}_price`]}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Stock *</Label>
                        <Input
                          type="number"
                          required
                          value={variant.stock}
                          onChange={(e) => {
                            handleVariantChange(index, "stock", e.target.value);
                            if (errors[`variant_${index}_stock`])
                              validateVariantField(
                                index,
                                "stock",
                                e.target.value,
                              );
                          }}
                          onBlur={(e) =>
                            validateVariantField(index, "stock", e.target.value)
                          }
                          error={errors[`variant_${index}_stock`]}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            {/* Categorization & Status */}
            <Card className="p-6 space-y-4">
              <h3 className="text-lg font-bold text-slate-900">Organization</h3>
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                >
                  <option value="APPAREL">Apparel</option>
                  <option value="FOOTWEAR">Footwear</option>
                  <option value="ACCESSORIES">Accessories</option>
                  <option value="EQUIPMENT">Equipment</option>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                  className="rounded border-slate-300 text-power-orange focus:ring-power-orange"
                />
                <Label htmlFor="isActive">Active in Store</Label>
              </div>
            </Card>

            {/* Pricing */}
            <Card className="p-6 space-y-4">
              <h3 className="text-lg font-bold text-slate-900">Pricing</h3>
              <div className="space-y-2">
                <Label>Base Price (in ₹) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  placeholder="E.g., 1299.00"
                  value={formData.basePrice}
                  onChange={(e) => {
                    setFormData({ ...formData, basePrice: e.target.value });
                    if (errors.basePrice)
                      validateField("basePrice", e.target.value);
                  }}
                  onBlur={(e) => validateField("basePrice", e.target.value)}
                  error={errors.basePrice}
                />
              </div>
              <div className="space-y-2">
                <Label>Sale Price (in ₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Optional"
                  value={formData.salePrice}
                  onChange={(e) => {
                    setFormData({ ...formData, salePrice: e.target.value });
                    if (errors.salePrice)
                      validateField("salePrice", e.target.value);
                  }}
                  onBlur={(e) => validateField("salePrice", e.target.value)}
                  error={errors.salePrice}
                />
              </div>
            </Card>

            {/* Logistics */}
            <Card className="p-6 space-y-4">
              <h3 className="text-lg font-bold text-slate-900">Logistics</h3>
              <div className="space-y-2">
                <Label>Weight (g) *</Label>
                <Input
                  type="number"
                  required
                  step="0.1"
                  placeholder="E.g., 250"
                  value={formData.weight}
                  onChange={(e) => {
                    setFormData({ ...formData, weight: e.target.value });
                    if (errors.weight) validateField("weight", e.target.value);
                  }}
                  onBlur={(e) => validateField("weight", e.target.value)}
                  error={errors.weight}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-2">
                  <Label className="text-xs">L (cm) *</Label>
                  <Input
                    type="number"
                    required
                    step="0.1"
                    value={dimensions.length}
                    onChange={(e) => {
                      setDimensions({ ...dimensions, length: e.target.value });
                      if (errors.dim_length)
                        validateField("dim_length", e.target.value);
                    }}
                    onBlur={(e) => validateField("dim_length", e.target.value)}
                    error={errors.dim_length}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">W (cm) *</Label>
                  <Input
                    type="number"
                    required
                    step="0.1"
                    value={dimensions.width}
                    onChange={(e) => {
                      setDimensions({ ...dimensions, width: e.target.value });
                      if (errors.dim_width)
                        validateField("dim_width", e.target.value);
                    }}
                    onBlur={(e) => validateField("dim_width", e.target.value)}
                    error={errors.dim_width}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">H (cm) *</Label>
                  <Input
                    type="number"
                    required
                    step="0.1"
                    value={dimensions.height}
                    onChange={(e) => {
                      setDimensions({ ...dimensions, height: e.target.value });
                      if (errors.dim_height)
                        validateField("dim_height", e.target.value);
                    }}
                    onBlur={(e) => validateField("dim_height", e.target.value)}
                    error={errors.dim_height}
                  />
                </div>
              </div>
            </Card>
          </div>
        </div>

        <div className="flex items-center justify-end gap-4 border-t border-slate-200 pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/admin/products")}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Saving..." : "Create Product"}
          </Button>
        </div>
      </form>
    </div>
  );
}
