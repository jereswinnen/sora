"use client";

import { useState } from "react";
import {
  CaseSensitiveIcon,
  TextAlignJustifyIcon,
  TextAlignStartIcon,
  FoldHorizontalIcon,
  GalleryHorizontalIcon,
  UnfoldHorizontalIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AlignLeftIcon, AlignCenterIcon } from "lucide-react";

export type AppearanceSettings = {
  theme: "sans" | "serif";
  titleSize: number;
  titleLeading: number;
  titleAlignment: "left" | "center";
  bodySize: number;
  bodyLeading: number;
  margins: "narrow" | "normal" | "wide";
  justifyText: boolean;
};

const DEFAULT_SETTINGS: AppearanceSettings = {
  theme: "sans",
  titleSize: 32,
  titleLeading: 1.3,
  titleAlignment: "left",
  bodySize: 18,
  bodyLeading: 1.8,
  margins: "normal",
  justifyText: false,
};

interface AppearancePopoverProps {
  settings: AppearanceSettings;
  onSettingsChange: (settings: AppearanceSettings) => void;
}

export function AppearancePopover({
  settings,
  onSettingsChange,
}: AppearancePopoverProps) {
  const [open, setOpen] = useState(false);

  const updateSetting = <K extends keyof AppearanceSettings>(
    key: K,
    value: AppearanceSettings[K],
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const hasChanges =
    JSON.stringify(settings) !== JSON.stringify(DEFAULT_SETTINGS);

  const handleReset = () => {
    onSettingsChange(DEFAULT_SETTINGS);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Appearance Settings">
          <CaseSensitiveIcon />
          Appearance
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <FieldGroup>
          {/* Theme Section */}
          <FieldSet>
            <RadioGroup
              value={settings.theme}
              onValueChange={(value) =>
                updateSetting("theme", value as "sans" | "serif")
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="sans" id="theme-sans" />
                <Label
                  htmlFor="theme-sans"
                  className="font-normal cursor-pointer"
                >
                  Sans
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="serif" id="theme-serif" />
                <Label
                  htmlFor="theme-serif"
                  className="font-normal cursor-pointer"
                >
                  Serif
                </Label>
              </div>
            </RadioGroup>
          </FieldSet>

          <FieldSeparator />

          {/* Size Section */}
          <FieldSet>
            <Field className="grid grid-cols-2">
              <FieldLabel>Title Size (px)</FieldLabel>
              <Input
                type="number"
                min="24"
                max="64"
                value={settings.titleSize}
                onChange={(e) =>
                  updateSetting("titleSize", Number(e.target.value))
                }
              />
            </Field>

            <Field className="grid grid-cols-2">
              <FieldLabel>Title Leading</FieldLabel>
              <Input
                type="number"
                min="1"
                max="2"
                step="0.1"
                value={settings.titleLeading}
                onChange={(e) =>
                  updateSetting("titleLeading", Number(e.target.value))
                }
              />
            </Field>

            <Field className="grid grid-cols-2">
              <FieldLabel>Title Alignment</FieldLabel>
              <ToggleGroup
                type="single"
                value={settings.titleAlignment}
                onValueChange={(value) =>
                  value &&
                  updateSetting("titleAlignment", value as "left" | "center")
                }
              >
                <ToggleGroupItem
                  variant="outline"
                  value="left"
                  aria-label="Align left"
                >
                  <AlignLeftIcon />
                </ToggleGroupItem>
                <ToggleGroupItem
                  variant="outline"
                  value="center"
                  aria-label="Align center"
                >
                  <AlignCenterIcon />
                </ToggleGroupItem>
              </ToggleGroup>
            </Field>

            <Field className="grid grid-cols-2">
              <FieldLabel>Body Size (px)</FieldLabel>
              <Input
                type="number"
                min="14"
                max="28"
                value={settings.bodySize}
                onChange={(e) =>
                  updateSetting("bodySize", Number(e.target.value))
                }
              />
            </Field>

            <Field className="grid grid-cols-2">
              <FieldLabel>Body Leading</FieldLabel>
              <Input
                type="number"
                min="1"
                max="2.5"
                step="0.1"
                value={settings.bodyLeading}
                onChange={(e) =>
                  updateSetting("bodyLeading", Number(e.target.value))
                }
              />
            </Field>
          </FieldSet>

          <FieldSeparator />

          {/* General Section */}
          <FieldSet>
            <Field className="grid grid-cols-2">
              <FieldLabel>Margins</FieldLabel>
              <ToggleGroup
                type="single"
                value={settings.margins}
                onValueChange={(value) =>
                  value &&
                  updateSetting(
                    "margins",
                    value as "narrow" | "normal" | "wide",
                  )
                }
              >
                <ToggleGroupItem
                  variant="outline"
                  value="narrow"
                  aria-label="Narrow margins"
                >
                  <FoldHorizontalIcon />
                </ToggleGroupItem>
                <ToggleGroupItem
                  variant="outline"
                  value="normal"
                  aria-label="Normal margins"
                >
                  <GalleryHorizontalIcon />
                </ToggleGroupItem>
                <ToggleGroupItem
                  variant="outline"
                  value="wide"
                  aria-label="Wide margins"
                >
                  <UnfoldHorizontalIcon />
                </ToggleGroupItem>
              </ToggleGroup>
            </Field>
            <Field className="grid grid-cols-2">
              <FieldLabel>Text Justification</FieldLabel>
              <ToggleGroup
                type="single"
                value={settings.justifyText ? "justify" : "left"}
                onValueChange={(value) =>
                  updateSetting("justifyText", value === "justify")
                }
              >
                <ToggleGroupItem
                  variant="outline"
                  value="left"
                  aria-label="Left align"
                >
                  <TextAlignStartIcon />
                </ToggleGroupItem>
                <ToggleGroupItem
                  variant="outline"
                  value="justify"
                  aria-label="Justify"
                >
                  <TextAlignJustifyIcon />
                </ToggleGroupItem>
              </ToggleGroup>
            </Field>
          </FieldSet>

          {/* Reset Button */}
          <Button
            className="w-full"
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!hasChanges}
          >
            Reset to Defaults
          </Button>
        </FieldGroup>
      </PopoverContent>
    </Popover>
  );
}
